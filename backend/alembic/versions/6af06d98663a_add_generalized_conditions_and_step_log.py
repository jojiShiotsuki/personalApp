"""add generalized conditions and step log

Revision ID: 6af06d98663a
Revises: 9a005a764eb2
Create Date: 2026-03-28 10:06:01.065574

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '6af06d98663a'
down_revision: Union[str, None] = '9a005a764eb2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = [c["name"] for c in inspector.get_columns(table_name)]
    return column_name in columns


def _table_exists(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    # 1. Create prospect_step_log table
    if not _table_exists("prospect_step_log"):
        op.create_table('prospect_step_log',
            sa.Column('id', sa.Integer(), nullable=False),
            sa.Column('prospect_id', sa.Integer(), nullable=False),
            sa.Column('campaign_id', sa.Integer(), nullable=False),
            sa.Column('step_number', sa.Integer(), nullable=False),
            sa.Column('outcome', sa.String(length=50), nullable=False),
            sa.Column('channel_used', sa.String(length=50), nullable=True),
            sa.Column('completed_at', sa.DateTime(), nullable=True),
            sa.ForeignKeyConstraint(['campaign_id'], ['outreach_campaigns.id'], ondelete='CASCADE'),
            sa.ForeignKeyConstraint(['prospect_id'], ['outreach_prospects.id'], ondelete='CASCADE'),
            sa.PrimaryKeyConstraint('id'),
            sa.UniqueConstraint('prospect_id', 'campaign_id', 'step_number', name='uq_prospect_step_log')
        )
        op.create_index(op.f('ix_prospect_step_log_id'), 'prospect_step_log', ['id'], unique=False)
        op.create_index('ix_prospect_step_log_prospect', 'prospect_step_log', ['prospect_id'], unique=False)

    # 2. Add new columns to multi_touch_steps
    if not _column_exists("multi_touch_steps", "condition_type"):
        op.add_column('multi_touch_steps', sa.Column('condition_type', sa.String(length=50), nullable=True))
    if not _column_exists("multi_touch_steps", "condition_step_ref"):
        op.add_column('multi_touch_steps', sa.Column('condition_step_ref', sa.Integer(), nullable=True))
    if not _column_exists("multi_touch_steps", "fallback_template_subject"):
        op.add_column('multi_touch_steps', sa.Column('fallback_template_subject', sa.String(length=500), nullable=True))
    if not _column_exists("multi_touch_steps", "fallback_template_content"):
        op.add_column('multi_touch_steps', sa.Column('fallback_template_content', sa.Text(), nullable=True))
    if not _column_exists("multi_touch_steps", "fallback_instruction_text"):
        op.add_column('multi_touch_steps', sa.Column('fallback_instruction_text', sa.String(length=500), nullable=True))

    # 3. Add new columns to outreach_prospects
    if not _column_exists("outreach_prospects", "email_opened"):
        op.add_column('outreach_prospects', sa.Column('email_opened', sa.Boolean(), server_default='0', nullable=True))
    if not _column_exists("outreach_prospects", "email_bounced"):
        op.add_column('outreach_prospects', sa.Column('email_bounced', sa.Boolean(), server_default='0', nullable=True))
    if not _column_exists("outreach_prospects", "linkedin_replied"):
        op.add_column('outreach_prospects', sa.Column('linkedin_replied', sa.Boolean(), server_default='0', nullable=True))

    # 4. Data migration: convert requires_linkedin_connected to condition_type
    op.execute("""
        UPDATE multi_touch_steps
        SET condition_type = 'LINKEDIN_CONNECTED'
        WHERE requires_linkedin_connected = true OR requires_linkedin_connected = '1'
    """)


def downgrade() -> None:
    # Clear condition_type values that were migrated from requires_linkedin_connected
    op.execute("""
        UPDATE multi_touch_steps
        SET condition_type = NULL
        WHERE condition_type = 'LINKEDIN_CONNECTED'
    """)

    # Drop new columns from outreach_prospects
    if _column_exists("outreach_prospects", "linkedin_replied"):
        op.drop_column('outreach_prospects', 'linkedin_replied')
    if _column_exists("outreach_prospects", "email_bounced"):
        op.drop_column('outreach_prospects', 'email_bounced')
    if _column_exists("outreach_prospects", "email_opened"):
        op.drop_column('outreach_prospects', 'email_opened')

    # Drop new columns from multi_touch_steps
    if _column_exists("multi_touch_steps", "fallback_instruction_text"):
        op.drop_column('multi_touch_steps', 'fallback_instruction_text')
    if _column_exists("multi_touch_steps", "fallback_template_content"):
        op.drop_column('multi_touch_steps', 'fallback_template_content')
    if _column_exists("multi_touch_steps", "fallback_template_subject"):
        op.drop_column('multi_touch_steps', 'fallback_template_subject')
    if _column_exists("multi_touch_steps", "condition_step_ref"):
        op.drop_column('multi_touch_steps', 'condition_step_ref')
    if _column_exists("multi_touch_steps", "condition_type"):
        op.drop_column('multi_touch_steps', 'condition_type')

    # Drop prospect_step_log table
    if _table_exists("prospect_step_log"):
        op.drop_index('ix_prospect_step_log_prospect', table_name='prospect_step_log')
        op.drop_index(op.f('ix_prospect_step_log_id'), table_name='prospect_step_log')
        op.drop_table('prospect_step_log')
