"""add person fields to call_prospects

Adds person-centric columns (first_name, last_name, position, email,
linkedin_url) so Apollo-style person CSVs can be imported into the cold
calls pipeline. CallProspect was originally business-only (Outscraper
shape) — these additions let a cold call card show "Who am I calling and
what's their job?" rather than just a business name.

All nullable, additive-only. Backfills not required.

Revision ID: e1a2b3c4d5f6
Revises: d1a2b3c4e5f6
Create Date: 2026-04-20 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e1a2b3c4d5f6"
down_revision: Union[str, None] = "d1a2b3c4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("call_prospects", sa.Column("first_name", sa.String(length=100), nullable=True))
    op.add_column("call_prospects", sa.Column("last_name", sa.String(length=100), nullable=True))
    op.add_column("call_prospects", sa.Column("position", sa.String(length=255), nullable=True))
    op.add_column("call_prospects", sa.Column("email", sa.String(length=255), nullable=True))
    op.add_column("call_prospects", sa.Column("linkedin_url", sa.String(length=500), nullable=True))


def downgrade() -> None:
    op.drop_column("call_prospects", "linkedin_url")
    op.drop_column("call_prospects", "email")
    op.drop_column("call_prospects", "position")
    op.drop_column("call_prospects", "last_name")
    op.drop_column("call_prospects", "first_name")
