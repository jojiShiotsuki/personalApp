"""add current_step to call_prospects for step-based kanban parity with Multi-Touch

Lets the Cold Calls tab render step-based columns (one per configured
multi_touch_step) when a campaign is selected. Prospects default to step 1;
dragging between columns updates this value.

Additive-only: NOT NULL column with server-side default of 1, so existing
rows backfill automatically without a separate data migration.

Revision ID: c2a3b4d5e6f7
Revises: c1a2b3d4e5f6
Create Date: 2026-04-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c2a3b4d5e6f7"
down_revision: Union[str, None] = "c1a2b3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "call_prospects",
        sa.Column(
            "current_step",
            sa.Integer(),
            nullable=False,
            server_default="1",
        ),
    )


def downgrade() -> None:
    op.drop_column("call_prospects", "current_step")
