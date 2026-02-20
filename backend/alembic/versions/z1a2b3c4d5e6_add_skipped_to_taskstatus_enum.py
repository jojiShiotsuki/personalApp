"""add skipped to taskstatus enum

Revision ID: z1a2b3c4d5e6
Revises: g8h9i0j1k2l3
Create Date: 2026-02-20

"""
from typing import Sequence, Union

from alembic import op
from alembic import context

# revision identifiers, used by Alembic.
revision: str = 'z1a2b3c4d5e6'
down_revision: str = 'g8h9i0j1k2l3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only needed for PostgreSQL - SQLite stores enums as strings
    if context.get_context().dialect.name == 'postgresql':
        op.execute("ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'SKIPPED'")


def downgrade() -> None:
    pass
