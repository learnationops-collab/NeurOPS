"""Hiring: link público propio por formulario (`hiring_forms.slug`)

Revision ID: b7d9f1a3c5e8
Revises: a6c8e0b2d4f6
Create Date: 2026-11-01

Cada formulario se publica en institute.thelearnation.com/vacante/<slug>/ y puede
haber varios activos a la vez. Rellena los existentes: el activo más antiguo queda
con `assistant` (el link de siempre) y los demás con su nombre en minúsculas y
guiones. Idempotente y no destructiva: una columna opcional y un índice único.
"""
import re
import unicodedata

from alembic import op
import sqlalchemy as sa


revision = 'b7d9f1a3c5e8'
down_revision = 'a6c8e0b2d4f6'
branch_labels = None
depends_on = None

IX_SLUG = 'ix_hiring_forms_slug'


def _slug(texto):
    plano = unicodedata.normalize('NFKD', texto or '').encode('ascii', 'ignore').decode()
    slug = re.sub(r'[^a-z0-9]+', '-', plano.lower()).strip('-')[:56].strip('-')
    return slug if len(slug) >= 3 else 'formulario'


def upgrade():
    bind = op.get_bind()
    columnas = {c['name'] for c in sa.inspect(bind).get_columns('hiring_forms')}
    if 'slug' not in columnas:
        with op.batch_alter_table('hiring_forms') as batch_op:
            batch_op.add_column(sa.Column('slug', sa.String(length=60), nullable=True))

    filas = bind.execute(sa.text(
        'SELECT id, nombre, activo, slug FROM hiring_forms ORDER BY activo DESC, id')).fetchall()
    usados = {f.slug for f in filas if f.slug}
    for f in filas:
        if f.slug:
            continue
        base = 'assistant' if f.activo and 'assistant' not in usados else _slug(f.nombre)
        slug, n = base, 2
        while slug in usados:
            slug, n = f'{base}-{n}', n + 1
        usados.add(slug)
        bind.execute(sa.text('UPDATE hiring_forms SET slug = :s WHERE id = :i'), {'s': slug, 'i': f.id})

    indices = {i['name'] for i in sa.inspect(bind).get_indexes('hiring_forms')}
    if IX_SLUG not in indices:
        op.create_index(IX_SLUG, 'hiring_forms', ['slug'], unique=True)


def downgrade():
    op.drop_index(IX_SLUG, table_name='hiring_forms')
    with op.batch_alter_table('hiring_forms') as batch_op:
        batch_op.drop_column('slug')
