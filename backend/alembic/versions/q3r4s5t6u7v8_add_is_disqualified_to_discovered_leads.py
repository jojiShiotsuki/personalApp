"""add is_disqualified to discovered_leads

Revision ID: q3r4s5t6u7v8
Revises: p2q3r4s5t6u7
Create Date: 2026-02-11
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'q3r4s5t6u7v8'
down_revision = 'p2q3r4s5t6u7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('discovered_leads',
                   sa.Column('is_disqualified', sa.Boolean(),
                             nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('discovered_leads', 'is_disqualified')
