"""Embudos del Inbox y cadencias de seguimiento por fase (ADR-W204)

Revision ID: e8f0a2c4b6d1
Revises: d1a3c5e7f9b2
Create Date: 2026-11-24

Idempotente: lo que ya existe no se toca. Crea el embudo Conversión (el de siempre), con los seguimientos
automáticos apagados.
"""
import sqlalchemy as sa
from alembic import op

revision = 'e8f0a2c4b6d1'
down_revision = 'd1a3c5e7f9b2'
branch_labels = None
depends_on = None


def _insp():
    return sa.inspect(op.get_bind())


def _columnas(tabla):
    return {c['name'] for c in _insp().get_columns(tabla)}


def _agregar_fk(tabla, columna, ondelete):
    if columna in _columnas(tabla):
        return
    with op.batch_alter_table(tabla) as t:
        t.add_column(sa.Column(columna, sa.Integer(), nullable=True))
        t.create_foreign_key(f'fk_{tabla}_{columna}', 'aut_embudos', [columna], ['id'], ondelete=ondelete)
    op.create_index(f'ix_{tabla}_{columna}', tabla, [columna])


def upgrade():
    if 'aut_embudos' not in set(_insp().get_table_names()):
        op.create_table(
            'aut_embudos',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('slug', sa.String(length=40), nullable=False, unique=True),
            sa.Column('nombre', sa.String(length=80), nullable=False),
            sa.Column('descripcion', sa.String(length=400), nullable=True),
            sa.Column('fases', sa.JSON(), nullable=True),
            sa.Column('variables', sa.JSON(), nullable=True),
            sa.Column('seguimientos_activos', sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column('seguimientos_desde', sa.DateTime(), nullable=True),
            sa.Column('orden', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('creado_en', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
    existe = op.get_bind().execute(sa.text("SELECT 1 FROM aut_embudos WHERE slug = 'conversion'")).first()
    if not existe:
        op.execute(sa.text(
            "INSERT INTO aut_embudos (slug, nombre, descripcion, seguimientos_activos, orden, creado_en) VALUES "
            "('conversion', 'Conversión', 'Anuncios e inbound hasta la llamada agendada.', false, 0, CURRENT_TIMESTAMP)"))
    _agregar_fk('aut_flujos', 'embudo_id', 'SET NULL')
    if 'fase' not in _columnas('aut_flujos'):
        with op.batch_alter_table('aut_flujos') as t:
            t.add_column(sa.Column('fase', sa.String(length=20), nullable=True))
    _agregar_fk('ig_contactos', 'embudo_id', 'SET NULL')
    _agregar_fk('guia_setting_versiones', 'embudo_id', 'CASCADE')
    columnas = _columnas('aut_seguimientos')
    if 'cadencia' not in columnas:
        with op.batch_alter_table('aut_seguimientos') as t:
            t.add_column(sa.Column('cadencia', sa.String(length=120), nullable=True))
            t.add_column(sa.Column('ciclo', sa.DateTime(), nullable=True))
            t.create_unique_constraint('uq_aut_seguimientos_cadencia', ['contacto_id', 'cadencia', 'ciclo'])
        op.create_index('ix_aut_seguimientos_cadencia', 'aut_seguimientos', ['cadencia'])


def downgrade():
    op.drop_index('ix_aut_seguimientos_cadencia', table_name='aut_seguimientos')
    with op.batch_alter_table('aut_seguimientos') as t:
        t.drop_constraint('uq_aut_seguimientos_cadencia', type_='unique')
        t.drop_column('ciclo')
        t.drop_column('cadencia')
    for tabla in ('guia_setting_versiones', 'ig_contactos', 'aut_flujos'):
        op.drop_index(f'ix_{tabla}_embudo_id', table_name=tabla)
        with op.batch_alter_table(tabla) as t:
            t.drop_constraint(f'fk_{tabla}_embudo_id', type_='foreignkey')
            t.drop_column('embudo_id')
    with op.batch_alter_table('aut_flujos') as t:
        t.drop_column('fase')
    op.drop_table('aut_embudos')
