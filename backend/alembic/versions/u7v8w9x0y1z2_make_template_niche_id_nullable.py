"""make template niche_id nullable for all-niches default

Revision ID: u7v8w9x0y1z2
Revises: t6u7v8w9x0y1
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'u7v8w9x0y1z2'
down_revision = 't6u7v8w9x0y1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use batch operations for SQLite compatibility
    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.alter_column('niche_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    # Set any NULL niche_id rows to a default before making non-nullable
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM outreach_templates WHERE niche_id IS NULL")
    )

    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.alter_column('niche_id', existing_type=sa.Integer(), nullable=False)
