"""Une las dos cabezas de develop: la suya y la de main (flujo de las difusiones de WhatsApp)

Revision ID: e7b9d1f3a5c8
Revises: d6a8c0e2f4b7, a7c9e1f3b5d8
Create Date: 2026-11-24

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'e7b9d1f3a5c8'
down_revision = ('d6a8c0e2f4b7', 'a7c9e1f3b5d8')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
