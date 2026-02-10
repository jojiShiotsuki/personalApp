"""widen prospect niche column from 100 to 500

Revision ID: n0o1p2q3r4s5
Revises: m9n0o1p2q3r4
Create Date: 2026-02-10
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'n0o1p2q3r4s5'
down_revision = 'm9n0o1p2q3r4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('outreach_prospects', 'niche',
                     existing_type=sa.String(100),
                     type_=sa.String(500),
                     existing_nullable=True)


def downgrade() -> None:
    op.alter_column('outreach_prospects', 'niche',
                     existing_type=sa.String(500),
                     type_=sa.String(100),
                     existing_nullable=True)
