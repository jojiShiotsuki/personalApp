"""add email_replied flag to outreach_prospects

Revision ID: a3b4c5d6e7f8
Revises: 1e29b83c0815
Create Date: 2026-04-18

Adds a single boolean column mirroring the existing linkedin_replied flag:

- email_replied: Boolean, default False, server_default "0"

Rationale: the EMAIL_REPLIED step condition previously scanned
prospect_step_log for outcome=="REPLIED", but the only writer of that
outcome value is mark_linkedin_replied — so email replies never satisfied
the condition and LinkedIn replies spuriously did (audit bug_009). This
column is set by mark_replied and gmail_service.poll_inbox, matching the
pattern already used by linkedin_replied.

Additive and nullable at the server layer — safe to run against production.
Written MANUALLY (no --autogenerate) to avoid the drift pattern documented
in joji-vault/learnings/2026-04-08-model-db-drift-flag.md. Idempotent via
_column_exists guard.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "1e29b83c0815"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    columns = [c["name"] for c in insp.get_columns(table)]
    return column in columns


def upgrade() -> None:
    if not _column_exists("outreach_prospects", "email_replied"):
        op.add_column(
            "outreach_prospects",
            sa.Column(
                "email_replied",
                sa.Boolean(),
                server_default="0",
                nullable=True,
            ),
        )


def downgrade() -> None:
    if _column_exists("outreach_prospects", "email_replied"):
        op.drop_column("outreach_prospects", "email_replied")
