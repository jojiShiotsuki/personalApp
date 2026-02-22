"""add missing FK indexes

Revision ID: 4d63c7feabf3
Revises: w1a2b3c4d5e7
Create Date: 2026-02-22 18:19:37.714607

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4d63c7feabf3'
down_revision: Union[str, None] = 'w1a2b3c4d5e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Only indexes that don't already exist in the DB
    op.create_index(op.f('ix_outreach_prospects_discovered_lead_id'), 'outreach_prospects', ['discovered_lead_id'], unique=False)
    op.create_index(op.f('ix_outreach_prospects_converted_contact_id'), 'outreach_prospects', ['converted_contact_id'], unique=False)
    op.create_index(op.f('ix_outreach_prospects_converted_deal_id'), 'outreach_prospects', ['converted_deal_id'], unique=False)
    op.create_index(op.f('ix_social_content_project_id'), 'social_content', ['project_id'], unique=False)
    op.create_index(op.f('ix_tasks_parent_task_id'), 'tasks', ['parent_task_id'], unique=False)
    op.create_index(op.f('ix_sprint_days_outreach_log_id'), 'sprint_days', ['outreach_log_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_sprint_days_outreach_log_id'), table_name='sprint_days')
    op.drop_index(op.f('ix_tasks_parent_task_id'), table_name='tasks')
    op.drop_index(op.f('ix_social_content_project_id'), table_name='social_content')
    op.drop_index(op.f('ix_outreach_prospects_converted_deal_id'), table_name='outreach_prospects')
    op.drop_index(op.f('ix_outreach_prospects_converted_contact_id'), table_name='outreach_prospects')
    op.drop_index(op.f('ix_outreach_prospects_discovered_lead_id'), table_name='outreach_prospects')
