"""add retainer to projectstatus enum

Revision ID: c3a1f8b92d4e
Revises: ab9f7222dc43
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c3a1f8b92d4e'
down_revision: str = 'ab9f7222dc43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # For PostgreSQL: add new value to the enum type
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'RETAINER'")


def downgrade() -> None:
    # PostgreSQL doesn't support removing enum values easily
    # This would require recreating the type, which is complex
    pass
