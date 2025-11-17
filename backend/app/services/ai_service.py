import os
from typing import List, Dict, Any, AsyncGenerator
from anthropic import Anthropic
from sqlalchemy.orm import Session
from app.schemas.ai import Message
from app.services.ai_tools import get_tools_for_page
from app.services.tool_executor import ToolExecutor

class AIService:
    def __init__(self):
        api_key = os.getenv("ANTHROPIC_API_KEY")
        if not api_key:
            raise ValueError("ANTHROPIC_API_KEY environment variable not set")

        self.client = Anthropic(api_key=api_key)
        self.model = os.getenv("ANTHROPIC_MODEL", "claude-3-haiku-20240307")

    def build_system_prompt(self, context: Dict[str, Any]) -> str:
        """Build context-aware system prompt based on current page"""
        page = context.get("page", "unknown")

        base = "You are an AI assistant for Vertex, a personal productivity app."

        page_contexts = {
            "tasks": "You help manage tasks. You can view, create, update, and delete tasks.",
            "deals": "You help manage deals in the CRM. You can view, create, and update deals.",
            "contacts": "You help manage contacts. You can view, create, and update contact information.",
            "projects": "You help manage projects. You can view, create projects and their tasks.",
            "goals": "You help manage goals. You can view and create goals.",
        }

        context_text = page_contexts.get(page, "You provide general assistance.")
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
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                system=system_prompt,
                messages=anthropic_messages,
                tools=tools if tools else None
            )

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
