"""add multi_touch enum values to PostgreSQL

Revision ID: mt_enum_vals_01
Revises: 9233bc1a513b
Create Date: 2026-02-23 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
from alembic import context

# revision identifiers, used by Alembic.
revision: str = 'mt_enum_vals_01'
down_revision: Union[str, None] = '9233bc1a513b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only needed for PostgreSQL - SQLite stores enums as strings
    if context.get_context().dialect.name == 'postgresql':
        op.execute("ALTER TYPE campaigntype ADD VALUE IF NOT EXISTS 'MULTI_TOUCH'")
        op.execute("ALTER TYPE prospectstatus ADD VALUE IF NOT EXISTS 'PENDING_CONNECTION'")
        op.execute("ALTER TYPE prospectstatus ADD VALUE IF NOT EXISTS 'CONNECTED'")
        op.execute("ALTER TYPE prospectstatus ADD VALUE IF NOT EXISTS 'PENDING_ENGAGEMENT'")


def downgrade() -> None:
    pass
