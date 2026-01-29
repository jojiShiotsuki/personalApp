"""add_is_billable_and_category_to_time_entries

Revision ID: c4c16e8ad2c8
Revises: 88bfe8956133
Create Date: 2025-11-29 09:45:04.931879

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c4c16e8ad2c8'
down_revision: Union[str, None] = '88bfe8956133'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_billable column with default True for existing entries
    op.add_column('time_entries', sa.Column('is_billable', sa.Boolean(), nullable=True, server_default='true'))

    # Add category column
    op.add_column('time_entries', sa.Column('category', sa.String(length=20), nullable=True))

    # Update existing rows to have is_billable = True
    op.execute("UPDATE time_entries SET is_billable = TRUE WHERE is_billable IS NULL")


def downgrade() -> None:
    op.drop_column('time_entries', 'category')
    op.drop_column('time_entries', 'is_billable')
