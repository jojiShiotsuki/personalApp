"""add campaign_id FK to call_prospects for Outreach Hub campaign selector parity

Adds a nullable campaign_id column on call_prospects referencing
outreach_campaigns(id) with ON DELETE SET NULL, plus a supporting index.

This enables the Cold Calls tab to group prospects by campaign (same UX as
LinkedIn/Multi-Touch). The new campaign_type 'COLD_CALLS' is added at the
Python enum level only — campaign_type is stored as String(20) since the
mt_col_widen_02 migration, so no PostgreSQL enum ALTER is required.

No backfill: existing rows keep campaign_id NULL and display under
"All Campaigns" in the UI.

Revision ID: c1a2b3d4e5f6
Revises: b7e1f2d8a9c0
Create Date: 2026-04-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c1a2b3d4e5f6"
down_revision: Union[str, None] = "b7e1f2d8a9c0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add nullable campaign_id FK. SET NULL on delete so we never orphan
    # call prospects if a campaign is removed — they just return to the
    # "unassigned" bucket.
    op.add_column(
        "call_prospects",
        sa.Column("campaign_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_call_prospects_campaign_id",
        "call_prospects",
        "outreach_campaigns",
        ["campaign_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_call_prospects_campaign_id",
        "call_prospects",
        ["campaign_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_call_prospects_campaign_id", table_name="call_prospects")
    op.drop_constraint(
        "fk_call_prospects_campaign_id",
        "call_prospects",
        type_="foreignkey",
    )
    op.drop_column("call_prospects", "campaign_id")
