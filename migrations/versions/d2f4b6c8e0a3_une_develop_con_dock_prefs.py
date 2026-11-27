"""Une las dos cabezas de develop: la unión de Workshop por conjunto y la de main (preferencias del dock)

Revision ID: d2f4b6c8e0a3
Revises: c1e3a5b7d9f0, c4e7a9d1f3b2
Create Date: 2026-11-17

Solo existe en develop: la cadena de main es lineal. Sin esta unión, `flask db upgrade` falla con
«Multiple head revisions» y el servidor de pruebas no despliega.
"""

revision = 'd2f4b6c8e0a3'
down_revision = ('c1e3a5b7d9f0', 'c4e7a9d1f3b2')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
