"""Learnation Marketing en Work (ADR-W278): documentos y archivos del artifact, con la copia de su base

Revision ID: c7e1a9d3b5f2
Revises: b8d2f4a6c1e7
Create Date: 2026-11-27

Idempotente. Si `marketing_app_docs` está vacía, carga la copia de la base del artifact de claude.ai
(app/marketing_app/semilla.json, exportada el 27/11/2026): creativos, piezas, anuncios, criterios e historia.
"""
import json
import os
from datetime import datetime

import sqlalchemy as sa
from alembic import op

revision = 'c7e1a9d3b5f2'
down_revision = 'b8d2f4a6c1e7'
branch_labels = None
depends_on = None

SEMILLA = os.path.join(os.path.dirname(__file__), '..', '..', 'app', 'marketing_app', 'semilla.json')


def upgrade():
    tablas = sa.inspect(op.get_bind()).get_table_names()
    if 'marketing_app_docs' not in tablas:
        op.create_table(
            'marketing_app_docs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('collection', sa.String(1000), nullable=False),
            sa.Column('doc_id', sa.String(200), nullable=False),
            sa.Column('data', sa.JSON(), nullable=False),
            sa.Column('version', sa.Integer(), nullable=False, server_default='1'),
            sa.Column('updated_at', sa.DateTime(), nullable=False),
            sa.Column('updated_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
            sa.UniqueConstraint('collection', 'doc_id', name='uq_marketing_app_docs_path'),
        )
        op.create_index('ix_marketing_app_docs_collection', 'marketing_app_docs', ['collection'])
    if 'marketing_app_assets' not in tablas:
        op.create_table(
            'marketing_app_assets',
            sa.Column('id', sa.String(32), primary_key=True),
            sa.Column('content_type', sa.String(120), nullable=False),
            sa.Column('filename', sa.String(255), nullable=True),
            sa.Column('size', sa.Integer(), nullable=False),
            sa.Column('data', sa.LargeBinary(), nullable=False),
            sa.Column('created_at', sa.DateTime(), nullable=False),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        )
    _sembrar()


def _sembrar():
    bind = op.get_bind()
    if bind.execute(sa.text('SELECT COUNT(*) FROM marketing_app_docs')).scalar():
        return
    if not os.path.exists(SEMILLA):
        return
    with open(SEMILLA, encoding='utf-8') as f:
        semilla = json.load(f)
    docs = sa.table('marketing_app_docs', sa.column('collection', sa.String), sa.column('doc_id', sa.String),
                    sa.column('data', sa.JSON), sa.column('version', sa.Integer), sa.column('updated_at', sa.DateTime))
    ahora = datetime.utcnow()
    filas = [{'collection': col, 'doc_id': doc_id, 'data': data, 'version': 1, 'updated_at': ahora}
             for col, porid in semilla.items() for doc_id, data in porid.items()]
    if filas:
        op.bulk_insert(docs, filas)


def downgrade():
    op.drop_table('marketing_app_assets')
    op.drop_index('ix_marketing_app_docs_collection', table_name='marketing_app_docs')
    op.drop_table('marketing_app_docs')
