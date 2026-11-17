"""Une las dos cabezas de develop: la unión anterior (embudo de seguimiento) y la de main (Workshop por conjunto)

Revision ID: c1e3a5b7d9f2
Revises: a4c6e8b0d2f1, b8d0f2a4c6e1
Create Date: 2026-11-17

Solo existe en develop: main no tiene el embudo de seguimiento y su cadena es lineal. Sin esta unión,
`flask db upgrade` falla con «Multiple head revisions» y el servidor de pruebas no despliega.
"""

revision = 'c1e3a5b7d9f2'
down_revision = ('a4c6e8b0d2f1', 'b8d0f2a4c6e1')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
