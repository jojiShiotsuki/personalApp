"""add loom_script to experiments

Revision ID: 0262c885cd51
Revises: 61dabd6bbaab
Create Date: 2026-03-23

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '0262c885cd51'
down_revision: Union[str, None] = '61dabd6bbaab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def upgrade() -> None:
    if not _column_exists("experiments", "loom_script"):
        op.add_column("experiments", sa.Column("loom_script", sa.Text(), nullable=True))


def downgrade() -> None:
    if _column_exists("experiments", "loom_script"):
        op.drop_column("experiments", "loom_script")
