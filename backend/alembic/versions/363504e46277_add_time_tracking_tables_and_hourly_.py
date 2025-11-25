"""add time tracking tables and hourly_rate fields

Revision ID: 363504e46277
Revises: 53ca47e97ba5
Create Date: 2025-11-25 17:31:04.922853

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '363504e46277'
down_revision: Union[str, None] = '53ca47e97ba5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create time_entries table
    op.create_table('time_entries',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('start_time', sa.DateTime(), nullable=False),
    sa.Column('end_time', sa.DateTime(), nullable=True),
    sa.Column('duration_seconds', sa.Integer(), nullable=True),
    sa.Column('is_running', sa.Boolean(), nullable=True),
    sa.Column('is_paused', sa.Boolean(), nullable=True),
    sa.Column('paused_duration_seconds', sa.Integer(), nullable=True),
    sa.Column('task_id', sa.Integer(), nullable=True),
    sa.Column('project_id', sa.Integer(), nullable=True),
    sa.Column('deal_id', sa.Integer(), nullable=True),
    sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['deal_id'], ['crm_deals.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['project_id'], ['projects.id'], ondelete='SET NULL'),
    sa.ForeignKeyConstraint(['task_id'], ['tasks.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_time_entries_deal_id'), 'time_entries', ['deal_id'], unique=False)
    op.create_index(op.f('ix_time_entries_id'), 'time_entries', ['id'], unique=False)
    op.create_index(op.f('ix_time_entries_is_running'), 'time_entries', ['is_running'], unique=False)
    op.create_index(op.f('ix_time_entries_project_id'), 'time_entries', ['project_id'], unique=False)
    op.create_index(op.f('ix_time_entries_task_id'), 'time_entries', ['task_id'], unique=False)

    # Add hourly_rate to deals and projects
    op.add_column('crm_deals', sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=True))
    op.add_column('projects', sa.Column('hourly_rate', sa.Numeric(precision=10, scale=2), nullable=True))


def downgrade() -> None:
    op.drop_column('projects', 'hourly_rate')
    op.drop_column('crm_deals', 'hourly_rate')
    op.drop_index(op.f('ix_time_entries_task_id'), table_name='time_entries')
    op.drop_index(op.f('ix_time_entries_project_id'), table_name='time_entries')
    op.drop_index(op.f('ix_time_entries_is_running'), table_name='time_entries')
    op.drop_index(op.f('ix_time_entries_id'), table_name='time_entries')
    op.drop_index(op.f('ix_time_entries_deal_id'), table_name='time_entries')
    op.drop_table('time_entries')
