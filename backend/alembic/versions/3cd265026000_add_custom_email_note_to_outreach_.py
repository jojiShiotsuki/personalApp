"""add custom_email_note to outreach_prospects

Revision ID: 3cd265026000
Revises: a2b3c4d5e6f7
Create Date: 2026-02-24 09:18:45.883782

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3cd265026000'
down_revision: Union[str, None] = 'a2b3c4d5e6f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('outreach_prospects', sa.Column('custom_email_note', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('outreach_prospects', 'custom_email_note')
