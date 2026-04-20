"""add scheduled_followup_at to nurture_leads

Adds a user-set follow-up date for warm leads. Distinct from next_followup_at
(which is auto-computed by the periodic scheduler from last_action_at).

When scheduled_followup_at is set:
- The scheduler skips auto-computing followup_stage for that lead until the date passes
- The lead is hidden from "Needs Follow-up" until the date arrives
- Once the date passes, the lead resurfaces with a "Scheduled — Due" indicator

Additive-only, nullable. Indexed because the kanban + needs_followup queries
filter/sort on it.

Revision ID: d1a2b3c4e5f6
Revises: c3b4c5d6e7f8
Create Date: 2026-04-20 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d1a2b3c4e5f6"
down_revision: Union[str, None] = "c3b4c5d6e7f8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "nurture_leads",
        sa.Column("scheduled_followup_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_nurture_leads_scheduled_followup_at",
        "nurture_leads",
        ["scheduled_followup_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_nurture_leads_scheduled_followup_at", table_name="nurture_leads")
    op.drop_column("nurture_leads", "scheduled_followup_at")
