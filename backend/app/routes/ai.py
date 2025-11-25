import logging
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.ai import ChatRequest
from app.services.ai_service import AIService
from app.middleware.rate_limit import rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["ai"])


async def stream_response(ai_service: AIService, request: ChatRequest, db: Session):
    """Generator for SSE streaming"""
    try:
        async for chunk in ai_service.chat(request.messages, request.context, db):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"
    except Exception as e:
        logger.error(f"Error in stream_response: {e}")
        yield "data: An error occurred while processing your request.\n\n"


@router.post("/chat")
async def chat(request: ChatRequest, req: Request, db: Session = Depends(get_db)):
    """Stream AI chat responses with tool use and rate limiting"""
    client_id = req.client.host if req.client else "unknown"
    rate_limiter.check_rate_limit(client_id)

    ai_service = AIService()

    return StreamingResponse(
        stream_response(ai_service, request, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
