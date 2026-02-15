"""add campaign_type and linkedin prospect statuses

Revision ID: 5186f2c72fce
Revises: e1f2a3b4c5d6
Create Date: 2026-02-15 07:54:08.574980

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5186f2c72fce'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add campaign_type column to outreach_campaigns (default EMAIL for existing)
    op.add_column('outreach_campaigns', sa.Column('campaign_type', sa.String(10), nullable=False, server_default='EMAIL'))


def downgrade() -> None:
    op.drop_column('outreach_campaigns', 'campaign_type')
