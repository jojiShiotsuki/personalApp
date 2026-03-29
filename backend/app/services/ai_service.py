"""
JojiAIService -- upgraded AI service with vault context, conversation persistence,
Sonnet 4.6 default, and SSE streaming.

Backward-compatible: keeps build_system_prompt(context) for the floating panel,
and stream_chat delegates to chat_stream.
"""

import json
import logging
import os
from datetime import datetime
from typing import Any, AsyncGenerator, Dict, List, Optional

from anthropic import AsyncAnthropic
from sqlalchemy.orm import Session

from app.models.joji_ai import Conversation, ConversationMessage, JojiAISettings
from app.schemas.ai import Message
from app.services.ai_tools import get_tools_for_page
from app.services.tool_executor import ToolExecutor
from app.services.vault_search_service import VaultSearchService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Pricing per million tokens
# ---------------------------------------------------------------------------
MODEL_PRICING: Dict[str, Dict[str, float]] = {
    "claude-haiku-4-5-20251001": {"input": 0.80, "output": 4.0},
    "claude-sonnet-4-6": {"input": 3.0, "output": 15.0},
    "claude-opus-4-6": {"input": 15.0, "output": 75.0},
}

DEFAULT_MODEL = os.getenv("JOJI_AI_DEFAULT_MODEL", "claude-sonnet-4-6")
DEFAULT_MAX_TOKENS = 4096
CONVERSATION_HISTORY_LIMIT = 20

# In-memory store for background learning results (polled by frontend)
_learn_results: dict[int, dict] = {}


def get_learn_result(conversation_id: int) -> dict:
    """Pop and return the learning result for a conversation (if available)."""
    return _learn_results.pop(conversation_id, {"insights_saved": 0})


