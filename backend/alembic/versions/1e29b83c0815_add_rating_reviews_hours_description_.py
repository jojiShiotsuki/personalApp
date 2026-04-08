"""add rating reviews hours description maps url to call_prospects

Revision ID: 1e29b83c0815
Revises: 2e1c4d4d27cd
Create Date: 2026-04-08

Adds 5 nullable columns to call_prospects to support rich Google Maps
listing data (populated from Outscraper-style CSV imports):

- rating:          Float, the 0-5 star rating from the listing
- reviews_count:   Integer, the number of reviews
- google_maps_url: String(1000), direct link to the Google Maps listing
- working_hours:   String(1000), pipe-separated "Day: Hours" segments
                   (e.g. "Sun: 8AM-5PM | Mon: 8AM-5PM | ...")
- description:     Text (no length cap — business descriptions can run
                   several paragraphs)

All additive and nullable — safe to run against production.

Written MANUALLY via `alembic revision -m "..."` (no --autogenerate) to
avoid the drift bomb that plagued the last three migrations (see
joji-vault/learnings/2026-04-08-model-db-drift-flag.md). down_revision
pinned to 2e1c4d4d27cd verified via `git log main -- backend/alembic/`.
Idempotent via _column_exists guard matching c377d436de9d pattern.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = "1e29b83c0815"
down_revision: Union[str, None] = "2e1c4d4d27cd"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    conn = op.get_bind()
    insp = inspect(conn)
    columns = [c["name"] for c in insp.get_columns(table)]
    return column in columns


def upgrade() -> None:
    if not _column_exists("call_prospects", "rating"):
        op.add_column(
            "call_prospects",
            sa.Column("rating", sa.Float(), nullable=True),
        )
    if not _column_exists("call_prospects", "reviews_count"):
        op.add_column(
            "call_prospects",
            sa.Column("reviews_count", sa.Integer(), nullable=True),
        )
    if not _column_exists("call_prospects", "google_maps_url"):
        op.add_column(
            "call_prospects",
            sa.Column("google_maps_url", sa.String(length=1000), nullable=True),
        )
    if not _column_exists("call_prospects", "working_hours"):
        op.add_column(
            "call_prospects",
            sa.Column("working_hours", sa.String(length=1000), nullable=True),
        )
    if not _column_exists("call_prospects", "description"):
        op.add_column(
            "call_prospects",
            sa.Column("description", sa.Text(), nullable=True),
        )


def downgrade() -> None:
    if _column_exists("call_prospects", "description"):
        op.drop_column("call_prospects", "description")
    if _column_exists("call_prospects", "working_hours"):
        op.drop_column("call_prospects", "working_hours")
    if _column_exists("call_prospects", "google_maps_url"):
        op.drop_column("call_prospects", "google_maps_url")
    if _column_exists("call_prospects", "reviews_count"):
        op.drop_column("call_prospects", "reviews_count")
    if _column_exists("call_prospects", "rating"):
        op.drop_column("call_prospects", "rating")
