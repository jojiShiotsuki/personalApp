from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, LargeBinary, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class VaultFile(Base):
    __tablename__ = "vault_files"

    id = Column(Integer, primary_key=True, index=True)
    file_path = Column(String(500), nullable=False, unique=True)
    content_hash = Column(String(64), nullable=False)
    last_synced_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    chunks = relationship("VaultChunk", back_populates="vault_file", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<VaultFile(id={self.id}, file_path={self.file_path})>"


class VaultChunk(Base):
    __tablename__ = "vault_chunks"

    id = Column(Integer, primary_key=True, index=True)
    vault_file_id = Column(Integer, ForeignKey("vault_files.id", ondelete="CASCADE"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(LargeBinary, nullable=True)  # stores 512 float32s as bytes
    heading_context = Column(String(500), nullable=True)  # e.g. "SOPs > Pricing > Hourly Rates"
    metadata_json = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    vault_file = relationship("VaultFile", back_populates="chunks")

    def __repr__(self):
        return f"<VaultChunk(id={self.id}, vault_file_id={self.vault_file_id}, chunk_index={self.chunk_index})>"


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    messages = relationship(
        "ConversationMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="ConversationMessage.created_at",
    )

    def __repr__(self):
        return f"<Conversation(id={self.id}, user_id={self.user_id}, title={self.title})>"


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    model = Column(String(100), nullable=True)  # which Claude model generated this
    tool_calls_json = Column(JSON, nullable=True)
    vault_chunks_used = Column(JSON, nullable=True)  # list of chunk IDs referenced
    tokens_used = Column(Integer, nullable=True)
    cost_usd = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    conversation = relationship("Conversation", back_populates="messages")

    def __repr__(self):
        return f"<ConversationMessage(id={self.id}, conversation_id={self.conversation_id}, role={self.role})>"


class JojiAISettings(Base):
    __tablename__ = "joji_ai_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    github_repo_url = Column(String(500), nullable=True)
    github_token_encrypted = Column(Text, nullable=True)
    sync_interval_minutes = Column(Integer, default=30)
    last_sync_at = Column(DateTime, nullable=True)
    last_sync_status = Column(String(30), nullable=True)  # success/failed/in_progress
    last_sync_file_count = Column(Integer, default=0)
    default_model = Column(String(100), default="claude-sonnet-4-6")
    system_prompt_override = Column(Text, nullable=True)
    total_tokens_used = Column(Integer, default=0)
    total_cost_usd = Column(Float, default=0.0)
    last_gmail_vault_sync_at = Column(DateTime, nullable=True)
    gmail_backfill_status = Column(String(30), nullable=True)  # started/in_progress/success/failed
    gmail_backfill_threads = Column(Integer, nullable=True)  # count of threads indexed
    gmail_backfill_error = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<JojiAISettings(id={self.id}, user_id={self.user_id}, default_model={self.default_model})>"
