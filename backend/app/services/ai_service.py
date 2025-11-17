import os
from typing import List, Dict, Any, AsyncGenerator
from anthropic import Anthropic
from app.schemas.ai import Message

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
        tools: List[Dict[str, Any]] = []
    ) -> AsyncGenerator[str, None]:
        """
        Stream chat responses from Claude.
        Yields text chunks as they arrive.
        """
        system_prompt = self.build_system_prompt(context)

        # Convert messages to Anthropic format
        anthropic_messages = [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]

        # For now, just send without tools (we'll add tool use in next task)
        with self.client.messages.stream(
            model=self.model,
            max_tokens=1024,
            system=system_prompt,
            messages=anthropic_messages,
        ) as stream:
            for text in stream.text_stream:
                yield text
