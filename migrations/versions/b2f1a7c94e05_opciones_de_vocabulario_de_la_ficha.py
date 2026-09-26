"""opciones de vocabulario de la ficha del lead

Una tabla nueva, sin tocar ninguna existente. Guarda las opciones que el equipo crea a mano desde
los grupos "Otros" de «Cómo viene», «Dolores», «Motivos de descarte» y «Motivos de baja» de la
ficha del lead: son globales (una que alguien agrega la ve todo el equipo en la lectura siguiente),
asi que no servia `user_view_settings`, que es por persona.

Revision ID: b2f1a7c94e05
Revises: c7a1e2b93f48
Create Date: 2026-09-26 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b2f1a7c94e05'
down_revision = 'c7a1e2b93f48'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ficha_opciones',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('grupo', sa.String(length=40), nullable=False),
        sa.Column('clave', sa.String(length=80), nullable=False),
        sa.Column('label', sa.String(length=120), nullable=False),
        sa.Column('creada_por_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['creada_por_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        # Volver a agregar la misma opcion no la duplica: la ficha la reusa.
        sa.UniqueConstraint('grupo', 'clave', name='uq_ficha_opciones_grupo_clave'),
    )
    with op.batch_alter_table('ficha_opciones', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_ficha_opciones_grupo'), ['grupo'], unique=False)


def downgrade():
    with op.batch_alter_table('ficha_opciones', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_ficha_opciones_grupo'))
    op.drop_table('ficha_opciones')
