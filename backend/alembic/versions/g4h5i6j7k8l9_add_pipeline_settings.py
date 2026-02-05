"""add pipeline settings

Revision ID: g4h5i6j7k8l9
Revises: f3g4h5i6j7k8
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g4h5i6j7k8l9'
down_revision: Union[str, None] = 'f3g4h5i6j7k8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create pipeline_settings table
    op.create_table(
        'pipeline_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('monthly_revenue_goal', sa.Float(), nullable=True, default=10000.0),
        sa.Column('average_deal_value', sa.Float(), nullable=True, default=2000.0),
        sa.Column('lead_to_qualified_rate', sa.Float(), nullable=True, default=30.0),
        sa.Column('qualified_to_proposal_rate', sa.Float(), nullable=True, default=50.0),
        sa.Column('proposal_to_close_rate', sa.Float(), nullable=True, default=40.0),
        sa.Column('cold_email_response_rate', sa.Float(), nullable=True, default=5.0),
        sa.Column('linkedin_connection_rate', sa.Float(), nullable=True, default=25.0),
        sa.Column('linkedin_to_conversation_rate', sa.Float(), nullable=True, default=20.0),
        sa.Column('call_to_meeting_rate', sa.Float(), nullable=True, default=15.0),
        sa.Column('loom_response_rate', sa.Float(), nullable=True, default=30.0),
        sa.Column('loom_to_call_rate', sa.Float(), nullable=True, default=50.0),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_pipeline_settings_id'), 'pipeline_settings', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_pipeline_settings_id'), table_name='pipeline_settings')
    op.drop_table('pipeline_settings')
