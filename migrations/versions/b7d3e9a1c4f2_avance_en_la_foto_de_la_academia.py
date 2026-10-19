"""avance en la foto de la academia

Suma a `academy_snapshots` el avance del alumno en el proceso de sesiones de la Academia (etapa,
sesiones hechas de cuántas, próxima sesión, atraso y días sin abrir lecciones), para que la cartera
del closer muestre cómo avanza cada cliente. Solo columnas nuevas y nulas: no toca ningún dato.

Revision ID: b7d3e9a1c4f2
Revises: c6f2a8d4e1b9
Create Date: 2026-10-19 21:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b7d3e9a1c4f2'
down_revision = 'c6f2a8d4e1b9'
branch_labels = None
depends_on = None

COLUMNAS = (
    ('avance_etapa', sa.String(length=150)),
    ('avance_tipo', sa.String(length=10)),
    ('avance_dias_en_etapa', sa.Integer()),
    ('sesiones_hechas', sa.Integer()),
    ('sesiones_total', sa.Integer()),
    ('proxima_sesion', sa.String(length=150)),
    ('proxima_estado', sa.String(length=40)),
    ('atraso_dias', sa.Integer()),
    ('dias_sin_lecciones', sa.Integer()),
    ('fuera_de_plazo', sa.Boolean()),
    ('avance_at', sa.DateTime()),
)


def upgrade():
    with op.batch_alter_table('academy_snapshots', schema=None) as batch_op:
        for nombre, tipo in COLUMNAS:
            batch_op.add_column(sa.Column(nombre, tipo, nullable=True))


def downgrade():
    with op.batch_alter_table('academy_snapshots', schema=None) as batch_op:
        for nombre, _tipo in reversed(COLUMNAS):
            batch_op.drop_column(nombre)
