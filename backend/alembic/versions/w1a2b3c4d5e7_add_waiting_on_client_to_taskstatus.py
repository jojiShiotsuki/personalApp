"""add waiting_on_client to taskstatus enum

Revision ID: w1a2b3c4d5e7
Revises: z1a2b3c4d5e6
Create Date: 2026-02-22

"""
from typing import Sequence, Union

from alembic import op
from alembic import context

# revision identifiers, used by Alembic.
revision: str = 'w1a2b3c4d5e7'
down_revision: str = 'ee9fc7509224'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only needed for PostgreSQL - SQLite stores enums as strings
    if context.get_context().dialect.name == 'postgresql':
        op.execute("ALTER TYPE taskstatus ADD VALUE IF NOT EXISTS 'WAITING_ON_CLIENT'")


def downgrade() -> None:
    pass
