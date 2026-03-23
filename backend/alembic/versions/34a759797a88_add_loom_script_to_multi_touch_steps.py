"""add loom_script to multi_touch_steps

Revision ID: 34a759797a88
Revises: bb85f57d43bd
Create Date: 2026-03-23 11:09:06.461808

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '34a759797a88'
down_revision: Union[str, None] = 'bb85f57d43bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    """Check if a column already exists (works for both SQLite and PostgreSQL)."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists("multi_touch_steps", "loom_script"):
        op.add_column("multi_touch_steps", sa.Column("loom_script", sa.Text(), nullable=True))


def downgrade() -> None:
    if _column_exists("multi_touch_steps", "loom_script"):
        op.drop_column("multi_touch_steps", "loom_script")
