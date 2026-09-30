"""foto de la academia por cliente

Una tabla nueva, sin tocar ninguna existente: `academy_snapshots`, lo ultimo que se supo de cada
cliente dentro de la Academia (horas de estudio, ejecuciones, racha...) para que las tablas
Clientes y Ventas del dashboard comercial se puedan filtrar y ordenar sin consultar la Academia en
vivo (ver app/models/academy_snapshot.py).

Revision ID: acad3a5f07e1
Revises: 7ffbabf17b07
Create Date: 2026-09-30 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'acad3a5f07e1'
down_revision = '7ffbabf17b07'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'academy_snapshots',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('learnation_user_id', sa.Integer(), nullable=True),
        sa.Column('email_usado', sa.String(length=120), nullable=True),
        sa.Column('resultado', sa.String(length=20), nullable=True),
        sa.Column('error_codigo', sa.Integer(), nullable=True),
        sa.Column('error', sa.String(length=255), nullable=True),
        sa.Column('intentado_at', sa.DateTime(), nullable=True),
        sa.Column('synced_at', sa.DateTime(), nullable=True),
        sa.Column('actividad_vista_at', sa.DateTime(), nullable=True),
        sa.Column('horas_estudio', sa.Float(), nullable=True),
        sa.Column('progreso', sa.Float(), nullable=True),
        sa.Column('lecciones_completadas', sa.Integer(), nullable=True),
        sa.Column('lecciones_totales', sa.Integer(), nullable=True),
        sa.Column('vistas_lecciones', sa.Integer(), nullable=True),
        sa.Column('ejecuciones', sa.Integer(), nullable=True),
        sa.Column('racha_dias', sa.Integer(), nullable=True),
        sa.Column('pomodoros', sa.Integer(), nullable=True),
        sa.Column('aprobacion', sa.Float(), nullable=True),
        sa.Column('sesiones_grupales', sa.Integer(), nullable=True),
        sa.Column('sesiones_individuales', sa.Integer(), nullable=True),
        sa.Column('tickets_abiertos', sa.Integer(), nullable=True),
        sa.Column('producto_activo', sa.String(length=150), nullable=True),
        sa.Column('datos', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        # CASCADE: la fusion de duplicados borra clientes con un DELETE en bloque, y sin esto
        # Postgres rechazaria la fusion de cualquier duplicado que tuviera foto.
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('academy_snapshots', schema=None) as batch_op:
        # Una foto por cliente: es el invariante del que depende que guardar ACTUALICE la del
        # cliente en vez de sumar una segunda.
        batch_op.create_index(batch_op.f('ix_academy_snapshots_client_id'), ['client_id'], unique=True)


def downgrade():
    with op.batch_alter_table('academy_snapshots', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_academy_snapshots_client_id'))
    op.drop_table('academy_snapshots')
