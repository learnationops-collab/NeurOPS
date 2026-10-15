"""Motor de automatizaciones de Instagram: flujos, versiones, contactos, ejecuciones y mensajes

Revision ID: b3d7f1a9c562
Revises: f4c8a2d6b913
Create Date: 2026-10-15 12:00:00.000000

Además, instagram_webhook_eventos guarda cuándo lo procesó el motor y con qué resultado.
"""
import sqlalchemy as sa
from alembic import op

revision = 'b3d7f1a9c562'
down_revision = 'f4c8a2d6b913'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('instagram_webhook_eventos', sa.Column('procesado_en', sa.DateTime(), nullable=True))
    op.add_column('instagram_webhook_eventos', sa.Column('resultado', sa.String(length=200), nullable=True))
    op.create_index('ix_instagram_webhook_eventos_procesado_en', 'instagram_webhook_eventos', ['procesado_en'])
    # Lo recibido antes de que existiera el motor no se contesta nunca: queda marcado como ya visto.
    op.execute("UPDATE instagram_webhook_eventos SET procesado_en = recibido_en, resultado = 'previo_al_motor'")

    op.create_table(
        'aut_flujos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('grafo', sa.JSON(), nullable=False),
        sa.Column('version_publicada_id', sa.Integer(), nullable=True),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.Column('actualizado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'aut_flujo_versiones',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('flujo_id', sa.Integer(), nullable=False),
        sa.Column('numero', sa.Integer(), nullable=False),
        sa.Column('grafo', sa.JSON(), nullable=False),
        sa.Column('publicada_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['flujo_id'], ['aut_flujos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('flujo_id', 'numero', name='uq_aut_flujo_versiones_numero'),
    )
    op.create_index('ix_aut_flujo_versiones_flujo_id', 'aut_flujo_versiones', ['flujo_id'])
    op.create_foreign_key('fk_aut_flujos_version_publicada', 'aut_flujos', 'aut_flujo_versiones',
                          ['version_publicada_id'], ['id'])

    op.create_table(
        'ig_contactos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('igsid', sa.String(length=64), nullable=False),
        sa.Column('username', sa.String(length=100), nullable=True),
        sa.Column('nombre', sa.String(length=150), nullable=True),
        sa.Column('ultimo_entrante_en', sa.DateTime(), nullable=True),
        sa.Column('bot_pausado_hasta', sa.DateTime(), nullable=True),
        sa.Column('variables', sa.JSON(), nullable=False),
        sa.Column('creado_en', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('igsid'),
    )
    op.create_table(
        'aut_ejecuciones',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contacto_id', sa.Integer(), nullable=False),
        sa.Column('version_id', sa.Integer(), nullable=False),
        sa.Column('estado', sa.String(length=20), nullable=False),
        sa.Column('nodo_actual', sa.String(length=64), nullable=True),
        sa.Column('despertar_en', sa.DateTime(), nullable=True),
        sa.Column('comentario_id', sa.String(length=64), nullable=True),
        sa.Column('detalle', sa.String(length=300), nullable=True),
        sa.Column('iniciada_en', sa.DateTime(), nullable=False),
        sa.Column('actualizada_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['contacto_id'], ['ig_contactos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['version_id'], ['aut_flujo_versiones.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_aut_ejecuciones_contacto_id', 'aut_ejecuciones', ['contacto_id'])
    op.create_index('ix_aut_ejecuciones_version_id', 'aut_ejecuciones', ['version_id'])
    op.create_index('ix_aut_ejecuciones_estado', 'aut_ejecuciones', ['estado'])
    op.create_index('ix_aut_ejecuciones_despertar_en', 'aut_ejecuciones', ['despertar_en'])

    op.create_table(
        'ig_mensajes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('contacto_id', sa.Integer(), nullable=False),
        sa.Column('mid', sa.String(length=400), nullable=True),
        sa.Column('direccion', sa.String(length=10), nullable=False),
        sa.Column('origen', sa.String(length=10), nullable=False),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('contenido', sa.JSON(), nullable=True),
        sa.Column('ejecucion_id', sa.Integer(), nullable=True),
        sa.Column('nodo_id', sa.String(length=64), nullable=True),
        sa.Column('enviado_en', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['contacto_id'], ['ig_contactos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['ejecucion_id'], ['aut_ejecuciones.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('mid'),
    )
    op.create_index('ix_ig_mensajes_contacto_id', 'ig_mensajes', ['contacto_id'])
    op.create_index('ix_ig_mensajes_enviado_en', 'ig_mensajes', ['enviado_en'])


def downgrade():
    op.drop_index('ix_ig_mensajes_enviado_en', table_name='ig_mensajes')
    op.drop_index('ix_ig_mensajes_contacto_id', table_name='ig_mensajes')
    op.drop_table('ig_mensajes')
    op.drop_index('ix_aut_ejecuciones_despertar_en', table_name='aut_ejecuciones')
    op.drop_index('ix_aut_ejecuciones_estado', table_name='aut_ejecuciones')
    op.drop_index('ix_aut_ejecuciones_version_id', table_name='aut_ejecuciones')
    op.drop_index('ix_aut_ejecuciones_contacto_id', table_name='aut_ejecuciones')
    op.drop_table('aut_ejecuciones')
    op.drop_table('ig_contactos')
    op.drop_constraint('fk_aut_flujos_version_publicada', 'aut_flujos', type_='foreignkey')
    op.drop_index('ix_aut_flujo_versiones_flujo_id', table_name='aut_flujo_versiones')
    op.drop_table('aut_flujo_versiones')
    op.drop_table('aut_flujos')
    op.drop_index('ix_instagram_webhook_eventos_procesado_en', table_name='instagram_webhook_eventos')
    op.drop_column('instagram_webhook_eventos', 'resultado')
    op.drop_column('instagram_webhook_eventos', 'procesado_en')
