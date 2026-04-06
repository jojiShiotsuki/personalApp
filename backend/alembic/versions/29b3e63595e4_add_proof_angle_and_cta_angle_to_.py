"""add proof_angle and cta_angle to experiments

Revision ID: 29b3e63595e4
Revises: fd5d14b3f0bb
Create Date: 2026-04-06 11:47:19.334402

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '29b3e63595e4'
down_revision: Union[str, None] = 'fd5d14b3f0bb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('experiments', sa.Column('proof_angle', sa.String(length=50), nullable=True))
    op.add_column('experiments', sa.Column('cta_angle', sa.String(length=50), nullable=True))
    op.create_index('ix_experiments_proof_angle', 'experiments', ['proof_angle'])
    op.create_index('ix_experiments_cta_angle', 'experiments', ['cta_angle'])


def downgrade() -> None:
    op.drop_index('ix_experiments_cta_angle', table_name='experiments')
    op.drop_index('ix_experiments_proof_angle', table_name='experiments')
    op.drop_column('experiments', 'cta_angle')
    op.drop_column('experiments', 'proof_angle')
