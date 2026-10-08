"""Une la cadena de Hiring que llegó a producción por main con la de develop

Revision ID: b7f3d1e9a258
Revises: a4c8e2f6b913, e4a7c1b9f352
Create Date: 2026-10-08 11:00:00.000000

Learnation Talent se subió directo a main con tres migraciones colgadas de la
cabeza de main (b3e6d9a1c724 -> d8c2f5a7e913 -> e4a7c1b9f352). Develop tenía
las dos primeras con otros ids (c7e2a9d4b158 y f2b8d4a6c910), que ahora son
idempotentes. Esta migración vacía junta las dos cabezas.
"""

revision = 'b7f3d1e9a258'
down_revision = ('a4c8e2f6b913', 'e4a7c1b9f352')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
