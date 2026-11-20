"""Une las dos cabezas de develop: la suya y la de main (programas de las campañas de Meta)

Revision ID: e4a6c8d0f2b5
Revises: d2f4b6c8e0a3, d5f8b1c3e7a9
Create Date: 2026-11-19

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'e4a6c8d0f2b5'
down_revision = ('d2f4b6c8e0a3', 'd5f8b1c3e7a9')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
