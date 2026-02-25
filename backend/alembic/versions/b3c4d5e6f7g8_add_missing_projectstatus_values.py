"""add missing projectstatus enum values

Revision ID: b3c4d5e6f7g8
Revises: 4cd265026001
Create Date: 2026-02-25 10:35:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'b3c4d5e6f7g8'
down_revision: Union[str, None] = '4cd265026001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing enum values to the projectstatus Postgres enum
    # IF NOT EXISTS prevents errors if already present (safe for re-runs)
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'SCOPING'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'REVIEW'")
    op.execute("ALTER TYPE projectstatus ADD VALUE IF NOT EXISTS 'REVISIONS'")


def downgrade() -> None:
    # Postgres doesn't support removing enum values easily
    # Would require recreating the type, which is destructive
    pass