def _calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Return estimated USD cost based on token counts and model pricing."""
    pricing = MODEL_PRICING.get(model)
    if not pricing:
        return 0.0
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return round(input_cost + output_cost, 6)


def _sse_event(event: str, data: Any) -> str:
    """Format a single SSE event string (with trailing double newline)."""
    payload = json.dumps(data, default=str)
    return f"event: {event}\ndata: {payload}\n\n"


class JojiAIService:
    """Full-featured Joji AI service with vault context, streaming, and persistence."""

    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = AsyncAnthropic(api_key=api_key)
        self.model = DEFAULT_MODEL
        self.vault_search = VaultSearchService()

    # ------------------------------------------------------------------
    # Backward-compatible helpers (used by floating panel / page context)
    # ------------------------------------------------------------------

    def build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build context-aware system prompt based on current page.

        Kept for backward compatibility with the floating AI panel.
        """
        page = context.get("page", "unknown")
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        base = (
            f"You are an AI assistant for Vertex, a personal productivity app. "
            f"The current date and time is {current_time}. "
            "You have access to tools for managing tasks, deals, and contacts across the entire application. "
            "You can view, create, and update these items regardless of the current page."
        )

        page_contexts = {
            "tasks": "The user is currently viewing the Tasks page.",
            "deals": "The user is currently viewing the Deals page.",
            "contacts": "The user is currently viewing the Contacts page.",
            "projects": "The user is currently viewing the Projects page.",
            "goals": "The user is currently viewing the Goals page.",
        }

        context_text = page_contexts.get(page, "The user is currently in the application.")
        return f"{base}\n\n{context_text}"

    async def chat(
        self,
        messages: List[Message],
        context: Dict[str, Any],
        db: Session,
    ) -> AsyncGenerator[str, None]:
        """Legacy streaming chat (floating panel).

        Kept for backward compatibility. Delegates to the original tool-use loop
        so existing callers continue to work unchanged.
        """
        system_prompt = self.build_system_prompt(context)
        page = context.get("page", "unknown")
        tools = get_tools_for_page(page)
        executor = ToolExecutor(db)

        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        while True:
            create_kwargs: Dict[str, Any] = {
                "model": self.model,
                "max_tokens": DEFAULT_MAX_TOKENS,
                "system": system_prompt,
                "messages": anthropic_messages,
            }
            if tools:
                create_kwargs["tools"] = tools

            response = await self.client.messages.create(**create_kwargs)

            tool_use_blocks = [
                block for block in response.content if block.type == "tool_use"
            ]

            if not tool_use_blocks:
                for block in response.content:
                    if hasattr(block, "text"):
                        yield block.text
                break

            tool_results = []
            for tool_block in tool_use_blocks:
                result = executor.execute(tool_block.name, tool_block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": str(result),
                })
                yield f"[Using tool: {tool_block.name}]\n"

            anthropic_messages.append({"role": "assistant", "content": response.content})
            anthropic_messages.append({"role": "user", "content": tool_results})

    async def stream_chat(
        self,
        messages: List[Message],
        context: Dict[str, Any],
        db: Session,
    ) -> AsyncGenerator[str, None]:
        """Backward-compatible wrapper -- delegates to chat()."""
        async for chunk in self.chat(messages, context, db):
            yield chunk

    # ------------------------------------------------------------------
    # Joji AI full-page chat with vault context + SSE streaming
    # ------------------------------------------------------------------

    async def chat_stream(
        self,
        db: Session,
        user_id: int,
        message: str,
        conversation_id: Optional[int] = None,
        model_override: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Main Joji AI chat method.

        Yields SSE-formatted event strings. Handles conversation persistence,
        vault search, tool use, and cost tracking.
        """
        model = model_override or self.model
        is_new_conversation = conversation_id is None

        # ------------------------------------------------------------------
        # 1. Load or create conversation
        # ------------------------------------------------------------------
        if conversation_id is not None:
            conversation = (
                db.query(Conversation)
                .filter(
                    Conversation.id == conversation_id,
                    Conversation.user_id == user_id,
                )
                .first()
            )
            if not conversation:
                yield _sse_event("error", {"error": "Conversation not found or access denied"})
                return
        else:
            title = message[:50].strip()
            if len(message) > 50:
                title += "..."
            conversation = Conversation(user_id=user_id, title=title)
            db.add(conversation)
            db.commit()
            db.refresh(conversation)

        # ------------------------------------------------------------------
        # 2. Save user message
        # ------------------------------------------------------------------
        user_msg = ConversationMessage(
            conversation_id=conversation.id,
            role="user",
            content=message,
        )
        db.add(user_msg)
        db.commit()
        db.refresh(user_msg)

        # ------------------------------------------------------------------
        # 3. Search vault for relevant context
        # ------------------------------------------------------------------
        vault_chunks: List[Dict[str, Any]] = []
        vault_chunk_ids: List[int] = []
        try:
            vault_chunks = self.vault_search.search(db, message, top_k=5)
            for chunk in vault_chunks:
                vault_chunk_ids.append(chunk["chunk_id"])
                yield _sse_event("vault_ref", {
                    "chunk_id": chunk["chunk_id"],
                    "file_path": chunk["file_path"],
                    "heading_context": chunk.get("heading_context", ""),
                    "content_preview": chunk["content"][:200],
                })
        except Exception as exc:
            logger.warning("Vault search failed: %s", exc)

        # ------------------------------------------------------------------
        # 4. Build system prompt
        # ------------------------------------------------------------------
        system_prompt = self._build_joji_system_prompt(db, vault_chunks, user_id)

        # ------------------------------------------------------------------
        # 5. Build messages array (last N from conversation history)
        # ------------------------------------------------------------------
        history_messages = (
            db.query(ConversationMessage)
            .filter(
                ConversationMessage.conversation_id == conversation.id,
                ConversationMessage.id != user_msg.id,
            )
            .order_by(ConversationMessage.created_at.desc())
            .limit(CONVERSATION_HISTORY_LIMIT)
            .all()
        )
        # Reverse to chronological order
        history_messages = list(reversed(history_messages))

        anthropic_messages: List[Dict[str, Any]] = [
            {"role": msg.role, "content": msg.content}
            for msg in history_messages
        ]
        # Append the current user message
        anthropic_messages.append({"role": "user", "content": message})

        # ------------------------------------------------------------------
        # 6-7. Call Claude with streaming + handle tool use
        # ------------------------------------------------------------------
        tools = list(get_tools_for_page("all"))  # Copy to avoid mutating the shared list
        # Add Anthropic's built-in server-side web search tool
        tools.append({
            "type": "web_search_20250305",
            "name": "web_search",
            "max_uses": 3,
        })
        executor = ToolExecutor(db)
        full_response_text = ""
        all_tool_calls: List[Dict[str, Any]] = []
        total_input_tokens = 0
        total_output_tokens = 0

        try:
            # Tool use loop -- Claude may request tools multiple times
            max_tool_rounds = 5
            for _round in range(max_tool_rounds):
                create_kwargs: Dict[str, Any] = {
                    "model": model,
                    "max_tokens": DEFAULT_MAX_TOKENS,
                    "system": system_prompt,
                    "messages": anthropic_messages,
                }
                if tools:
                    create_kwargs["tools"] = tools

                async with self.client.messages.stream(**create_kwargs) as stream:
                    tool_use_blocks: List[Any] = []
                    current_tool_input = ""
                    current_tool_name = ""
                    current_tool_id = ""
                    current_block_type = ""

                    async for event in stream:
                        if event.type == "content_block_start":
                            if hasattr(event.content_block, "type"):
                                block_type = event.content_block.type
                                current_block_type = block_type
                                if block_type == "tool_use":
                                    current_tool_name = event.content_block.name
                                    current_tool_id = event.content_block.id
                                    current_tool_input = ""
                                elif block_type == "server_tool_use":
                                    # Server-side tool (web_search) — just notify frontend
                                    server_tool_name = getattr(event.content_block, "name", "web_search")
                                    yield _sse_event("tool_call", {
                                        "tool": server_tool_name,
                                        "args": {},
                                        "server_tool": True,
                                    })

                        elif event.type == "content_block_delta":
                            if hasattr(event.delta, "text"):
                                text = event.delta.text
                                full_response_text += text
                                yield _sse_event("text", {"text": text})
                            elif hasattr(event.delta, "partial_json"):
                                current_tool_input += event.delta.partial_json

                        elif event.type == "content_block_stop":
                            if current_block_type == "web_search_tool_result":
                                # Server-side search results — notify frontend
                                yield _sse_event("tool_result", {
                                    "tool": "web_search",
                                    "result_summary": "Web search completed",
                                    "server_tool": True,
                                })
                            elif current_tool_name:
                                # Regular client-side tool
                                try:
                                    parsed_input = json.loads(current_tool_input) if current_tool_input else {}
                                except json.JSONDecodeError:
                                    parsed_input = {}

                                tool_use_blocks.append({
                                    "id": current_tool_id,
                                    "name": current_tool_name,
                                    "input": parsed_input,
                                })
                                current_tool_name = ""
                                current_tool_id = ""
                                current_tool_input = ""
                            current_block_type = ""

                    # Get the final message for usage stats
                    final_message = await stream.get_final_message()
                    total_input_tokens += final_message.usage.input_tokens
                    total_output_tokens += final_message.usage.output_tokens

                # If no client-side tool use, we're done
                if not tool_use_blocks:
                    break

                # Execute client-side tools and continue conversation
                tool_results = []
                for tool_block in tool_use_blocks:
                    tool_name = tool_block["name"]
                    tool_input = tool_block["input"]

                    yield _sse_event("tool_call", {
                        "tool": tool_name,
                        "args": tool_input,
                    })

                    result = executor.execute(tool_name, tool_input)

                    all_tool_calls.append({
                        "tool": tool_name,
                        "input": tool_input,
                        "result": result,
                    })

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": tool_block["id"],
                        "content": json.dumps(result, default=str),
                    })

                    yield _sse_event("tool_result", {
                        "tool": tool_name,
                        "result_summary": _summarize_tool_result(result),
                    })

                # Add assistant response and tool results to conversation
                anthropic_messages.append({
                    "role": "assistant",
                    "content": final_message.content,
                })
                anthropic_messages.append({
                    "role": "user",
                    "content": tool_results,
                })

                # Reset for next round
                tool_use_blocks = []

        except Exception as exc:
            logger.error("Claude API error: %s", exc, exc_info=True)
            yield _sse_event("error", {"error": str(exc)})
            return

        # ------------------------------------------------------------------
        # 8. Save assistant message
        # ------------------------------------------------------------------
        tokens_used = total_input_tokens + total_output_tokens
        cost_usd = _calculate_cost(model, total_input_tokens, total_output_tokens)

        assistant_msg = ConversationMessage(
            conversation_id=conversation.id,
            role="assistant",
            content=full_response_text,
            model=model,
            tokens_used=tokens_used,
            cost_usd=cost_usd,
            vault_chunks_used=vault_chunk_ids if vault_chunk_ids else None,
            tool_calls_json=all_tool_calls if all_tool_calls else None,
        )
        db.add(assistant_msg)

        # ------------------------------------------------------------------
        # 9. Update conversation metadata
        # ------------------------------------------------------------------
        conversation.updated_at = datetime.utcnow()
        if is_new_conversation and full_response_text:
            # Keep the user-message-based title (already set at creation)
            pass

        # Update user settings with cumulative usage
        settings = (
            db.query(JojiAISettings)
            .filter(JojiAISettings.user_id == user_id)
            .first()
        )
        if settings:
            settings.total_tokens_used = (settings.total_tokens_used or 0) + tokens_used
            settings.total_cost_usd = (settings.total_cost_usd or 0.0) + cost_usd

        db.commit()

        # ------------------------------------------------------------------
        # 10. Sync conversation summary to vault (if 5+ messages)
        # ------------------------------------------------------------------
        try:
            from app.services.crm_vault_sync import CRMVaultSync
            CRMVaultSync().sync_conversation_summary(db, conversation.id)
        except Exception as sync_exc:
            logger.warning("Conversation vault sync failed: %s", sync_exc)

        # ------------------------------------------------------------------
        # 11. Yield done event (before learning so user isn't blocked)
        # ------------------------------------------------------------------
        yield _sse_event("done", {
            "conversation_id": conversation.id,
            "tokens_used": tokens_used,
            "cost_usd": cost_usd,
        })

        # ------------------------------------------------------------------
        # 12. Auto-generate conversation title (first message only)
        # ------------------------------------------------------------------
        is_first_message = conversation_id is None or (
            db.query(ConversationMessage)
            .filter(
                ConversationMessage.conversation_id == conversation.id,
                ConversationMessage.role == "user",
            )
            .count() == 1
        )

        if is_first_message:
            import threading

            def _background_title(conv_id: int, user_msg_text: str, assistant_text: str):
                import asyncio
                from app.database.connection import SessionLocal

                async def _gen_title():
                    try:
                        title_client = AsyncAnthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
                        resp = await title_client.messages.create(
                            model="claude-haiku-4-5-20251001",
                            max_tokens=30,
                            messages=[{
                                "role": "user",
                                "content": (
                                    "Generate a short, descriptive title (3-6 words, no quotes) "
                                    "for this conversation:\n\n"
                                    f"User: {user_msg_text[:300]}\n"
                                    f"Assistant: {assistant_text[:300]}"
                                ),
                            }],
                        )
                        title = resp.content[0].text.strip().strip('"\'')
                        if title:
                            title_db = SessionLocal()
                            try:
                                conv = title_db.query(Conversation).filter(Conversation.id == conv_id).first()
                                if conv:
                                    conv.title = title[:100]
                                    title_db.commit()
                                    logger.info("Auto-titled conversation %d: %s", conv_id, title[:100])
                            finally:
                                title_db.close()
                    except Exception as exc:
                        logger.warning("Auto-title generation failed: %s", exc)

                asyncio.run(_gen_title())

            threading.Thread(
                target=_background_title,
                args=(conversation.id, message, full_response_text),
                daemon=True,
            ).start()

        # ------------------------------------------------------------------
        # 13. Passive learning — runs in background thread so stream closes immediately
        # ------------------------------------------------------------------
        import threading

        def _background_learn(conv_id: int, uid: int):
            from app.database.connection import SessionLocal
            learn_db = SessionLocal()
            try:
                from app.services.conversation_learner import run_learning_cycle
                learn_result = run_learning_cycle(learn_db, conv_id)
                if learn_result and learn_result.get("insights_saved"):
                    logger.info("Learned %d insights from conversation %d",
                                learn_result["insights_saved"], conv_id)
                    # Store result for polling endpoint
                    _learn_results[conv_id] = {"insights_saved": learn_result["insights_saved"]}
            except Exception as learn_exc:
                logger.warning("Learning cycle failed: %s", learn_exc)
            finally:
                learn_db.close()

        threading.Thread(
            target=_background_learn,
            args=(conversation.id, user_id),
            daemon=True,
        ).start()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _build_joji_system_prompt(
        self,
        db: Session,
        vault_chunks: List[Dict[str, Any]],
        user_id: int,
    ) -> str:
        """Build the full Joji AI system prompt with vault context."""
        current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        # Try to find about-me info from vault
        about_section = self._get_about_section(db)

        # Build vault context block
        vault_context = ""
        if vault_chunks:
            sections = []
            for chunk in vault_chunks:
                file_path = chunk.get("file_path", "unknown")
                heading = chunk.get("heading_context", "")
                content = chunk.get("content", "")
                header = f"--- {file_path}"
                if heading:
                    header += f" > {heading}"
                header += " ---"
                sections.append(f"{header}\n{content}")
            vault_context = "\n\n".join(sections)

        # Load user's custom system prompt override
        settings = (
            db.query(JojiAISettings)
            .filter(JojiAISettings.user_id == user_id)
            .first()
        )
        custom_override = ""
        if settings and settings.system_prompt_override:
            custom_override = f"\n\n{settings.system_prompt_override}"

        prompt = (
            f"You are Joji AI, a personal business assistant with access to a knowledge vault and CRM system.\n"
            f"The current date and time is {current_time}.\n\n"
            f"{about_section}\n\n"
        )

        if vault_context:
            prompt += (
                f"KNOWLEDGE BASE (from Obsidian vault):\n"
                f"<vault_context>\n{vault_context}\n</vault_context>\n\n"
            )

        prompt += (
            "You can search the vault for more information, take actions in the CRM, and search the web using the available tools.\n\n"
            "RULES:\n"
            "- Be direct and concise\n"
            "- Australian English\n"
            "- Reference specific vault notes when answering\n"
            "- If you don't know something from memory or the vault, use web_search to look it up\n"
            "- When taking CRM actions, confirm before executing\n\n"
            "WEB SEARCH:\n"
            "You have a web_search tool that searches the internet in real-time. Use it when:\n"
            "- The user asks about current events, prices, or live information\n"
            "- You need to look up a website, company, or person\n"
            "- The vault doesn't have the answer and your training data might be outdated\n"
            "- The user explicitly asks you to search online\n"
            "Always cite your sources when using web search results.\n\n"
            "BRAIN (Knowledge Vault):\n"
            "You have a brain — an Obsidian vault where you store everything you learn about the user.\n"
            "When the user says 'remember', 'note', 'save', 'store', or tells you personal info, preferences, "
            "rates, or anything worth keeping — IMMEDIATELY use the write_vault_file tool to save it. "
            "Do NOT say 'I'll save once the vault syncs' — the tool works right now. Use it.\n\n"
            "When saving:\n"
            "- Use write_vault_file to save IMMEDIATELY — don't defer or wait\n"
            "- Try read_vault_file first to see existing content, then APPEND — never overwrite\n"
            "- If read_vault_file fails, just create a new file with the content\n"
            "- Use these paths:\n"
            "  - Personal info: about-me/profile.md\n"
            "  - Communication style/tone: voice/tone-guide.md\n"
            "  - Phrases and language: voice/phrases-i-use.md\n"
            "  - Pricing: sops/pricing.md\n"
            "  - Sales process: sops/sales-process.md\n"
            "  - Client onboarding: sops/client-onboarding.md\n"
            "  - Tech stack: knowledge/tech-stack.md\n"
            "  - Lessons learned: knowledge/lessons-learned.md\n"
            "  - Business goals/vision: goals/business-vision.md\n"
            "  - For anything else, create a sensible path under the right folder\n"
            "- After saving, confirm briefly: 'Saved to the brain.'"
        )

        prompt += custom_override

        return prompt

    def _get_about_section(self, db: Session) -> str:
        """Search vault for an about-me file. Return first chunk if found, else default."""
        default_about = (
            "ABOUT JOJI:\n"
            "- Australian web developer\n"
            "- Runs Joji Web Solutions\n"
            "- Helps tradies (HVAC, plumbing, electrical, etc.) with their websites\n"
            "- Currently running cold outreach campaigns"
        )

        try:
            about_chunks = self.vault_search.search_by_path(db, "about-me")
            if not about_chunks:
                about_chunks = self.vault_search.search_by_path(db, "about me")
            if about_chunks:
                return f"ABOUT JOJI:\n{about_chunks[0]['content']}"
        except Exception as exc:
            logger.warning("Failed to load about-me from vault: %s", exc)

        return default_about


def _summarize_tool_result(result: Dict[str, Any]) -> str:
    """Create a short summary of a tool result for the SSE event."""
    if "error" in result:
        return f"Error: {result['error']}"
    if "message" in result:
        return result["message"]
    if "tasks" in result:
        return f"Found {len(result['tasks'])} task(s)"
    if "deals" in result:
        return f"Found {len(result['deals'])} deal(s)"
    if "contacts" in result:
        return f"Found {len(result['contacts'])} contact(s)"
    return json.dumps(result, default=str)[:100]


# ---------------------------------------------------------------------------
# Convenience alias so existing imports continue to work
# ---------------------------------------------------------------------------
AIService = JojiAIService
