"""make prospect email nullable for contact-form leads

Revision ID: p2q3r4s5t6u7
Revises: o1p2q3r4s5t6
Create Date: 2026-02-11
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'p2q3r4s5t6u7'
down_revision = 'o1p2q3r4s5t6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('outreach_prospects', 'email',
                     existing_type=sa.String(255),
                     nullable=True)


def downgrade() -> None:
    op.alter_column('outreach_prospects', 'email',
                     existing_type=sa.String(255),
                     nullable=False)
