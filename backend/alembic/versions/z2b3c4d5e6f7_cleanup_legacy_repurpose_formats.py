"""cleanup legacy repurpose formats

Remove legacy repurpose format entries (reel, carousel, long_caption) from
content items that already have the new platform-specific equivalents.

Revision ID: z2b3c4d5e6f7
Revises: z1a2b3c4d5e6
Create Date: 2026-03-07
"""
from alembic import op
import json

revision = 'z2b3c4d5e6f7'
down_revision = 'b3c4d5e6f7g8'
branch_labels = None
depends_on = None

LEGACY_TO_NEW = {
    'reel': {'instagram_reel', 'tiktok_reel', 'youtube_short', 'facebook_reel', 'linkedin_reel'},
    'carousel': {'instagram_carousel', 'linkedin_carousel', 'facebook_carousel', 'tiktok_carousel'},
    'long_caption': {'instagram_long_caption', 'tiktok_long_caption', 'facebook_long_caption'},
}


def upgrade():
    conn = op.get_bind()
    rows = conn.execute(
        __import__('sqlalchemy').text(
            "SELECT id, repurpose_formats FROM social_content WHERE repurpose_formats IS NOT NULL"
        )
    ).fetchall()

    for row in rows:
        item_id = row[0]
        raw = row[1]
        if not raw:
            continue

        formats = json.loads(raw) if isinstance(raw, str) else raw
        if not formats:
            continue

        current_ids = {rf['format'] for rf in formats}
        to_remove = set()

        for rf in formats:
            fmt = rf['format']
            if fmt in LEGACY_TO_NEW:
                if current_ids & LEGACY_TO_NEW[fmt]:
                    to_remove.add(fmt)

        if to_remove:
            new_formats = [rf for rf in formats if rf['format'] not in to_remove]
            conn.execute(
                __import__('sqlalchemy').text(
                    "UPDATE social_content SET repurpose_formats = :formats WHERE id = :id"
                ),
                {"formats": json.dumps(new_formats), "id": item_id},
            )


def downgrade():
    # Data migration — cannot reliably restore removed legacy entries
    pass
