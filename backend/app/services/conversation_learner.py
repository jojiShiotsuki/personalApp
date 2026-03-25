"""
Conversation learner -- after each conversation, Haiku reviews the exchange
and updates vault files with any new insights about the user's voice,
preferences, business processes, or lessons learned.

Runs as a background task so it doesn't block the chat response.
Cost: ~$0.001 per conversation using Haiku.
"""

import json
import logging
from datetime import datetime
from typing import Optional

from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.models.joji_ai import Conversation, ConversationMessage
from app.services.vault_config import VAULT_REPO_DIR
from app.services import obsidian_client

logger = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"
MIN_MESSAGES_TO_LEARN = 4  # Skip short conversations (< 2 exchanges)

LEARNING_PROMPT = """You are a learning engine for a personal AI assistant called Joji AI.
You just observed a conversation between Joji AI and its user (Joji, a freelance web developer in Australia).

Your job: extract anything NEW and USEFUL that the AI should remember for future conversations.

Categories to look for:
1. **voice** — How the user communicates: phrases they use, tone preferences, formality level, humor style
2. **preferences** — Business preferences: pricing, tools they like/dislike, workflow preferences
3. **process** — Business processes: how they handle clients, sales steps, onboarding procedures
4. **lessons** — Lessons learned: what worked, what didn't, mistakes to avoid, insights gained

Rules:
- Only extract things that are NEW — don't repeat what's already in existing vault notes
- Only extract things that are REUSABLE — skip one-off task details
- Be specific and concise — "User prefers casual tone with prospects" not "User has communication preferences"
- If there's nothing new worth saving, respond with {"learnings": []}
- Maximum 3 learnings per conversation

Respond with JSON only:
{
  "learnings": [
    {
      "category": "voice|preferences|process|lessons",
      "insight": "The specific thing learned",
      "vault_file": "which file to append to (e.g. voice/tone-guide.md, sops/pricing.md, knowledge/lessons-learned.md)"
    }
  ]
}"""


def run_learning_cycle(db: Session, conversation_id: int) -> Optional[dict]:
    """Analyze a conversation and update vault files with new insights.

    Should be called as a background task after chat completes.
    """
    try:
        conversation = db.query(Conversation).filter(Conversation.id == conversation_id).first()
        if not conversation:
            return None

        messages = (
            db.query(ConversationMessage)
            .filter(ConversationMessage.conversation_id == conversation_id)
            .order_by(ConversationMessage.created_at.asc())
            .all()
        )

        if len(messages) < MIN_MESSAGES_TO_LEARN:
            return {"status": "skipped", "reason": "too_short"}

        # Build conversation transcript (cap each message to keep cost down)
        transcript_lines = []
        for msg in messages:
            role = "User" if msg.role == "user" else "Joji AI"
            transcript_lines.append(f"**{role}:** {msg.content[:1000]}")
        transcript = "\n\n".join(transcript_lines)

        # Load existing vault notes so Haiku doesn't repeat known info
        existing_context = _load_existing_learnings()

        # Ask Haiku to analyze
        client = Anthropic()
        response = client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=1024,
            system=LEARNING_PROMPT,
            messages=[{
                "role": "user",
                "content": (
                    f"## Existing vault knowledge (don't repeat these):\n{existing_context}\n\n"
                    f"## Conversation to analyze:\n{transcript}"
                ),
            }],
        )

        response_text = response.content[0].text.strip()
        if response_text.startswith("```"):
            response_text = response_text.split("\n", 1)[1].rsplit("```", 1)[0].strip()

        result = json.loads(response_text)
        learnings = result.get("learnings", [])

        if not learnings:
            return {"status": "no_new_learnings"}

        written = 0
        written_files = []
        for learning in learnings:
            insight = learning.get("insight", "")
            vault_file = learning.get("vault_file", "")
            category = learning.get("category", "")
            if not insight or not vault_file:
                continue
            if _append_to_vault_file(vault_file, insight, category):
                written += 1
                written_files.append(vault_file)

        # Re-index written files immediately so they're searchable right away
        if written_files:
            _reindex_files(db, written_files)

        logger.info("Conversation learner: %d insights from conversation %d", written, conversation_id)
        return {"status": "learned", "insights_saved": written}

    except json.JSONDecodeError as exc:
        logger.warning("Conversation learner: bad JSON from Haiku: %s", exc)
        return {"status": "parse_error"}
    except Exception as exc:
        logger.warning("Conversation learner failed for %d: %s", conversation_id, exc)
        return None


