"""add retainer to projectstatus enum

Revision ID: c3a1f8b92d4e
Revises: ab9f7222dc43
Create Date: 2026-02-14

"""
from typing import Sequence, Union

from alembic import op
from alembic import context

# revision identifiers, used by Alembic.
revision: str = 'c3a1f8b92d4e'
down_revision: str = 'ab9f7222dc43'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only needed for PostgreSQL - SQLite stores enums as strings
    if context.get_context().dialect.name == 'postgresql':
        op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'RETAINER'")


def downgrade() -> None:
    pass
