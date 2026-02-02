"""add cold outreach tables

Revision ID: a1b2c3d4e5f6
Revises: 6538621a9392
Create Date: 2026-02-02 16:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '6538621a9392'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create outreach_campaigns table
    op.create_table(
        'outreach_campaigns',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('status', sa.String(20), default='ACTIVE'),
        sa.Column('step_1_delay', sa.Integer(), default=0),
        sa.Column('step_2_delay', sa.Integer(), default=3),
        sa.Column('step_3_delay', sa.Integer(), default=5),
        sa.Column('step_4_delay', sa.Integer(), default=7),
        sa.Column('step_5_delay', sa.Integer(), default=7),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create outreach_prospects table
    op.create_table(
        'outreach_prospects',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('outreach_campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agency_name', sa.String(255), nullable=False),
        sa.Column('contact_name', sa.String(255), nullable=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('website', sa.String(500), nullable=True),
        sa.Column('niche', sa.String(100), nullable=True),
        sa.Column('custom_fields', sa.JSON(), nullable=True),
        sa.Column('status', sa.String(20), default='QUEUED'),
        sa.Column('current_step', sa.Integer(), default=1),
        sa.Column('next_action_date', sa.Date(), nullable=True),
        sa.Column('last_contacted_at', sa.DateTime(), nullable=True),
        sa.Column('response_type', sa.String(20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create outreach_email_templates table
    op.create_table(
        'outreach_email_templates',
        sa.Column('id', sa.Integer(), primary_key=True, index=True),
        sa.Column('campaign_id', sa.Integer(), sa.ForeignKey('outreach_campaigns.id', ondelete='CASCADE'), nullable=False),
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(500), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Create indexes (skip id columns as they're auto-indexed as primary keys)
    op.create_index('ix_outreach_prospects_campaign_id', 'outreach_prospects', ['campaign_id'])
    op.create_index('ix_outreach_prospects_status', 'outreach_prospects', ['status'])
    op.create_index('ix_outreach_email_templates_campaign_id', 'outreach_email_templates', ['campaign_id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_outreach_email_templates_campaign_id', table_name='outreach_email_templates')
    op.drop_index('ix_outreach_prospects_status', table_name='outreach_prospects')
    op.drop_index('ix_outreach_prospects_campaign_id', table_name='outreach_prospects')

    # Drop tables (in reverse order due to foreign key constraints)
    op.drop_table('outreach_email_templates')
    op.drop_table('outreach_prospects')
    op.drop_table('outreach_campaigns')
