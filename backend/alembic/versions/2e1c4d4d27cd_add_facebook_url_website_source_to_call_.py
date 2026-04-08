"""add facebook_url website source to call_prospects

Revision ID: 2e1c4d4d27cd
Revises: c377d436de9d
Create Date: 2026-04-08

Adds three nullable columns to call_prospects to support manual single-prospect
entry from Facebook Ads scouting (the "+ Add Lead" form):

- facebook_url: link to the prospect's Facebook business page (varchar 500)
- website:      prospect's website URL (varchar 500)
- source:       free-text source label e.g. "FB Ads", "Outscraper" (varchar 100)

All three columns are nullable and have no server default — purely additive,
fully reversible, safe to run against production.

This migration was MANUALLY scrubbed: alembic --autogenerate produced a file
laden with unrelated drift (drops of yesterday's archived_at/archived_reason
columns, enum coercions across half the schema, spurious index adds). Only
the call_prospects column adds are intended. Down_revision is pinned to the
committed head c377d436de9d (verified via `git log main -- backend/alembic/`).

Idempotent via the _column_exists guard, matching the pattern in
c377d436de9d_add_archived_at_and_archived_reason_to_.py.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "2e1c4d4d27cd"
down_revision: Union[str, None] = "c377d436de9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    columns = [c["name"] for c in insp.get_columns(table)]
    return column in columns


def upgrade() -> None:
    if not _column_exists("call_prospects", "facebook_url"):
        op.add_column(
            "call_prospects",
            sa.Column("facebook_url", sa.String(length=500), nullable=True),
        )
    if not _column_exists("call_prospects", "website"):
        op.add_column(
            "call_prospects",
            sa.Column("website", sa.String(length=500), nullable=True),
        )
    if not _column_exists("call_prospects", "source"):
        op.add_column(
            "call_prospects",
            sa.Column("source", sa.String(length=100), nullable=True),
        )


def downgrade() -> None:
    if _column_exists("call_prospects", "source"):
        op.drop_column("call_prospects", "source")
    if _column_exists("call_prospects", "website"):
        op.drop_column("call_prospects", "website")
    if _column_exists("call_prospects", "facebook_url"):
        op.drop_column("call_prospects", "facebook_url")
