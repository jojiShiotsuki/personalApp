import os
from datetime import datetime
from typing import List, Dict, Any, AsyncGenerator
from anthropic import AsyncAnthropic
from sqlalchemy.orm import Session
from app.schemas.ai import Message
from app.services.ai_tools import get_tools_for_page
from app.services.tool_executor import ToolExecutor

class AIService:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = AsyncAnthropic(api_key=api_key)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

    def build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build context-aware system prompt based on current page"""
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
        db: Session
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat responses from Claude with tool use support.
        """
        system_prompt = self.build_system_prompt(context)
        page = context.get("page", "unknown")
        tools = get_tools_for_page(page)
        executor = ToolExecutor(db)

        # Convert messages to Anthropic format
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        # Tool use loop
        while True:
            create_kwargs = {
                "model": self.model,
                "max_tokens": 1024,
                "system": system_prompt,
                "messages": anthropic_messages,
            }
            if tools:
                create_kwargs["tools"] = tools

            response = await self.client.messages.create(**create_kwargs)

            # Check if Claude wants to use tools
            tool_use_blocks = [block for block in response.content if block.type == "tool_use"]

            if not tool_use_blocks:
                # No tools used, stream final text response
                for block in response.content:
                    if hasattr(block, "text"):
                        yield block.text
                break

            # Execute tools
            tool_results = []
            for tool_block in tool_use_blocks:
                result = executor.execute(tool_block.name, tool_block.input)
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": str(result)
                })

                # Yield status update
                yield f"[Using tool: {tool_block.name}]\n"

            # Add assistant response and tool results to conversation
            anthropic_messages.append({"role": "assistant", "content": response.content})
            anthropic_messages.append({"role": "user", "content": tool_results})
