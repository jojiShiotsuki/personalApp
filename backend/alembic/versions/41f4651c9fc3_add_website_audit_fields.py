"""add_website_audit_fields

Revision ID: 41f4651c9fc3
Revises: mt_col_widen_02
Create Date: 2026-02-23 19:30:33.643916

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '41f4651c9fc3'
down_revision: Union[str, None] = 'mt_col_widen_02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('website_speed_score', sa.Integer(), nullable=True))
    op.add_column('outreach_prospects', sa.Column('last_audited_at', sa.DateTime(), nullable=True))
    op.add_column('outreach_prospects', sa.Column('audit_data', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('outreach_prospects', 'audit_data')
    op.drop_column('outreach_prospects', 'last_audited_at')
    op.drop_column('outreach_prospects', 'website_speed_score')
