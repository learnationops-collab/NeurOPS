"""Campañas de marketing del Inbox: palabras clave → flujo, con vigencia

Una campaña (funnel, pago u orgánica, [desde, hasta)) junta palabras clave y las manda a un flujo; puede
asociar varias campañas de Meta. Cada ejecución guarda la campaña y la palabra por la que entró.

Revision ID: f2a6c8d4b1e3
Revises: d7a3f1c9e5b8
Create Date: 2026-10-17 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f2a6c8d4b1e3'
down_revision = 'd7a3f1c9e5b8'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'aut_campanas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('embudo', sa.String(length=20), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('flujo_id', sa.Integer(), nullable=True),
        sa.Column('desde', sa.DateTime(), nullable=False),
        sa.Column('hasta', sa.DateTime(), nullable=True),
        sa.Column('creada_en', sa.DateTime(), nullable=False),
        sa.Column('actualizada_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['flujo_id'], ['aut_flujos.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('aut_campanas', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_aut_campanas_flujo_id'), ['flujo_id'], unique=False)

    op.create_table(
        'aut_campana_palabras',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campana_id', sa.Integer(), nullable=False),
        sa.Column('clave', sa.String(length=100), nullable=False),
        sa.Column('texto', sa.String(length=100), nullable=False),
        sa.ForeignKeyConstraint(['campana_id'], ['aut_campanas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campana_id', 'clave', name='uq_aut_campana_palabras_clave'),
    )
    with op.batch_alter_table('aut_campana_palabras', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_aut_campana_palabras_campana_id'), ['campana_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_aut_campana_palabras_clave'), ['clave'], unique=False)

    op.create_table(
        'aut_campanas_meta',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('campana_id', sa.Integer(), nullable=False),
        sa.Column('meta_campana_id', sa.String(length=40), nullable=False),
        sa.ForeignKeyConstraint(['campana_id'], ['aut_campanas.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('campana_id', 'meta_campana_id', name='uq_aut_campanas_meta'),
    )
    with op.batch_alter_table('aut_campanas_meta', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_aut_campanas_meta_campana_id'), ['campana_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_aut_campanas_meta_meta_campana_id'), ['meta_campana_id'], unique=False)

    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('campana_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('clave', sa.String(length=100), nullable=True))
        batch_op.create_index(batch_op.f('ix_aut_ejecuciones_campana_id'), ['campana_id'], unique=False)
        batch_op.create_foreign_key('fk_aut_ejecuciones_campana_id_aut_campanas', 'aut_campanas',
                                    ['campana_id'], ['id'], ondelete='SET NULL')


def downgrade():
    with op.batch_alter_table('aut_ejecuciones', schema=None) as batch_op:
        batch_op.drop_constraint('fk_aut_ejecuciones_campana_id_aut_campanas', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_aut_ejecuciones_campana_id'))
        batch_op.drop_column('clave')
        batch_op.drop_column('campana_id')
    op.drop_table('aut_campanas_meta')
    op.drop_table('aut_campana_palabras')
    op.drop_table('aut_campanas')
