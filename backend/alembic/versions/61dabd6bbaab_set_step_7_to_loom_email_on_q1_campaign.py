"""set step 7 to loom_email on q1 campaign

Revision ID: 61dabd6bbaab
Revises: 34a759797a88
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '61dabd6bbaab'
down_revision: Union[str, None] = '34a759797a88'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()

    # Find the Q1 Multi-Touch Outreach campaign
    result = bind.execute(
        sa.text(
            "SELECT id FROM outreach_campaigns "
            "WHERE name = 'Q1 Multi-Touch Outreach' AND campaign_type = 'MULTI_TOUCH' "
            "LIMIT 1"
        )
    ).fetchone()
    if not result:
        return  # Campaign not found, skip

    campaign_id = result[0]

    # Check if step 7 exists
    step7 = bind.execute(
        sa.text(
            "SELECT id FROM multi_touch_steps "
            "WHERE campaign_id = :cid AND step_number = 7"
        ),
        {"cid": campaign_id},
    ).fetchone()

    if step7:
        # Update existing step 7 to LOOM_EMAIL
        bind.execute(
            sa.text(
                "UPDATE multi_touch_steps "
                "SET channel_type = 'LOOM_EMAIL', "
                "    instruction_text = 'Record personalized Loom video audit and send via email' "
                "WHERE campaign_id = :cid AND step_number = 7"
            ),
            {"cid": campaign_id},
        )
    else:
        # Insert step 7 as LOOM_EMAIL
        bind.execute(
            sa.text(
                "INSERT INTO multi_touch_steps "
                "(campaign_id, step_number, channel_type, delay_days, instruction_text, requires_linkedin_connected) "
                "VALUES (:cid, 7, 'LOOM_EMAIL', 2, "
                "'Record personalized Loom video audit and send via email', false)"
            ),
            {"cid": campaign_id},
        )

    # Prospects are NOT touched -- anyone on current_step=7 stays on step 7,
    # they'll just now see the LOOM_EMAIL channel instead of whatever was there before.


def downgrade() -> None:
    # No-op: we don't know what the original channel_type was
    pass
