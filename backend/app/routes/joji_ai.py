from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import asyncio
import json
import logging
import os
from datetime import datetime, timedelta
from collections import defaultdict

from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.joji_ai import Conversation, ConversationMessage, JojiAISettings, VaultFile
from app.schemas.joji_ai import (
    ChatRequest, ConversationResponse, ConversationWithMessages,
    ConversationMessageResponse, JojiAISettingsUpdate, JojiAISettingsResponse,
    VaultFileResponse, VaultSyncStatus,
)
from app.services.encryption_service import EncryptionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["joji-ai"])

# Rate limiting: track requests per user per hour
_rate_limits: dict[int, list[datetime]] = defaultdict(list)
HAIKU_LIMIT = int(os.getenv("AI_RATE_LIMIT_HAIKU", "120"))
SONNET_LIMIT = int(os.getenv("AI_RATE_LIMIT_SONNET", "60"))
OPUS_LIMIT = int(os.getenv("AI_RATE_LIMIT_OPUS", "20"))
DAILY_COST_CAP = float(os.getenv("AI_DAILY_COST_CAP", "5.0"))


def _check_rate_limit(user_id: int, model: str | None) -> None:
    """Check per-model hourly rate limit. Raises HTTPException if exceeded."""
    if model and "opus" in model:
        limit = OPUS_LIMIT
    elif model and "haiku" in model:
        limit = HAIKU_LIMIT
    else:
        limit = SONNET_LIMIT
    now = datetime.utcnow()
    cutoff = now - timedelta(hours=1)
    # Clean old entries
    _rate_limits[user_id] = [t for t in _rate_limits[user_id] if t > cutoff]
    if len(_rate_limits[user_id]) >= limit:
        raise HTTPException(status_code=429, detail=f"Rate limit exceeded ({limit}/hour). Try again later.")
    _rate_limits[user_id].append(now)


def _check_cost_cap(settings: JojiAISettings) -> None:
    """Check daily cost cap. Raises HTTPException if exceeded."""
    if settings.total_cost_usd >= DAILY_COST_CAP:
        raise HTTPException(
            status_code=429,
            detail=f"Daily cost cap (${DAILY_COST_CAP:.2f}) exceeded. Current: ${settings.total_cost_usd:.2f}",
        )


# Lazy-initialized singleton
_ai_service = None


def _get_ai_service():
    """Lazily initialize JojiAIService so the import doesn't fail at module load
    if ANTHROPIC_API_KEY is not yet set."""
    global _ai_service
    if _ai_service is None:
        from app.services.ai_service import JojiAIService
        _ai_service = JojiAIService()
    return _ai_service


# ---------------------------------------------------------------------------
# 1. POST /chat -- Streaming chat
# ---------------------------------------------------------------------------

