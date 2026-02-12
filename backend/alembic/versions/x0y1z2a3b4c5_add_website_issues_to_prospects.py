"""add website_issues to outreach_prospects

Revision ID: x0y1z2a3b4c5
Revises: w9x0y1z2a3b4
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'x0y1z2a3b4c5'
down_revision = 'w9x0y1z2a3b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('website_issues', sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('outreach_prospects', schema=None) as batch_op:
        batch_op.drop_column('website_issues')
