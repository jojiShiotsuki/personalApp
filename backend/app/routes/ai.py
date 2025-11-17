from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.ai import ChatRequest
from app.services.ai_service import AIService

router = APIRouter(prefix="/api/ai", tags=["ai"])

async def stream_response(ai_service: AIService, request: ChatRequest, db: Session):
    """Generator for SSE streaming"""
    async for chunk in ai_service.chat(request.messages, request.context, db):
        # Server-Sent Events format
        yield f"data: {chunk}\n\n"

    # Send completion signal
    yield "data: [DONE]\n\n"

@router.post("/chat")
async def chat(request: ChatRequest, db: Session = Depends(get_db)):
    """Stream AI chat responses with tool use support"""
    ai_service = AIService()

    return StreamingResponse(
        stream_response(ai_service, request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
