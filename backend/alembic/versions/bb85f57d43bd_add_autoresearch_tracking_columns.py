"""add_autoresearch_tracking_columns

Revision ID: bb85f57d43bd
Revises: f1a2b3c4d5e6
Create Date: 2026-03-22 09:23:47.977677

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'bb85f57d43bd'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # AuditResult new columns
    op.add_column('audit_results', sa.Column('detected_city', sa.String(200), nullable=True))
    op.add_column('audit_results', sa.Column('detected_trade', sa.String(100), nullable=True))
    op.add_column('audit_results', sa.Column('rejection_category', sa.String(50), nullable=True))

    # Experiment new columns
    op.add_column('experiments', sa.Column('gmail_thread_id', sa.String(100), nullable=True))
    op.add_column('experiments', sa.Column('gmail_message_id_header', sa.String(200), nullable=True))
    op.add_column('experiments', sa.Column('sent_hour', sa.Integer(), nullable=True))
    op.add_column('experiments', sa.Column('step_delay_days', sa.Integer(), nullable=True))
    # loom_sent, loom_url, loom_watched, subject_variant_used already added in previous migration f1a2b3c4d5e6

    # EmailOpen table
    op.create_table(
        'email_opens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tracking_id', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('prospect_id', sa.Integer(), sa.ForeignKey('outreach_prospects.id', ondelete='CASCADE'), nullable=False),
        sa.Column('experiment_id', sa.Integer(), sa.ForeignKey('experiments.id', ondelete='SET NULL'), nullable=True),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('open_count', sa.Integer(), server_default='0'),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.text('CURRENT_TIMESTAMP')),
    )


def downgrade() -> None:
    op.drop_table('email_opens')

    op.drop_column('experiments', 'step_delay_days')
    op.drop_column('experiments', 'sent_hour')
    op.drop_column('experiments', 'gmail_message_id_header')
    op.drop_column('experiments', 'gmail_thread_id')

    op.drop_column('audit_results', 'rejection_category')
    op.drop_column('audit_results', 'detected_trade')
    op.drop_column('audit_results', 'detected_city')
