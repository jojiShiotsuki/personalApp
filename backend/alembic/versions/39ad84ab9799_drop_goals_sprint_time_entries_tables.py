"""drop goals sprint time_entries tables

Revision ID: 39ad84ab9799
Revises: 56d79db09d6c
Create Date: 2026-04-05 13:22:24.610112

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '39ad84ab9799'
down_revision: Union[str, None] = '56d79db09d6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_fk_if_exists(table: str, column: str):
    """Drop a foreign key constraint by finding its name, then drop the column."""
    conn = op.get_bind()
    # Find FK constraint name for this column
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

    # Drop index if exists
    try:
        op.drop_index(f'ix_{table}_{column}', table_name=table)
    except Exception:
        pass

    # Drop column
    try:
        op.drop_column(table, column)
    except Exception:
        pass


def _drop_table_if_exists(table: str):
    """Drop a table only if it exists."""
    conn = op.get_bind()
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = :t"
    ), {"t": table})
    if result.fetchone():
        op.drop_table(table)


def upgrade() -> None:
    # Drop FK columns from tasks first
    _drop_fk_if_exists('tasks', 'goal_id')
    _drop_fk_if_exists('tasks', 'sprint_day_id')

    # Drop tables (order matters — children before parents)
    _drop_table_if_exists('time_entries')
    _drop_table_if_exists('sprint_days')
    _drop_table_if_exists('coach_insights')
    _drop_table_if_exists('sprints')
    _drop_table_if_exists('goals')


def downgrade() -> None:
    # Not restoring — features permanently removed
    pass
