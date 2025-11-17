from typing import List, Dict, Any, Optional
from pydantic import BaseModel

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    messages: List[Message]
    context: Dict[str, Any] = {}

class ChatResponse(BaseModel):
    message: str
    tool_calls: List[Dict[str, Any]] = []
