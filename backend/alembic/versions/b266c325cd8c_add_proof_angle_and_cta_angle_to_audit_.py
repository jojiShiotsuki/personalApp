"""add proof_angle and cta_angle to audit_results

Revision ID: b266c325cd8c
Revises: 29b3e63595e4
Create Date: 2026-04-06 12:10:32.874842

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b266c325cd8c'
down_revision: Union[str, None] = '29b3e63595e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('audit_results', sa.Column('proof_angle', sa.String(length=50), nullable=True))
    op.add_column('audit_results', sa.Column('cta_angle', sa.String(length=50), nullable=True))
    op.create_index('ix_audit_results_proof_angle', 'audit_results', ['proof_angle'])
    op.create_index('ix_audit_results_cta_angle', 'audit_results', ['cta_angle'])


def downgrade() -> None:
    op.drop_index('ix_audit_results_cta_angle', table_name='audit_results')
    op.drop_index('ix_audit_results_proof_angle', table_name='audit_results')
    op.drop_column('audit_results', 'cta_angle')
    op.drop_column('audit_results', 'proof_angle')
