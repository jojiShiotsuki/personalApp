from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from app.schemas.ai import ChatRequest
from app.services.ai_service import AIService

router = APIRouter(prefix="/api/ai", tags=["ai"])

async def stream_response(ai_service: AIService, request: ChatRequest):
    """Generator for SSE streaming"""
    async for chunk in ai_service.chat(request.messages, request.context):
        # Server-Sent Events format
        yield f"data: {chunk}\n\n"

    # Send completion signal
    yield "data: [DONE]\n\n"

@router.post("/chat")
async def chat(request: ChatRequest):
    """
    Stream AI chat responses using Server-Sent Events.

    Request format:
    {
        "messages": [{"role": "user", "content": "Create a task..."}],
        "context": {"page": "tasks"}
    }
    """
    ai_service = AIService()

    return StreamingResponse(
        stream_response(ai_service, request),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
