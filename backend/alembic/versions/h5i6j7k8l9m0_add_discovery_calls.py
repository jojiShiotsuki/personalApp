"""add discovery calls

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h5i6j7k8l9m0'
down_revision: Union[str, None] = 'g4h5i6j7k8l9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create discovery_calls table
    op.create_table(
        'discovery_calls',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('deal_id', sa.Integer(), nullable=True),
        sa.Column('call_date', sa.Date(), nullable=False),
        sa.Column('call_duration_minutes', sa.Integer(), nullable=True),
        sa.Column('attendees', sa.String(500), nullable=True),
        # SPIN fields
        sa.Column('situation', sa.Text(), nullable=True),
        sa.Column('situation_questions', sa.Text(), nullable=True),
        sa.Column('problem', sa.Text(), nullable=True),
        sa.Column('problem_questions', sa.Text(), nullable=True),
        sa.Column('implication', sa.Text(), nullable=True),
        sa.Column('implication_questions', sa.Text(), nullable=True),
        sa.Column('need_payoff', sa.Text(), nullable=True),
        sa.Column('need_payoff_questions', sa.Text(), nullable=True),
        # Additional fields
        sa.Column('objections', sa.Text(), nullable=True),
        sa.Column('next_steps', sa.Text(), nullable=True),
        sa.Column('budget_discussed', sa.Boolean(), nullable=True, default=False),
        sa.Column('budget_range', sa.String(100), nullable=True),
        sa.Column('timeline_discussed', sa.Boolean(), nullable=True, default=False),
        sa.Column('timeline', sa.String(100), nullable=True),
        sa.Column('decision_maker_present', sa.Boolean(), nullable=True, default=False),
        sa.Column('outcome', sa.Enum('scheduled_followup', 'sent_proposal', 'not_a_fit', 'needs_more_info', 'closed_deal', 'no_show', 'rescheduled', name='calloutcome'), nullable=True),
        sa.Column('follow_up_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ),
        sa.ForeignKeyConstraint(['deal_id'], ['crm_deals.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_discovery_calls_id'), 'discovery_calls', ['id'], unique=False)
    op.create_index(op.f('ix_discovery_calls_contact_id'), 'discovery_calls', ['contact_id'], unique=False)
    op.create_index(op.f('ix_discovery_calls_deal_id'), 'discovery_calls', ['deal_id'], unique=False)
    op.create_index(op.f('ix_discovery_calls_call_date'), 'discovery_calls', ['call_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_discovery_calls_call_date'), table_name='discovery_calls')
    op.drop_index(op.f('ix_discovery_calls_deal_id'), table_name='discovery_calls')
    op.drop_index(op.f('ix_discovery_calls_contact_id'), table_name='discovery_calls')
    op.drop_index(op.f('ix_discovery_calls_id'), table_name='discovery_calls')
    op.drop_table('discovery_calls')

    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS calloutcome')
