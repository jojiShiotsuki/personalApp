"""add loom audit tracking

Revision ID: f3g4h5i6j7k8
Revises: e2f3g4h5i6j7
Create Date: 2026-02-04

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f3g4h5i6j7k8'
down_revision: Union[str, None] = 'e2f3g4h5i6j7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create loom_audits table
    op.create_table(
        'loom_audits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contact_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('loom_url', sa.String(500), nullable=False),
        sa.Column('thumbnail_url', sa.String(500), nullable=True),
        sa.Column('sent_date', sa.Date(), nullable=False),
        sa.Column('sent_via', sa.String(50), nullable=True),
        sa.Column('watched', sa.Boolean(), nullable=True, default=False),
        sa.Column('watched_date', sa.Date(), nullable=True),
        sa.Column('watch_count', sa.Integer(), nullable=True, default=0),
        sa.Column('response_received', sa.Boolean(), nullable=True, default=False),
        sa.Column('response_date', sa.Date(), nullable=True),
        sa.Column('response_type', sa.Enum('interested', 'not_interested', 'questions', 'booked_call', 'no_response', name='loomresponsetype'), nullable=True),
        sa.Column('follow_up_date', sa.Date(), nullable=True),
        sa.Column('follow_up_sent', sa.Boolean(), nullable=True, default=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['contact_id'], ['crm_contacts.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_loom_audits_id'), 'loom_audits', ['id'], unique=False)
    op.create_index(op.f('ix_loom_audits_contact_id'), 'loom_audits', ['contact_id'], unique=False)
    op.create_index(op.f('ix_loom_audits_sent_date'), 'loom_audits', ['sent_date'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_loom_audits_sent_date'), table_name='loom_audits')
    op.drop_index(op.f('ix_loom_audits_contact_id'), table_name='loom_audits')
    op.drop_index(op.f('ix_loom_audits_id'), table_name='loom_audits')
    op.drop_table('loom_audits')

    # Drop the enum type
    op.execute('DROP TYPE IF EXISTS loomresponsetype')
