"""Une las dos cabezas de develop: la suya y la de main (postulaciones de Closer archivadas)

Revision ID: b3d7f1a9c5e2
Revises: e4a6c8d0f2b5, f7b9d1e3a5c7
Create Date: 2026-11-21

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'b3d7f1a9c5e2'
down_revision = ('e4a6c8d0f2b5', 'f7b9d1e3a5c7')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
