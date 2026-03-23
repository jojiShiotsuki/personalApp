"""add joji ai tables

Revision ID: 4cbfe8525ec5
Revises: 0262c885cd51
Create Date: 2026-03-23 17:01:28.806324

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = '4cbfe8525ec5'
down_revision: Union[str, None] = '0262c885cd51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table_name: str) -> bool:
    """Check if a table already exists."""
    bind = op.get_bind()
    insp = inspect(bind)
    return table_name in insp.get_table_names()


def upgrade() -> None:
    # Vault files (no FK dependencies on other new tables)
    if not _table_exists('vault_files'):
        op.create_table('vault_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('file_path', sa.String(length=500), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('last_synced_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('file_path')
        )
        op.create_index(op.f('ix_vault_files_id'), 'vault_files', ['id'], unique=False)

    # Conversations (FK to users)
    if not _table_exists('conversations'):
        op.create_table('conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_conversations_id'), 'conversations', ['id'], unique=False)
        op.create_index(op.f('ix_conversations_user_id'), 'conversations', ['user_id'], unique=False)

    # Joji AI settings (FK to users)
    if not _table_exists('joji_ai_settings'):
        op.create_table('joji_ai_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('github_repo_url', sa.String(length=500), nullable=True),
        sa.Column('github_token_encrypted', sa.Text(), nullable=True),
        sa.Column('sync_interval_minutes', sa.Integer(), nullable=True),
        sa.Column('last_sync_at', sa.DateTime(), nullable=True),
        sa.Column('last_sync_status', sa.String(length=30), nullable=True),
        sa.Column('last_sync_file_count', sa.Integer(), nullable=True),
        sa.Column('default_model', sa.String(length=100), nullable=True),
        sa.Column('system_prompt_override', sa.Text(), nullable=True),
        sa.Column('total_tokens_used', sa.Integer(), nullable=True),
        sa.Column('total_cost_usd', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id')
        )
        op.create_index(op.f('ix_joji_ai_settings_id'), 'joji_ai_settings', ['id'], unique=False)

    # Vault chunks (FK to vault_files)
    if not _table_exists('vault_chunks'):
        op.create_table('vault_chunks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('vault_file_id', sa.Integer(), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', sa.LargeBinary(), nullable=True),
        sa.Column('heading_context', sa.String(length=500), nullable=True),
        sa.Column('metadata_json', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['vault_file_id'], ['vault_files.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_vault_chunks_id'), 'vault_chunks', ['id'], unique=False)
        op.create_index(op.f('ix_vault_chunks_vault_file_id'), 'vault_chunks', ['vault_file_id'], unique=False)

    # Conversation messages (FK to conversations)
    if not _table_exists('conversation_messages'):
        op.create_table('conversation_messages',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('conversation_id', sa.Integer(), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('model', sa.String(length=100), nullable=True),
        sa.Column('tool_calls_json', sa.JSON(), nullable=True),
        sa.Column('vault_chunks_used', sa.JSON(), nullable=True),
        sa.Column('tokens_used', sa.Integer(), nullable=True),
        sa.Column('cost_usd', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
        )
        op.create_index(op.f('ix_conversation_messages_conversation_id'), 'conversation_messages', ['conversation_id'], unique=False)
        op.create_index(op.f('ix_conversation_messages_id'), 'conversation_messages', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_conversation_messages_id'), table_name='conversation_messages')
    op.drop_index(op.f('ix_conversation_messages_conversation_id'), table_name='conversation_messages')
    op.drop_table('conversation_messages')

    op.drop_index(op.f('ix_vault_chunks_vault_file_id'), table_name='vault_chunks')
    op.drop_index(op.f('ix_vault_chunks_id'), table_name='vault_chunks')
    op.drop_table('vault_chunks')

    op.drop_index(op.f('ix_joji_ai_settings_id'), table_name='joji_ai_settings')
    op.drop_table('joji_ai_settings')

    op.drop_index(op.f('ix_conversations_user_id'), table_name='conversations')
    op.drop_index(op.f('ix_conversations_id'), table_name='conversations')
    op.drop_table('conversations')

    op.drop_index(op.f('ix_vault_files_id'), table_name='vault_files')
    op.drop_table('vault_files')
