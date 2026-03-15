"""add campaign_search_keywords table

Revision ID: d5b441059794
Revises: 6046b2ee1844
Create Date: 2026-03-15 13:26:54.017617

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5b441059794'
down_revision: Union[str, None] = '6046b2ee1844'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('campaign_search_keywords',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('campaign_id', sa.Integer(), nullable=False),
    sa.Column('category', sa.String(length=255), nullable=False),
    sa.Column('keyword', sa.String(length=500), nullable=False),
    sa.Column('is_searched', sa.Boolean(), server_default='0', nullable=False),
    sa.Column('searched_at', sa.DateTime(), nullable=True),
    sa.Column('leads_found', sa.Integer(), server_default='0', nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaigns.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('campaign_id', 'category', 'keyword', name='uq_campaign_category_keyword')
    )
    op.create_index(op.f('ix_campaign_search_keywords_campaign_id'), 'campaign_search_keywords', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_campaign_search_keywords_id'), 'campaign_search_keywords', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_campaign_search_keywords_id'), table_name='campaign_search_keywords')
    op.drop_index(op.f('ix_campaign_search_keywords_campaign_id'), table_name='campaign_search_keywords')
    op.drop_table('campaign_search_keywords')
