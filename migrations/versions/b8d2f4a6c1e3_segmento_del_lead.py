"""Segmento A/B/C/D del lead en la agenda y en el cliente (docs/plan_segmentos_triage.md §8)

`segmento_puntos` es el puntaje de 0 a 1 (puntos sobre el máximo de lo respondido), `segmento_preguntas`
cuántas preguntas del segmento respondió, `segmento_confianza` la probabilidad de estar en ese segmento y
`segmento_version` la versión de los puntos. Quedan null hasta el backfill (scripts/backfill_segmentos.py).

Revision ID: b8d2f4a6c1e3
Revises: a3c7e1f5b9d2
Create Date: 2026-10-24 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b8d2f4a6c1e3'
down_revision = 'a3c7e1f5b9d2'
branch_labels = None
depends_on = None

TABLAS = ('appointments', 'clients')


def upgrade():
    for tabla in TABLAS:
        with op.batch_alter_table(tabla, schema=None) as batch_op:
            batch_op.add_column(sa.Column('segmento', sa.String(length=1), nullable=True))
            batch_op.add_column(sa.Column('segmento_puntos', sa.Float(), nullable=True))
            batch_op.add_column(sa.Column('segmento_preguntas', sa.Integer(), nullable=True))
            batch_op.add_column(sa.Column('segmento_confianza', sa.Float(), nullable=True))
            batch_op.add_column(sa.Column('segmento_version', sa.String(length=20), nullable=True))
            batch_op.create_index(f'ix_{tabla}_segmento', ['segmento'], unique=False)


def downgrade():
    for tabla in TABLAS:
        with op.batch_alter_table(tabla, schema=None) as batch_op:
            batch_op.drop_index(f'ix_{tabla}_segmento')
            batch_op.drop_column('segmento_version')
            batch_op.drop_column('segmento_confianza')
            batch_op.drop_column('segmento_preguntas')
            batch_op.drop_column('segmento_puntos')
            batch_op.drop_column('segmento')
