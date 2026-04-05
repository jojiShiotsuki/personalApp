"""add nurture_leads and nurture_step_logs tables

Revision ID: 56d79db09d6c
Revises: aeb2d05dae7e
Create Date: 2026-04-05 09:02:37.087437

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '56d79db09d6c'
down_revision: Union[str, None] = 'aeb2d05dae7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('nurture_leads',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('prospect_id', sa.Integer(), nullable=False),
    sa.Column('contact_id', sa.Integer(), nullable=True),
    sa.Column('deal_id', sa.Integer(), nullable=True),
    sa.Column('campaign_id', sa.Integer(), nullable=False),
    sa.Column('source_channel', sa.String(length=50), nullable=True),
    sa.Column('current_step', sa.Integer(), nullable=False),
    sa.Column('status', sa.Enum('ACTIVE', 'QUIET', 'LONG_TERM', 'CONVERTED', 'LOST', name='nurturestatus'), nullable=False),
    sa.Column('quiet_since', sa.DateTime(), nullable=True),
    sa.Column('last_action_at', sa.DateTime(), nullable=False),
    sa.Column('next_followup_at', sa.DateTime(), nullable=True),
    sa.Column('followup_stage', sa.Enum('DAY_2', 'DAY_5', 'DAY_10', 'LONG_TERM', name='followupstage'), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaigns.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['deal_id'], ['crm_deals.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['prospect_id'], ['outreach_prospects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nurture_leads_campaign_id'), 'nurture_leads', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_nurture_leads_contact_id'), 'nurture_leads', ['contact_id'], unique=False)
    op.create_index(op.f('ix_nurture_leads_deal_id'), 'nurture_leads', ['deal_id'], unique=False)
    op.create_index('ix_nurture_leads_followup_stage', 'nurture_leads', ['followup_stage'], unique=False)
    op.create_index(op.f('ix_nurture_leads_id'), 'nurture_leads', ['id'], unique=False)
    op.create_index(op.f('ix_nurture_leads_prospect_id'), 'nurture_leads', ['prospect_id'], unique=True)
    op.create_index('ix_nurture_leads_status', 'nurture_leads', ['status'], unique=False)
    op.create_table('nurture_step_logs',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('nurture_lead_id', sa.Integer(), nullable=False),
    sa.Column('step_number', sa.Integer(), nullable=False),
    sa.Column('completed_at', sa.DateTime(), nullable=True),
    sa.Column('notes', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['nurture_lead_id'], ['nurture_leads.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nurture_step_logs_id'), 'nurture_step_logs', ['id'], unique=False)
    op.create_index(op.f('ix_nurture_step_logs_nurture_lead_id'), 'nurture_step_logs', ['nurture_lead_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_nurture_step_logs_nurture_lead_id'), table_name='nurture_step_logs')
    op.drop_index(op.f('ix_nurture_step_logs_id'), table_name='nurture_step_logs')
    op.drop_table('nurture_step_logs')
    op.drop_index('ix_nurture_leads_status', table_name='nurture_leads')
    op.drop_index(op.f('ix_nurture_leads_prospect_id'), table_name='nurture_leads')
    op.drop_index(op.f('ix_nurture_leads_id'), table_name='nurture_leads')
    op.drop_index('ix_nurture_leads_followup_stage', table_name='nurture_leads')
    op.drop_index(op.f('ix_nurture_leads_deal_id'), table_name='nurture_leads')
    op.drop_index(op.f('ix_nurture_leads_contact_id'), table_name='nurture_leads')
    op.drop_index(op.f('ix_nurture_leads_campaign_id'), table_name='nurture_leads')
    op.drop_table('nurture_leads')
