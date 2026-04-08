"""add archived_at and archived_reason to outreach_prospects

Revision ID: c377d436de9d
Revises: b266c325cd8c
Create Date: 2026-04-07

Adds two nullable columns to support the PH/US market pivot (2026-04-07):
- archived_at:     timestamp when the prospect was archived
- archived_reason: free-text reason (e.g. 'pivot to PH/US markets 2026-04-07')

The `status` column is varchar(20) — not a native Postgres enum — so no
ALTER TYPE is needed to accept the new 'ARCHIVED' value. The Python-level
ProspectStatus enum in app/models/outreach.py is updated separately in
application code.

Idempotent: safe to run multiple times via the _column_exists guard.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "c377d436de9d"
down_revision: Union[str, None] = "e4a8b1c9d201"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    columns = [c["name"] for c in insp.get_columns(table)]
    return column in columns


def upgrade() -> None:
    if not _column_exists("outreach_prospects", "archived_at"):
        op.add_column(
            "outreach_prospects",
            sa.Column("archived_at", sa.DateTime(), nullable=True),
        )
    if not _column_exists("outreach_prospects", "archived_reason"):
        op.add_column(
            "outreach_prospects",
            sa.Column("archived_reason", sa.String(length=255), nullable=True),
        )


def downgrade() -> None:
    if _column_exists("outreach_prospects", "archived_reason"):
        op.drop_column("outreach_prospects", "archived_reason")
    if _column_exists("outreach_prospects", "archived_at"):
        op.drop_column("outreach_prospects", "archived_at")
