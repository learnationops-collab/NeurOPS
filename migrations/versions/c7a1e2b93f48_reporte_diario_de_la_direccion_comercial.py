"""reporte diario de la direccion comercial

Dos tablas nuevas, sin tocar ninguna existente: el reporte de gestion del director
(`reportes_director`, uno por dia) y su registro por persona (`reportes_director_persona`).

Revision ID: c7a1e2b93f48
Revises: 1d590aa97756
Create Date: 2026-09-22 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c7a1e2b93f48'
down_revision = '1d590aa97756'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'reportes_director',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('director_id', sa.Integer(), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('grupal_closers', sa.Text(), nullable=True),
        sa.Column('grupal_setters', sa.Text(), nullable=True),
        sa.Column('victorias', sa.JSON(), nullable=True),
        sa.Column('mejoras', sa.JSON(), nullable=True),
        sa.Column('proximos', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['director_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('reportes_director', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_reportes_director_director_id'), ['director_id'], unique=False)
        # Un reporte por dia: es el invariante del que depende que volver a guardar ACTUALICE el
        # del dia en vez de crear un segundo.
        batch_op.create_index(batch_op.f('ix_reportes_director_fecha'), ['fecha'], unique=True)

    op.create_table(
        'reportes_director_persona',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('reporte_id', sa.Integer(), nullable=False),
        sa.Column('miembro_id', sa.Integer(), nullable=False),
        sa.Column('trabajo', sa.Boolean(), nullable=False),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['miembro_id'], ['users.id']),
        sa.ForeignKeyConstraint(['reporte_id'], ['reportes_director.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('reporte_id', 'miembro_id', name='_reporte_miembro_uc'),
    )
    with op.batch_alter_table('reportes_director_persona', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_reportes_director_persona_miembro_id'), ['miembro_id'],
                              unique=False)
        # El historial se consulta por persona ("Registro de trabajo · Nerina"), no solo por
        # reporte: sin este indice, cada visita recorre la tabla entera.
        batch_op.create_index(batch_op.f('ix_reportes_director_persona_reporte_id'), ['reporte_id'],
                              unique=False)


def downgrade():
    with op.batch_alter_table('reportes_director_persona', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_reportes_director_persona_reporte_id'))
        batch_op.drop_index(batch_op.f('ix_reportes_director_persona_miembro_id'))
    op.drop_table('reportes_director_persona')

    with op.batch_alter_table('reportes_director', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_reportes_director_fecha'))
        batch_op.drop_index(batch_op.f('ix_reportes_director_director_id'))
    op.drop_table('reportes_director')
