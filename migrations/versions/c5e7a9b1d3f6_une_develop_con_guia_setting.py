"""Une las dos cabezas de develop: la suya y la de main (Guía del setting)

Revision ID: c5e7a9b1d3f6
Revises: b3d7f1a9c5e2, a8c2e4f6b1d3
Create Date: 2026-11-23

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'c5e7a9b1d3f6'
down_revision = ('b3d7f1a9c5e2', 'a8c2e4f6b1d3')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
