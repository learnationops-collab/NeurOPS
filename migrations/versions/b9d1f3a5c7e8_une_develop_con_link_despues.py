"""Une las dos cabezas de develop: la suya y la de main (mensaje al abrir el link, ADR-W261)

Revision ID: b9d1f3a5c7e8
Revises: f7b9d1e3a5c6, a8c0e2f4b6d7
Create Date: 2026-11-27

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'b9d1f3a5c7e8'
down_revision = ('f7b9d1e3a5c6', 'a8c0e2f4b6d7')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
