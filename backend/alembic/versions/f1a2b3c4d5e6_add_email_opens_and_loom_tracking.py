"""add email_opens table and loom tracking fields

Revision ID: f1a2b3c4d5e6
Revises: z2b3c4d5e6f7
Create Date: 2026-03-21
"""
from alembic import op
import sqlalchemy as sa

revision = 'f1a2b3c4d5e6'
down_revision = '55ca050ba1bb'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create email_opens table
    op.create_table(
        'email_opens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('tracking_id', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('prospect_id', sa.Integer(), sa.ForeignKey('outreach_prospects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('experiment_id', sa.Integer(), sa.ForeignKey('experiments.id', ondelete='SET NULL'), nullable=True, index=True),
        sa.Column('opened_at', sa.DateTime(), nullable=True),
        sa.Column('open_count', sa.Integer(), server_default='0'),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    # Add loom tracking columns to experiments
    op.add_column('experiments', sa.Column('loom_sent', sa.Boolean(), server_default='0'))
    op.add_column('experiments', sa.Column('loom_url', sa.String(500), nullable=True))
    op.add_column('experiments', sa.Column('loom_watched', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('experiments', 'loom_watched')
    op.drop_column('experiments', 'loom_url')
    op.drop_column('experiments', 'loom_sent')
    op.drop_table('email_opens')
