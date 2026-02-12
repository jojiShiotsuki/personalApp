"""add subject column to outreach_templates

Revision ID: w9x0y1z2a3b4
Revises: v8w9x0y1z2a3
Create Date: 2026-02-12
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'w9x0y1z2a3b4'
down_revision = 'v8w9x0y1z2a3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('outreach_templates', sa.Column('subject', sa.String(500), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('outreach_templates', schema=None) as batch_op:
        batch_op.drop_column('subject')
