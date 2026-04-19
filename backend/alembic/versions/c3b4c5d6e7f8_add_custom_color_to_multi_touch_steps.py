"""add custom_color to multi_touch_steps for user-defined step accent colors

Enables the color picker on CUSTOM (Other...) steps in the sequence
builder. Stores a short palette key like 'cyan', 'rose', 'amber' — the
frontend resolves the key to Tailwind classes. NULL means fall back to
the default cyan accent.

Additive-only, nullable. No backfill.

Revision ID: c3b4c5d6e7f8
Revises: c2a3b4d5e6f7
Create Date: 2026-04-19 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "c3b4c5d6e7f8"
down_revision: Union[str, None] = "c2a3b4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "multi_touch_steps",
        sa.Column("custom_color", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("multi_touch_steps", "custom_color")
