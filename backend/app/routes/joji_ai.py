from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
import asyncio
import json
import logging

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
    service = _get_ai_service()
    generator = service.chat_stream(
        db=db,
        user_id=user.id,
        message=request.message,
        conversation_id=request.conversation_id,
        model_override=request.model,
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
        conv.message_count = count
        results.append(conv)
    return results


# ---------------------------------------------------------------------------
# 3. GET /conversations/{conversation_id} -- Conversation with messages
# ---------------------------------------------------------------------------

@router.get("/conversations/{conversation_id}", response_model=ConversationWithMessages)
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
    )

    messages = (
        db.query(ConversationMessage)
        .filter(ConversationMessage.conversation_id == conversation_id)
        .order_by(ConversationMessage.created_at.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    # Set message_count on the conversation for the response schema
    conv.message_count = total_messages

    return ConversationWithMessages(
        conversation=ConversationResponse.model_validate(conv, from_attributes=True),
        messages=[
            ConversationMessageResponse.model_validate(m, from_attributes=True)
            for m in messages
        ],
        total_messages=total_messages,
    )


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
