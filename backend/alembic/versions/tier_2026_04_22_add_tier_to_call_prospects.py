"""add tier to call_prospects

Adds tier (nullable String(30)) column for the Cold Calls tier-tagging
feature. Stores ProspectTier enum values as strings (S_TIER_FLAGSHIP,
A_TIER_FLAGSHIP, B_TIER_FLAGSHIP, COMMERCIAL_SPECIALIST, DEVELOPMENTAL).
No index — low cardinality, client-side sort/filter.

Revision ID: tier_2026_04_22
Revises: cb_tracking_2026_04_22
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'tier_2026_04_22'
down_revision = 'cb_tracking_2026_04_22'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'call_prospects',
        sa.Column('tier', sa.String(length=30), nullable=True),
    )


def downgrade() -> None:
    with op.batch_alter_table('call_prospects', schema=None) as batch_op:
        batch_op.drop_column('tier')
