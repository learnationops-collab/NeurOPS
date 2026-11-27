"""Une las dos cabezas de develop: la suya y la de main (etiquetas que pone y saca, ADR-W265)

Revision ID: d2f4b6c8e0a1
Revises: b9d1f3a5c7e8, c1e3a5b7d9f2
Create Date: 2026-11-27

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'd2f4b6c8e0a1'
down_revision = ('b9d1f3a5c7e8', 'c1e3a5b7d9f2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
