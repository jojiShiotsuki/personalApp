"""add fallback_channel_type to multi_touch_steps

Revision ID: 9a005a764eb2
Revises: a259236b1e1c
Create Date: 2026-03-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '9a005a764eb2'
down_revision: Union[str, None] = 'a259236b1e1c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists("multi_touch_steps", "fallback_channel_type"):
        op.add_column("multi_touch_steps", sa.Column("fallback_channel_type", sa.String(50), nullable=True))


def downgrade() -> None:
    if _column_exists("multi_touch_steps", "fallback_channel_type"):
        op.drop_column("multi_touch_steps", "fallback_channel_type")
