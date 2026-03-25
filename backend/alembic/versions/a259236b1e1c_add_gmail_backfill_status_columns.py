"""add_gmail_backfill_status_columns

Revision ID: a259236b1e1c
Revises: 68edbcc0dfdf
Create Date: 2026-03-25 09:50:06.920447

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = 'a259236b1e1c'
down_revision: Union[str, None] = '68edbcc0dfdf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    columns = [c["name"] for c in insp.get_columns(table)]
    return column in columns


def upgrade() -> None:
    if not _column_exists("joji_ai_settings", "gmail_backfill_status"):
        op.add_column("joji_ai_settings", sa.Column("gmail_backfill_status", sa.String(30), nullable=True))
    if not _column_exists("joji_ai_settings", "gmail_backfill_threads"):
        op.add_column("joji_ai_settings", sa.Column("gmail_backfill_threads", sa.Integer, nullable=True))
    if not _column_exists("joji_ai_settings", "gmail_backfill_error"):
        op.add_column("joji_ai_settings", sa.Column("gmail_backfill_error", sa.String(500), nullable=True))


def downgrade() -> None:
    if _column_exists("joji_ai_settings", "gmail_backfill_error"):
        op.drop_column("joji_ai_settings", "gmail_backfill_error")
    if _column_exists("joji_ai_settings", "gmail_backfill_threads"):
        op.drop_column("joji_ai_settings", "gmail_backfill_threads")
    if _column_exists("joji_ai_settings", "gmail_backfill_status"):
        op.drop_column("joji_ai_settings", "gmail_backfill_status")
