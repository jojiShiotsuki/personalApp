"""add multi_touch_steps table

Revision ID: 9233bc1a513b
Revises: b3d75cfef794
Create Date: 2026-02-23 15:13:19.433007

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9233bc1a513b'
down_revision: Union[str, None] = 'b3d75cfef794'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'multi_touch_steps',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('outreach_campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('channel_type', sa.String(50), nullable=False),
        sa.Column('delay_days', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('template_subject', sa.String(500), nullable=True),
        sa.Column('template_content', sa.Text(), nullable=True),
        sa.Column('instruction_text', sa.String(500), nullable=True),
        sa.UniqueConstraint('campaign_id', 'step_number', name='uq_campaign_step_number'),
    )
    op.create_index('ix_multi_touch_steps_id', 'multi_touch_steps', ['id'])
    op.create_index('ix_multi_touch_steps_campaign_id', 'multi_touch_steps', ['campaign_id'])


def downgrade() -> None:
    op.drop_index('ix_multi_touch_steps_campaign_id', table_name='multi_touch_steps')
    op.drop_index('ix_multi_touch_steps_id', table_name='multi_touch_steps')
    op.drop_table('multi_touch_steps')
