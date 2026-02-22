"""normalize sprint status to lowercase

Revision ID: 761d7f1a240f
Revises: 4d63c7feabf3
Create Date: 2026-02-22 19:05:03.368157

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '761d7f1a240f'
down_revision: Union[str, None] = '4d63c7feabf3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only needed for SQLite where status is stored as plain text.
    # PostgreSQL uses a proper enum type that already constrains values.
    bind = op.get_bind()
    if bind.dialect.name == 'sqlite':
        op.execute("UPDATE sprints SET status = LOWER(status) WHERE status != LOWER(status)")


def downgrade() -> None:
    # No rollback needed — lowercase status values are the correct format
    pass
