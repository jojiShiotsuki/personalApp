"""update loom target default to 1

Revision ID: i5j6k7l8m9n0
Revises: h5i6j7k8l9m0
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'i5j6k7l8m9n0'
down_revision: Union[str, None] = 'h5i6j7k8l9m0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Update existing outreach_settings to have loom target of 1 (playbook default)
    op.execute("UPDATE outreach_settings SET daily_loom_target = 1 WHERE daily_loom_target = 2")

    # Update existing daily_outreach_logs to have loom target of 1
    op.execute("UPDATE daily_outreach_logs SET target_looms = 1 WHERE target_looms = 2")


def downgrade() -> None:
    # Revert to old default of 2
    op.execute("UPDATE outreach_settings SET daily_loom_target = 2 WHERE daily_loom_target = 1")
    op.execute("UPDATE daily_outreach_logs SET target_looms = 2 WHERE target_looms = 1")
