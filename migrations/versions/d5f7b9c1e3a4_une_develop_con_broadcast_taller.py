"""Une las dos cabezas de develop: la suya y la de main (broadcast de cada taller, ADR-W259)

Revision ID: d5f7b9c1e3a4
Revises: e7b9d1f3a5c8, c4e6a8b0d2f3
Create Date: 2026-11-26

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'd5f7b9c1e3a4'
down_revision = ('e7b9d1f3a5c8', 'c4e6a8b0d2f3')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
