"""drop unique constraint on website_normalized

Revision ID: s5t6u7v8w9x0
Revises: r4s5t6u7v8w9
Create Date: 2026-02-12
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 's5t6u7v8w9x0'
down_revision = 'r4s5t6u7v8w9'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Drop the unique constraint on website_normalized
    # Keep the index for fast lookups during dedup checks
    op.drop_index('ix_discovered_leads_website_normalized', table_name='discovered_leads')
    op.create_index('ix_discovered_leads_website_normalized', 'discovered_leads', ['website_normalized'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_discovered_leads_website_normalized', table_name='discovered_leads')
    op.create_index('ix_discovered_leads_website_normalized', 'discovered_leads', ['website_normalized'], unique=True)
