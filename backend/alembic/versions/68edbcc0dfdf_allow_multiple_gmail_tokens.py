"""allow_multiple_gmail_tokens

Revision ID: 68edbcc0dfdf
Revises: c4d5e6f7g8h9
Create Date: 2026-03-25 09:40:34.580841

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision: str = '68edbcc0dfdf'
down_revision: Union[str, None] = 'c4d5e6f7g8h9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _get_unique_constraints(table_name: str) -> list[str]:
    """Get names of unique constraints on a table."""
    conn = op.get_bind()
    insp = inspect(conn)
    return [c["name"] for c in insp.get_unique_constraints(table_name)]


def upgrade() -> None:
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "postgresql":
        # PostgreSQL: drop unique constraint on user_id, add on email_address
        # Find and drop the unique constraint on user_id
        op.execute("""
            DO $$ BEGIN
                ALTER TABLE gmail_tokens DROP CONSTRAINT IF EXISTS gmail_tokens_user_id_key;
                ALTER TABLE gmail_tokens DROP CONSTRAINT IF EXISTS uq_gmail_tokens_user_id;
            EXCEPTION WHEN OTHERS THEN NULL;
            END $$;
        """)
        # Drop unique index if it exists
        op.execute("DROP INDEX IF EXISTS ix_gmail_tokens_user_id")
        # Create regular index on user_id
        op.create_index("ix_gmail_tokens_user_id", "gmail_tokens", ["user_id"])
        # Add unique constraint on email_address (if not already there)
        op.execute("""
            DO $$ BEGIN
                ALTER TABLE gmail_tokens ADD CONSTRAINT uq_gmail_tokens_email_address UNIQUE (email_address);
            EXCEPTION WHEN duplicate_object THEN NULL;
            END $$;
        """)
    else:
        # SQLite: use batch mode to recreate the table with new constraints.
        # First, find the actual unique constraint name on user_id (if any).
        constraint_names = _get_unique_constraints("gmail_tokens")
        user_id_constraint = None
        for name in constraint_names:
            if name and "user_id" in name:
                user_id_constraint = name

        with op.batch_alter_table("gmail_tokens", recreate="always") as batch_op:
            if user_id_constraint:
                batch_op.drop_constraint(user_id_constraint, type_="unique")
            batch_op.create_index("ix_gmail_tokens_user_id", ["user_id"])
            batch_op.create_unique_constraint("uq_gmail_tokens_email_address", ["email_address"])


def downgrade() -> None:
    # Reverse: restore unique on user_id, drop unique on email_address
    conn = op.get_bind()
    dialect = conn.dialect.name

    if dialect == "postgresql":
        op.execute("ALTER TABLE gmail_tokens DROP CONSTRAINT IF EXISTS uq_gmail_tokens_email_address")
        op.execute("DROP INDEX IF EXISTS ix_gmail_tokens_user_id")
        op.create_unique_constraint("uq_gmail_tokens_user_id", "gmail_tokens", ["user_id"])
    else:
        with op.batch_alter_table("gmail_tokens") as batch_op:
            try:
                batch_op.drop_constraint("uq_gmail_tokens_email_address", type_="unique")
            except Exception:
                pass
            batch_op.create_unique_constraint("uq_gmail_tokens_user_id", ["user_id"])
