"""add daily outreach tracking

Revision ID: d1a2b3c4d5e6
Revises: 582cc026c1fd
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1a2b3c4d5e6'
down_revision: Union[str, None] = '582cc026c1fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create daily_outreach_logs table
    op.create_table(
        'daily_outreach_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('cold_emails_sent', sa.Integer(), nullable=True, default=0),
        sa.Column('linkedin_actions', sa.Integer(), nullable=True, default=0),
        sa.Column('follow_up_calls', sa.Integer(), nullable=True, default=0),
        sa.Column('loom_audits_sent', sa.Integer(), nullable=True, default=0),
        sa.Column('target_cold_emails', sa.Integer(), nullable=True, default=10),
        sa.Column('target_linkedin', sa.Integer(), nullable=True, default=10),
        sa.Column('target_calls', sa.Integer(), nullable=True, default=5),
        sa.Column('target_looms', sa.Integer(), nullable=True, default=2),
        sa.Column('all_targets_met', sa.Boolean(), nullable=True, default=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_daily_outreach_logs_id'), 'daily_outreach_logs', ['id'], unique=False)
    op.create_index(op.f('ix_daily_outreach_logs_log_date'), 'daily_outreach_logs', ['log_date'], unique=True)

    # Create outreach_settings table
    op.create_table(
        'outreach_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('daily_cold_email_target', sa.Integer(), nullable=True, default=10),
        sa.Column('daily_linkedin_target', sa.Integer(), nullable=True, default=10),
        sa.Column('daily_call_target', sa.Integer(), nullable=True, default=5),
        sa.Column('daily_loom_target', sa.Integer(), nullable=True, default=2),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_outreach_settings_id'), 'outreach_settings', ['id'], unique=False)

    # Insert default settings row
    op.execute("""
        INSERT INTO outreach_settings (daily_cold_email_target, daily_linkedin_target, daily_call_target, daily_loom_target, created_at, updated_at)
        VALUES (10, 10, 5, 2, NOW(), NOW())
    """)


def downgrade() -> None:
    op.drop_index(op.f('ix_outreach_settings_id'), table_name='outreach_settings')
    op.drop_table('outreach_settings')
    op.drop_index(op.f('ix_daily_outreach_logs_log_date'), table_name='daily_outreach_logs')
    op.drop_index(op.f('ix_daily_outreach_logs_id'), table_name='daily_outreach_logs')
    op.drop_table('daily_outreach_logs')