@router.post("/chat")
async def chat(
    request: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Resolve model: explicit request > user's default setting > service default
    settings = db.query(JojiAISettings).filter(JojiAISettings.user_id == user.id).first()
    resolved_model = request.model or (settings.default_model if settings else None)

    # Rate limit + cost cap checks
    _check_rate_limit(user.id, resolved_model)
    if settings:
        _check_cost_cap(settings)

    service = _get_ai_service()
    generator = service.chat_stream(
        db=db,
        user_id=user.id,
        message=request.message,
        conversation_id=request.conversation_id,
        model_override=resolved_model,
    )

    async def event_stream():
        try:
            async for chunk in generator:
                yield chunk
        except Exception as e:
            logger.error("Chat stream error: %s", e, exc_info=True)
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


# ---------------------------------------------------------------------------
# 2. GET /conversations -- List conversations
# ---------------------------------------------------------------------------

@router.get("/conversations", response_model=list[ConversationResponse])
def list_conversations(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    # Subquery for message counts
    msg_count_sub = (
        db.query(
            ConversationMessage.conversation_id,
            func.count(ConversationMessage.id).label("message_count"),
        )
        .group_by(ConversationMessage.conversation_id)
        .subquery()
    )

    rows = (
        db.query(Conversation, func.coalesce(msg_count_sub.c.message_count, 0))
        .outerjoin(msg_count_sub, Conversation.id == msg_count_sub.c.conversation_id)
        .filter(Conversation.user_id == user.id)
        .order_by(Conversation.updated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    results = []
    for conv, count in rows:
        results.append({
            "id": conv.id,
            "title": conv.title,
            "created_at": conv.created_at.isoformat() if conv.created_at else None,
            "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
            "message_count": count,
        })
    return results


# ---------------------------------------------------------------------------
# 3. GET /conversations/{conversation_id} -- Conversation with messages
# ---------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}")
def get_conversation(
    conversation_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    total_messages = (
        db.query(func.count(ConversationMessage.id))
        .filter(ConversationMessage.conversation_id == conversation_id)
        .scalar()
    ) or 0

    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    conv_response = {
        "id": conv.id,
        "title": conv.title,
        "created_at": conv.created_at.isoformat() if conv.created_at else None,
        "updated_at": conv.updated_at.isoformat() if conv.updated_at else None,
        "message_count": total_messages,
    }

    msg_list = []
    for m in messages:
        msg_list.append({
            "id": m.id,
            "role": m.role,
            "content": m.content or "",
            "model": m.model,
            "tool_calls_json": m.tool_calls_json if isinstance(m.tool_calls_json, (dict, list)) else None,
            "vault_chunks_used": m.vault_chunks_used if isinstance(m.vault_chunks_used, list) else None,
            "tokens_used": m.tokens_used,
            "cost_usd": m.cost_usd,
            "created_at": m.created_at.isoformat() if m.created_at else None,
        })

    return {
        "conversation": conv_response,
        "messages": msg_list,
        "total_messages": total_messages,
    }


# ---------------------------------------------------------------------------
# 4. DELETE /conversations/{conversation_id} -- Delete conversation
# ---------------------------------------------------------------------------

@router.delete("/conversations/{conversation_id}")
def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    db.delete(conv)
    db.commit()
    return {"message": "Conversation deleted"}


# ---------------------------------------------------------------------------
# 5. POST /conversations/{conversation_id}/title -- Rename conversation
# ---------------------------------------------------------------------------

class RenameRequest(BaseModel):
    title: str


@router.post("/conversations/{conversation_id}/title", response_model=ConversationResponse)
def rename_conversation(
    conversation_id: int,
    body: RenameRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    conv = (
        db.query(Conversation)
        .filter(Conversation.id == conversation_id, Conversation.user_id == user.id)
        .first()
    )
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.title = body.title
    db.commit()
    db.refresh(conv)

    # Get message count for the response
    msg_count = (
        db.query(func.count(ConversationMessage.id))
        .filter(ConversationMessage.conversation_id == conversation_id)
        .scalar()
    )
    conv.message_count = msg_count
    return conv


# ---------------------------------------------------------------------------
# 6. POST /vault/sync -- Trigger manual sync
# ---------------------------------------------------------------------------

@router.post("/vault/sync")
async def trigger_vault_sync(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings = (
        db.query(JojiAISettings)
        .filter(JojiAISettings.user_id == user.id)
        .first()
    )
    if not settings or not settings.github_repo_url:
        raise HTTPException(
            status_code=400,
            detail="GitHub repo URL not configured. Update AI settings first.",
        )

    from app.services.vault_sync_service import VaultSyncService
    sync_service = VaultSyncService()

    async def _run_sync():
        """Run the sync in the background. Needs its own DB session."""
        from app.database.connection import SessionLocal
        bg_db = SessionLocal()
        try:
            bg_settings = (
                bg_db.query(JojiAISettings)
                .filter(JojiAISettings.user_id == user.id)
                .first()
            )
            if bg_settings:
                await sync_service.sync_vault(bg_db, bg_settings)
        except Exception as e:
            logger.error("Background vault sync failed: %s", e, exc_info=True)
        finally:
            bg_db.close()

    asyncio.create_task(_run_sync())
    return {"status": "sync_started"}


# ---------------------------------------------------------------------------
# 7. GET /vault/status -- Sync status
# ---------------------------------------------------------------------------

@router.get("/vault/status", response_model=VaultSyncStatus)
def get_vault_status(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings = (
        db.query(JojiAISettings)
        .filter(JojiAISettings.user_id == user.id)
        .first()
    )

    if not settings:
        return VaultSyncStatus(
            status="never_synced",
            file_count=0,
            last_sync_at=None,
        )

    file_count = db.query(func.count(VaultFile.id)).scalar() or 0

    status = settings.last_sync_status or "never_synced"
    return VaultSyncStatus(
        status=status,
        file_count=file_count,
        last_sync_at=settings.last_sync_at,
    )


# ---------------------------------------------------------------------------
# 8. GET /vault/files -- List indexed files
# ---------------------------------------------------------------------------

@router.get("/vault/files", response_model=list[VaultFileResponse])
def list_vault_files(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    files = (
        db.query(VaultFile)
        .order_by(VaultFile.file_path.asc())
        .all()
    )
    return files


# ---------------------------------------------------------------------------
# 9. GET /settings -- Get AI settings
# ---------------------------------------------------------------------------

@router.get("/settings", response_model=JojiAISettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings = (
        db.query(JojiAISettings)
        .filter(JojiAISettings.user_id == user.id)
        .first()
    )

    if not settings:
        settings = JojiAISettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    # Set the computed field before returning
    settings.has_github_token = settings.github_token_encrypted is not None
    return settings


# ---------------------------------------------------------------------------
# 10. PUT /settings -- Update AI settings
# ---------------------------------------------------------------------------

@router.put("/settings", response_model=JojiAISettingsResponse)
def update_settings(
    body: JojiAISettingsUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    settings = (
        db.query(JojiAISettings)
        .filter(JojiAISettings.user_id == user.id)
        .first()
    )

    if not settings:
        settings = JojiAISettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(settings)

    update_data = body.model_dump(exclude_unset=True)

    # Handle github_token encryption separately
    plain_token = update_data.pop("github_token", None)
    if plain_token is not None:
        encryption = EncryptionService()
        settings.github_token_encrypted = encryption.encrypt(plain_token)

    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    settings.has_github_token = settings.github_token_encrypted is not None
    return settings


# ---------------------------------------------------------------------------
# 11. POST /vault/generate-templates -- Generate vault starter templates
# ---------------------------------------------------------------------------

@router.post("/vault/generate-templates")
def generate_vault_templates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Generate Obsidian vault starter templates from real outreach data."""
    from app.services.crm_vault_sync import CRMVaultSync

    syncer = CRMVaultSync()
    result = syncer.generate_starter_templates(db)

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "Template generation failed"))

    return result


# ---------------------------------------------------------------------------
# 11b. GET /vault/obsidian-status -- Check if Obsidian REST API is reachable
# ---------------------------------------------------------------------------

@router.get("/vault/obsidian-status")
def obsidian_status(user: User = Depends(get_current_user)):
    """Check if Obsidian Local REST API is reachable for live sync."""
    from app.services import obsidian_client

    available = obsidian_client.is_available()
    return {
        "connected": available,
        "url": obsidian_client._get_url(),
        "has_api_key": bool(obsidian_client._get_api_key()),
    }


# ---------------------------------------------------------------------------
# 12. POST /vault/gmail-backfill -- Index Gmail threads into vault
# ---------------------------------------------------------------------------

@router.post("/vault/gmail-backfill")
def gmail_vault_backfill(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Trigger Gmail backfill by resetting the sync timestamp.

    The scheduler's incremental_sync will automatically backfill 6 months
    of threads in batches of 50 per run (every 30 min). No background
    threads needed — survives Render deploys.
    """
    settings = db.query(JojiAISettings).filter(JojiAISettings.user_id == user.id).first()
    if settings:
        settings.last_gmail_vault_sync_at = None  # Forces 6-month lookback
        settings.gmail_backfill_status = "started"
        settings.gmail_backfill_threads = None
        settings.gmail_backfill_error = None
        db.commit()

    return {"status": "started", "message": "Gmail indexing will process in batches via the scheduler (50 threads every 30 min)."}


# ---------------------------------------------------------------------------
# 13. POST /vault/gmail-backfill/reset -- Reset stuck backfill status
# ---------------------------------------------------------------------------

@router.post("/vault/gmail-backfill/reset")
def reset_gmail_backfill(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Reset a stuck gmail backfill status."""
    settings = db.query(JojiAISettings).filter(JojiAISettings.user_id == user.id).first()
    if settings:
        settings.gmail_backfill_status = None
        settings.gmail_backfill_threads = None
        settings.gmail_backfill_error = None
        db.commit()
    return {"status": "reset"}


# ---------------------------------------------------------------------------
# 14. POST /vault/gmail-sync-now -- Manually trigger Gmail vault sync
# ---------------------------------------------------------------------------

@router.post("/vault/gmail-sync-now")
def gmail_sync_now(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Manually trigger one round of Gmail vault sync with debug info."""
    from app.services.gmail_vault_service import GmailVaultService, VAULT_REPO_DIR, GMAIL_VAULT_DIR
    import os

    service = GmailVaultService()
    result = service.incremental_sync(db, user.id)

    # Debug info
    repo_exists = (VAULT_REPO_DIR / ".git").exists()
    gmail_dir_exists = GMAIL_VAULT_DIR.exists()
    gmail_file_count = len(list(GMAIL_VAULT_DIR.glob("*.md"))) if gmail_dir_exists else 0

    # Check git status
    git_status = "unknown"
    try:
        import git
        if repo_exists:
            repo = git.Repo(VAULT_REPO_DIR)
            git_status = repo.git.status("--short", "gmail/")[:500] if gmail_dir_exists else "no gmail dir"
    except Exception as e:
        git_status = str(e)[:200]

    result["debug"] = {
        "repo_exists": repo_exists,
        "gmail_dir_exists": gmail_dir_exists,
        "gmail_files_on_disk": gmail_file_count,
        "git_status": git_status,
    }
    return result
