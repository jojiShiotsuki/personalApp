"""make template situation_id nullable for all-situations default

Revision ID: v8w9x0y1z2a3
Revises: u7v8w9x0y1z2
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'v8w9x0y1z2a3'
down_revision = 'u7v8w9x0y1z2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.alter_column('situation_id', existing_type=sa.Integer(), nullable=True)


def downgrade() -> None:
    connection = op.get_bind()
    connection.execute(
        sa.text("DELETE FROM outreach_templates WHERE situation_id IS NULL")
    )

    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.alter_column('situation_id', existing_type=sa.Integer(), nullable=False)
