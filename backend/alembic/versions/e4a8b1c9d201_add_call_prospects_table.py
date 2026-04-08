"""add call_prospects table

Revision ID: e4a8b1c9d201
Revises: c377d436de9d
Create Date: 2026-04-08

Creates the call_prospects table for the Cold Calls pipeline tab in Outreach Hub.

The table backs a desktop-only kanban board for tracking PH service-business
phone prospecting. Stages are stored as plain varchar (not a native enum) so
status values can evolve without ALTER TYPE migrations.

Idempotent: safe to run multiple times via _table_exists guard.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

# revision identifiers, used by Alembic.
revision: str = "e4a8b1c9d201"
down_revision: Union[str, None] = "c377d436de9d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(table: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    return table in insp.get_table_names()


def _index_exists(table: str, index_name: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    return any(ix["name"] == index_name for ix in insp.get_indexes(table))


def upgrade() -> None:
    if _table_exists("call_prospects"):
        return

    op.create_table(
        "call_prospects",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("business_name", sa.String(length=255), nullable=False),
        sa.Column("phone", sa.String(length=50), nullable=True),
        sa.Column("vertical", sa.String(length=100), nullable=True),
        sa.Column("address", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="NEW",
        ),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )

    if not _index_exists("call_prospects", "ix_call_prospects_status"):
        op.create_index(
            "ix_call_prospects_status",
            "call_prospects",
            ["status"],
        )
    if not _index_exists("call_prospects", "ix_call_prospects_status_updated"):
        op.create_index(
            "ix_call_prospects_status_updated",
            "call_prospects",
            ["status", "updated_at"],
        )


def downgrade() -> None:
    if not _table_exists("call_prospects"):
        return
    if _index_exists("call_prospects", "ix_call_prospects_status_updated"):
        op.drop_index(
            "ix_call_prospects_status_updated", table_name="call_prospects"
        )
    if _index_exists("call_prospects", "ix_call_prospects_status"):
        op.drop_index("ix_call_prospects_status", table_name="call_prospects")
    op.drop_table("call_prospects")
