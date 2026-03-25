from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List


# Vault File Schemas
class VaultFileResponse(BaseModel):
    id: int
    file_path: str
    content_hash: str
    last_synced_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VaultChunkResponse(BaseModel):
    id: int
    content: str
    heading_context: Optional[str] = None
    file_path: str  # populated from joined VaultFile, not directly from model

    class Config:
        from_attributes = True


# Conversation Schemas
class ConversationCreate(BaseModel):
    title: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    message_count: int = 0  # populated by route, not from model

    class Config:
        from_attributes = True


class ConversationMessageResponse(BaseModel):
    id: int
    role: str
    content: str
    model: Optional[str] = None
    tool_calls_json: Optional[dict] = None
    vault_chunks_used: Optional[list] = None
    tokens_used: Optional[int] = None
    cost_usd: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ConversationWithMessages(BaseModel):
    conversation: ConversationResponse
    messages: List[ConversationMessageResponse]
    total_messages: int


# Chat Schemas
class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_id: Optional[int] = None
    model: Optional[str] = None  # e.g. "claude-sonnet-4-6" or "claude-opus-4-6"


# Settings Schemas
class JojiAISettingsUpdate(BaseModel):
    github_repo_url: Optional[str] = Field(None, max_length=500)
    github_token: Optional[str] = None  # plain text, gets encrypted before storing
    sync_interval_minutes: Optional[int] = Field(None, ge=5, le=1440)
    default_model: Optional[str] = None
    system_prompt_override: Optional[str] = None
    gmail_backfill_status: Optional[str] = None


class JojiAISettingsResponse(BaseModel):
    id: int
    github_repo_url: Optional[str] = None
    has_github_token: bool = False  # True if github_token_encrypted is not None
    sync_interval_minutes: int
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    last_sync_file_count: int
    default_model: str
    system_prompt_override: Optional[str] = None
    total_tokens_used: int
    total_cost_usd: float
    gmail_backfill_status: Optional[str] = None
    gmail_backfill_threads: Optional[int] = None
    gmail_backfill_error: Optional[str] = None
    last_gmail_vault_sync_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# Vault Sync Status
class VaultSyncStatus(BaseModel):
    status: str  # success/failed/in_progress/never_synced
    file_count: int
    last_sync_at: Optional[datetime] = None
