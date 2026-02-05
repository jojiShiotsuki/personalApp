"""add sprint tracking

Revision ID: e2f3g4h5i6j7
Revises: d1a2b3c4d5e6
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e2f3g4h5i6j7'
down_revision: Union[str, None] = 'd1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create sprints table
    op.create_table(
        'sprints',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=False),
        sa.Column('status', sa.Enum('active', 'completed', 'paused', 'abandoned', name='sprintstatus'), nullable=True),
        sa.Column('week_themes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sprints_id'), 'sprints', ['id'], unique=False)
    op.create_index(op.f('ix_sprints_status'), 'sprints', ['status'], unique=False)

    # Create sprint_days table
    op.create_table(
        'sprint_days',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('sprint_id', sa.Integer(), nullable=False),
        sa.Column('day_number', sa.Integer(), nullable=False),
        sa.Column('week_number', sa.Integer(), nullable=False),
        sa.Column('log_date', sa.Date(), nullable=False),
        sa.Column('outreach_log_id', sa.Integer(), nullable=True),
        sa.Column('tasks', sa.Text(), nullable=True),
        sa.Column('is_complete', sa.Boolean(), nullable=True, default=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['sprint_id'], ['sprints.id'], ),
        sa.ForeignKeyConstraint(['outreach_log_id'], ['daily_outreach_logs.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sprint_days_id'), 'sprint_days', ['id'], unique=False)
    op.create_index(op.f('ix_sprint_days_sprint_id'), 'sprint_days', ['sprint_id'], unique=False)
    op.create_index(op.f('ix_sprint_days_day_number'), 'sprint_days', ['day_number'], unique=False)
    op.create_index(op.f('ix_sprint_days_log_date'), 'sprint_days', ['log_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sprint_days_log_date'), table_name='sprint_days')
    op.drop_index(op.f('ix_sprint_days_day_number'), table_name='sprint_days')
    op.drop_index(op.f('ix_sprint_days_sprint_id'), table_name='sprint_days')
    op.drop_index(op.f('ix_sprint_days_id'), table_name='sprint_days')
    op.drop_table('sprint_days')

    op.drop_index(op.f('ix_sprints_status'), table_name='sprints')
    op.drop_index(op.f('ix_sprints_id'), table_name='sprints')
    op.drop_table('sprints')

    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS sprintstatus')