def _load_existing_learnings() -> str:
    """Load summaries of existing vault learning files to avoid duplicates."""
    files_to_check = [
        "voice/tone-guide.md",
        "voice/phrases-i-use.md",
        "voice/communication-style.md",
        "sops/pricing.md",
        "sops/sales-process.md",
        "sops/client-onboarding.md",
        "knowledge/lessons-learned.md",
        "knowledge/tech-stack.md",
        "goals/business-vision.md",
    ]

    summaries = []
    for fp in files_to_check:
        full_path = VAULT_REPO_DIR / fp
        if full_path.exists():
            content = full_path.read_text(encoding="utf-8")
            summaries.append(f"### {fp}\n{content[:500]}")

    return "\n\n".join(summaries) if summaries else "_No existing vault notes yet._"


def _append_to_vault_file(file_path: str, insight: str, category: str) -> bool:
    """Append a learning insight to a vault file. Returns True if written."""
    full_path = VAULT_REPO_DIR / file_path
    today = datetime.utcnow().strftime("%Y-%m-%d")
    entry = f"\n\n## Learned {today}\n- {insight}\n"

    if full_path.exists():
        existing = full_path.read_text(encoding="utf-8")
        if insight in existing:
            return False
        content = existing + entry
    else:
        content = (
            f"---\ntype: {category}\ntags: [{category}, auto-learned]\n"
            f"generated: {today}\n---\n\n"
            f"# {file_path.split('/')[-1].replace('.md', '').replace('-', ' ').title()}\n"
            f"{entry}"
        )
        full_path.parent.mkdir(parents=True, exist_ok=True)

    full_path.write_text(content, encoding="utf-8")
    obsidian_client.write_file(file_path, content)
    return True


def _reindex_files(db: Session, file_paths: list[str]) -> None:
    """Re-index specific vault files immediately so learnings are searchable."""
    import hashlib
    from app.models.joji_ai import VaultFile, VaultChunk
    from app.services.vault_sync_service import VaultSyncService

    syncer = VaultSyncService()

    for rel_path in file_paths:
        full_path = VAULT_REPO_DIR / rel_path
        if not full_path.exists():
            continue

        try:
            content = full_path.read_text(encoding="utf-8")
            content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

            vault_file = db.query(VaultFile).filter(VaultFile.file_path == rel_path).first()

            if vault_file and vault_file.content_hash == content_hash:
                continue  # unchanged

            # Delete old chunks
            if vault_file:
                db.query(VaultChunk).filter(VaultChunk.vault_file_id == vault_file.id).delete()
            else:
                vault_file = VaultFile(file_path=rel_path, content_hash=content_hash)
                db.add(vault_file)

            vault_file.content_hash = content_hash
            vault_file.last_synced_at = datetime.utcnow()
            db.flush()

            # Chunk and embed
            raw_chunks = syncer.chunk_markdown(content, rel_path)
            texts = [c["content"] for c in raw_chunks]
            embeddings = syncer.embed_chunks(texts)

            for i, chunk_dict in enumerate(raw_chunks):
                db.add(VaultChunk(
                    vault_file_id=vault_file.id,
                    chunk_index=chunk_dict["chunk_index"],
                    content=chunk_dict["content"],
                    embedding=embeddings[i] if embeddings[i] is not None else None,
                    heading_context=chunk_dict["heading_context"],
                    metadata_json=chunk_dict["metadata"] or None,
                ))

            db.commit()
            logger.info("Re-indexed vault file: %s", rel_path)

        except Exception as exc:
            logger.warning("Failed to re-index %s: %s", rel_path, exc)
