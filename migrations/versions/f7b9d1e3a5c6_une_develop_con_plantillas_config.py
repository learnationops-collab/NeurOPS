"""Une las dos cabezas de develop: la suya y la de main (opción única de las plantillas, ADR-W260)

Revision ID: f7b9d1e3a5c6
Revises: d5f7b9c1e3a4, e6a8c0d2f4b5
Create Date: 2026-11-27

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'f7b9d1e3a5c6'
down_revision = ('d5f7b9c1e3a4', 'e6a8c0d2f4b5')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
