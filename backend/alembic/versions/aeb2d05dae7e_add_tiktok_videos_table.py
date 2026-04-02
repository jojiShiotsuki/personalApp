"""add tiktok_videos table

Revision ID: aeb2d05dae7e
Revises: deal_nullable_01
Create Date: 2026-04-02 17:37:19.664038

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'aeb2d05dae7e'
down_revision: Union[str, None] = 'deal_nullable_01'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('tiktok_videos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tiktok_id', sa.String(), nullable=False),
        sa.Column('caption', sa.Text(), nullable=True),
        sa.Column('hashtags', sa.JSON(), nullable=True),
        sa.Column('create_time', sa.DateTime(), nullable=True),
        sa.Column('views', sa.Integer(), nullable=True),
        sa.Column('likes', sa.Integer(), nullable=True),
        sa.Column('comments', sa.Integer(), nullable=True),
        sa.Column('shares', sa.Integer(), nullable=True),
        sa.Column('saves', sa.Integer(), nullable=True),
        sa.Column('video_duration', sa.Integer(), nullable=True),
        sa.Column('sound_name', sa.String(), nullable=True),
        sa.Column('raw_data', sa.JSON(), nullable=True),
        sa.Column('imported_at', sa.DateTime(), nullable=True),
        sa.Column('social_content_id', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['social_content_id'], ['social_content.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_tiktok_videos_create_time'), 'tiktok_videos', ['create_time'], unique=False)
    op.create_index(op.f('ix_tiktok_videos_id'), 'tiktok_videos', ['id'], unique=False)
    op.create_index(op.f('ix_tiktok_videos_social_content_id'), 'tiktok_videos', ['social_content_id'], unique=False)
    op.create_index(op.f('ix_tiktok_videos_tiktok_id'), 'tiktok_videos', ['tiktok_id'], unique=True)
    op.create_index('ix_tiktok_videos_views', 'tiktok_videos', ['views'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_tiktok_videos_views', table_name='tiktok_videos')
    op.drop_index(op.f('ix_tiktok_videos_tiktok_id'), table_name='tiktok_videos')
    op.drop_index(op.f('ix_tiktok_videos_social_content_id'), table_name='tiktok_videos')
    op.drop_index(op.f('ix_tiktok_videos_id'), table_name='tiktok_videos')
    op.drop_index(op.f('ix_tiktok_videos_create_time'), table_name='tiktok_videos')
    op.drop_table('tiktok_videos')
