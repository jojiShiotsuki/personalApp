"""add website_issues to discovered_leads

Revision ID: o1p2q3r4s5t6
Revises: n0o1p2q3r4s5
Create Date: 2026-02-11
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'o1p2q3r4s5t6'
down_revision = 'n0o1p2q3r4s5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('discovered_leads', sa.Column('website_issues', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('discovered_leads', 'website_issues')
