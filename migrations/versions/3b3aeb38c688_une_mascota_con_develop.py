"""Une users.mascota, que llegó a producción por main, con develop

Revision ID: 3b3aeb38c688
Revises: c5d9e3a7f218, ee63a37b67f3
Create Date: 2026-10-08 23:59:00.000000

La columna `users.mascota` llegó a main colgada de su cabeza (`ee63a37b67f3`, sobre 6897f61b3985)
para poder desplegarse sin las migraciones de develop que la separan; develop ya la tenía en
`a4c8e2f6b913`. Esta migración vacía junta las dos cabezas. Las dos son idempotentes: la que corre
segunda ve la columna y no hace nada.
"""

revision = '3b3aeb38c688'
down_revision = ('c5d9e3a7f218', 'ee63a37b67f3')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
