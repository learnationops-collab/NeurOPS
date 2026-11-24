"""Une las dos cabezas de develop: la suya y la de main (difusiones de WhatsApp)

Revision ID: d6a8c0e2f4b7
Revises: c5e7a9b1d3f6, f3b5d7e9a1c4
Create Date: 2026-11-24

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'd6a8c0e2f4b7'
down_revision = ('c5e7a9b1d3f6', 'f3b5d7e9a1c4')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
