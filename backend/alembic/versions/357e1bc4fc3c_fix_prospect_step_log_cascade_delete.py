"""fix prospect_step_log cascade delete

Revision ID: 357e1bc4fc3c
Revises: 39ad84ab9799
Create Date: 2026-04-05 15:28:04.460893

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '357e1bc4fc3c'
down_revision: Union[str, None] = '39ad84ab9799'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _fix_fk(table: str, column: str, ref_table: str, ref_column: str = 'id'):
    """Drop existing FK and recreate with CASCADE."""
    conn = op.get_bind()
    result = conn.execute(sa.text("""
        SELECT tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
            ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = :table
          AND kcu.column_name = :column
          AND tc.constraint_type = 'FOREIGN KEY'
    """), {"table": table, "column": column})
    for row in result:
        op.drop_constraint(row[0], table, type_='foreignkey')
    op.create_foreign_key(
        f'{table}_{column}_fkey',
        table, ref_table,
        [column], [ref_column],
        ondelete='CASCADE',
    )


def upgrade() -> None:
    _fix_fk('prospect_step_log', 'prospect_id', 'outreach_prospects')
    _fix_fk('prospect_step_log', 'campaign_id', 'outreach_campaigns')


def downgrade() -> None:
    pass
