"""Une las dos cabezas de develop: la suya y la de main (formulario de Closer, ADR-W280)

Revision ID: a7c9e1b3d5f2
Revises: f4b6d8e0a2c3, d4f6a8c0e2b1
Create Date: 2026-11-28

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'a7c9e1b3d5f2'
down_revision = ('f4b6d8e0a2c3', 'd4f6a8c0e2b1')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
