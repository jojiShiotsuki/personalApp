"""add autoresearch tables

Revision ID: 012874046c48
Revises: 026f9698e123
Create Date: 2026-03-19 15:25:02.571825

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '012874046c48'
down_revision: Union[str, None] = '026f9698e123'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Insights (no FK dependencies on other new tables)
    op.create_table('insights',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('insight', sa.Text(), nullable=False),
    sa.Column('confidence', sa.String(length=20), nullable=True),
    sa.Column('sample_size', sa.Integer(), nullable=True),
    sa.Column('recommendation', sa.Text(), nullable=True),
    sa.Column('applies_to', sa.String(length=100), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('experiment_count_at_refresh', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('superseded_by', sa.Integer(), nullable=True),
    sa.ForeignKeyConstraint(['superseded_by'], ['insights.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_insights_id'), 'insights', ['id'], unique=False)

    # Autoresearch settings (FK to users)
    op.create_table('autoresearch_settings',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('audit_prompt', sa.Text(), nullable=True),
    sa.Column('audit_model', sa.String(length=100), nullable=True),
    sa.Column('classifier_model', sa.String(length=100), nullable=True),
    sa.Column('learning_model', sa.String(length=100), nullable=True),
    sa.Column('min_page_load_wait', sa.Integer(), nullable=True),
    sa.Column('enable_pass_2', sa.Boolean(), nullable=True),
    sa.Column('max_batch_size', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_autoresearch_settings_id'), 'autoresearch_settings', ['id'], unique=False)

    # Gmail tokens (FK to users)
    op.create_table('gmail_tokens',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('email_address', sa.String(length=255), nullable=False),
    sa.Column('encrypted_refresh_token', sa.Text(), nullable=False),
    sa.Column('last_poll_at', sa.DateTime(), nullable=True),
    sa.Column('last_history_id', sa.String(length=100), nullable=True),
    sa.Column('is_active', sa.Boolean(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_gmail_tokens_id'), 'gmail_tokens', ['id'], unique=False)

    # Audit results (FK to outreach_prospects, outreach_campaigns)
    op.create_table('audit_results',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('prospect_id', sa.Integer(), nullable=False),
    sa.Column('campaign_id', sa.Integer(), nullable=False),
    sa.Column('issue_type', sa.String(length=100), nullable=True),
    sa.Column('issue_detail', sa.Text(), nullable=True),
    sa.Column('secondary_issue', sa.String(length=100), nullable=True),
    sa.Column('secondary_detail', sa.Text(), nullable=True),
    sa.Column('confidence', sa.String(length=20), nullable=True),
    sa.Column('site_quality', sa.String(length=20), nullable=True),
    sa.Column('needs_verification', sa.Boolean(), nullable=True),
    sa.Column('pass_2_completed', sa.Boolean(), nullable=True),
    sa.Column('generated_subject', sa.String(length=500), nullable=True),
    sa.Column('generated_body', sa.Text(), nullable=True),
    sa.Column('word_count', sa.Integer(), nullable=True),
    sa.Column('desktop_screenshot', sa.Text(), nullable=True),
    sa.Column('mobile_screenshot', sa.Text(), nullable=True),
    sa.Column('verification_screenshots', sa.JSON(), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=True),
    sa.Column('rejection_reason', sa.Text(), nullable=True),
    sa.Column('was_edited', sa.Boolean(), nullable=True),
    sa.Column('edited_subject', sa.String(length=500), nullable=True),
    sa.Column('edited_body', sa.Text(), nullable=True),
    sa.Column('audit_duration_seconds', sa.Float(), nullable=True),
    sa.Column('model_used', sa.String(length=100), nullable=True),
    sa.Column('tokens_used', sa.Integer(), nullable=True),
    sa.Column('ai_cost_estimate', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaigns.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['prospect_id'], ['outreach_prospects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_audit_results_campaign_id'), 'audit_results', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_audit_results_id'), 'audit_results', ['id'], unique=False)
    op.create_index(op.f('ix_audit_results_prospect_id'), 'audit_results', ['prospect_id'], unique=False)

    # Experiments (FK to outreach_prospects, outreach_campaigns, audit_results, crm_deals)
    op.create_table('experiments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('prospect_id', sa.Integer(), nullable=False),
    sa.Column('campaign_id', sa.Integer(), nullable=False),
    sa.Column('audit_id', sa.Integer(), nullable=True),
    sa.Column('status', sa.String(length=30), nullable=True),
    sa.Column('issue_type', sa.String(length=100), nullable=True),
    sa.Column('issue_detail', sa.Text(), nullable=True),
    sa.Column('secondary_issue', sa.String(length=100), nullable=True),
    sa.Column('secondary_detail', sa.Text(), nullable=True),
    sa.Column('confidence', sa.String(length=20), nullable=True),
    sa.Column('site_quality', sa.String(length=20), nullable=True),
    sa.Column('pass_2_triggered', sa.Boolean(), nullable=True),
    sa.Column('subject', sa.String(length=500), nullable=True),
    sa.Column('body', sa.Text(), nullable=True),
    sa.Column('word_count', sa.Integer(), nullable=True),
    sa.Column('was_edited', sa.Boolean(), nullable=True),
    sa.Column('edit_type', sa.String(length=30), nullable=True),
    sa.Column('niche', sa.String(length=255), nullable=True),
    sa.Column('city', sa.String(length=200), nullable=True),
    sa.Column('state', sa.String(length=100), nullable=True),
    sa.Column('company', sa.String(length=255), nullable=True),
    sa.Column('sent_at', sa.DateTime(), nullable=True),
    sa.Column('day_of_week', sa.String(length=10), nullable=True),
    sa.Column('step_number', sa.Integer(), nullable=True),
    sa.Column('replied', sa.Boolean(), nullable=True),
    sa.Column('reply_at', sa.DateTime(), nullable=True),
    sa.Column('response_time_minutes', sa.Integer(), nullable=True),
    sa.Column('sentiment', sa.String(length=30), nullable=True),
    sa.Column('category', sa.String(length=50), nullable=True),
    sa.Column('forwarded_internally', sa.Boolean(), nullable=True),
    sa.Column('full_reply_text', sa.Text(), nullable=True),
    sa.Column('converted_to_call', sa.Boolean(), nullable=True),
    sa.Column('converted_to_client', sa.Boolean(), nullable=True),
    sa.Column('deal_id', sa.Integer(), nullable=True),
    sa.Column('deal_value', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['audit_id'], ['audit_results.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaigns.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['deal_id'], ['crm_deals.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['prospect_id'], ['outreach_prospects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_experiments_audit_id'), 'experiments', ['audit_id'], unique=False)
    op.create_index(op.f('ix_experiments_campaign_id'), 'experiments', ['campaign_id'], unique=False)
    op.create_index(op.f('ix_experiments_id'), 'experiments', ['id'], unique=False)
    op.create_index(op.f('ix_experiments_issue_type'), 'experiments', ['issue_type'], unique=False)
    op.create_index(op.f('ix_experiments_niche'), 'experiments', ['niche'], unique=False)
    op.create_index(op.f('ix_experiments_prospect_id'), 'experiments', ['prospect_id'], unique=False)

    # Email matches (FK to outreach_prospects, experiments)
    op.create_table('email_matches',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('prospect_id', sa.Integer(), nullable=False),
    sa.Column('experiment_id', sa.Integer(), nullable=True),
    sa.Column('gmail_message_id', sa.String(length=255), nullable=False),
    sa.Column('direction', sa.String(length=10), nullable=False),
    sa.Column('from_email', sa.String(length=255), nullable=True),
    sa.Column('to_email', sa.String(length=255), nullable=True),
    sa.Column('subject', sa.String(length=500), nullable=True),
    sa.Column('body_text', sa.Text(), nullable=True),
    sa.Column('received_at', sa.DateTime(), nullable=True),
    sa.Column('sentiment', sa.String(length=30), nullable=True),
    sa.Column('category', sa.String(length=50), nullable=True),
    sa.Column('wants_loom', sa.Boolean(), nullable=True),
    sa.Column('wants_call', sa.Boolean(), nullable=True),
    sa.Column('forwarded_internally', sa.Boolean(), nullable=True),
    sa.Column('key_quote', sa.Text(), nullable=True),
    sa.Column('suggested_action', sa.String(length=100), nullable=True),
    sa.Column('classification_cost', sa.Float(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['experiment_id'], ['experiments.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['prospect_id'], ['outreach_prospects.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('gmail_message_id')
    )
    op.create_index(op.f('ix_email_matches_experiment_id'), 'email_matches', ['experiment_id'], unique=False)
    op.create_index(op.f('ix_email_matches_id'), 'email_matches', ['id'], unique=False)
    op.create_index(op.f('ix_email_matches_prospect_id'), 'email_matches', ['prospect_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_matches_prospect_id'), table_name='email_matches')
    op.drop_index(op.f('ix_email_matches_id'), table_name='email_matches')
    op.drop_index(op.f('ix_email_matches_experiment_id'), table_name='email_matches')
    op.drop_table('email_matches')

    op.drop_index(op.f('ix_experiments_prospect_id'), table_name='experiments')
    op.drop_index(op.f('ix_experiments_niche'), table_name='experiments')
    op.drop_index(op.f('ix_experiments_issue_type'), table_name='experiments')
    op.drop_index(op.f('ix_experiments_id'), table_name='experiments')
    op.drop_index(op.f('ix_experiments_campaign_id'), table_name='experiments')
    op.drop_index(op.f('ix_experiments_audit_id'), table_name='experiments')
    op.drop_table('experiments')

    op.drop_index(op.f('ix_audit_results_prospect_id'), table_name='audit_results')
    op.drop_index(op.f('ix_audit_results_id'), table_name='audit_results')
    op.drop_index(op.f('ix_audit_results_campaign_id'), table_name='audit_results')
    op.drop_table('audit_results')

    op.drop_index(op.f('ix_gmail_tokens_id'), table_name='gmail_tokens')
    op.drop_table('gmail_tokens')

    op.drop_index(op.f('ix_autoresearch_settings_id'), table_name='autoresearch_settings')
    op.drop_table('autoresearch_settings')

    op.drop_index(op.f('ix_insights_id'), table_name='insights')
    op.drop_table('insights')
