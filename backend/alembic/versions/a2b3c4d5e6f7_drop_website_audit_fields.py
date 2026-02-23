"""drop_website_audit_fields

Revision ID: a2b3c4d5e6f7
Revises: 41f4651c9fc3
Create Date: 2026-02-23 21:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2b3c4d5e6f7'
down_revision: Union[str, None] = '41f4651c9fc3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('outreach_prospects', 'audit_data')
    op.drop_column('outreach_prospects', 'last_audited_at')
    op.drop_column('outreach_prospects', 'website_speed_score')


def downgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('website_speed_score', sa.Integer(), nullable=True))
    op.add_column('outreach_prospects', sa.Column('last_audited_at', sa.DateTime(), nullable=True))
    op.add_column('outreach_prospects', sa.Column('audit_data', sa.JSON(), nullable=True))
