"""add last_gmail_vault_sync_at to joji_ai_settings

Revision ID: c4d5e6f7g8h9
Revises: b325cd94d1be
Create Date: 2026-03-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = 'c4d5e6f7g8h9'
down_revision: Union[str, None] = 'b325cd94d1be'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists in a table."""
    bind = op.get_bind()
    insp = inspect(bind)
    columns = [c["name"] for c in insp.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists('joji_ai_settings', 'last_gmail_vault_sync_at'):
        op.add_column(
            'joji_ai_settings',
            sa.Column('last_gmail_vault_sync_at', sa.DateTime(), nullable=True),
        )


def downgrade() -> None:
    if _column_exists('joji_ai_settings', 'last_gmail_vault_sync_at'):
        op.drop_column('joji_ai_settings', 'last_gmail_vault_sync_at')
