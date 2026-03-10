"""make outreach_prospects email nullable

Revision ID: a2e704b973a0
Revises: a3b4c5d6e7f8
Create Date: 2026-03-10 14:46:49.991580

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2e704b973a0'
down_revision: Union[str, None] = 'a3b4c5d6e7f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # For PostgreSQL (production)
    op.alter_column('outreach_prospects', 'email',
               existing_type=sa.VARCHAR(length=255),
               nullable=True)


def downgrade() -> None:
    op.alter_column('outreach_prospects', 'email',
               existing_type=sa.VARCHAR(length=255),
               nullable=False)
