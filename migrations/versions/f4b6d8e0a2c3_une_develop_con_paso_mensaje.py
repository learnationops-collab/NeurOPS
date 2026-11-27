"""Une las dos cabezas de develop: la suya y la de main (pasos de mensaje común, ADR-W266)

Revision ID: f4b6d8e0a2c3
Revises: d2f4b6c8e0a1, e3a5c7d9f1b4
Create Date: 2026-11-27

Solo existe en develop. Sin esta unión, `flask db upgrade` falla con «Multiple head revisions»
y el servidor de pruebas no despliega.
"""

revision = 'f4b6d8e0a2c3'
down_revision = ('d2f4b6c8e0a1', 'e3a5c7d9f1b4')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
