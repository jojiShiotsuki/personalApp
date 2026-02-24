"""add custom_email_subject and custom_email_body to outreach_prospects

Revision ID: 4cd265026001
Revises: 3cd265026000
Create Date: 2026-02-24 11:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4cd265026001'
down_revision: Union[str, None] = '3cd265026000'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns only if they don't already exist (they exist locally but not on Render)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_columns = [col['name'] for col in inspector.get_columns('outreach_prospects')]

    if 'custom_email_subject' not in existing_columns:
        op.add_column('outreach_prospects', sa.Column('custom_email_subject', sa.String(500), nullable=True))
    if 'custom_email_body' not in existing_columns:
        op.add_column('outreach_prospects', sa.Column('custom_email_body', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('outreach_prospects', 'custom_email_body')
    op.drop_column('outreach_prospects', 'custom_email_subject')
