"""Une la comisión manual de la nómina, que llegó a producción por main, con develop

Revision ID: c5d9e3a7f218
Revises: b7f3d1e9a258, 6897f61b3985
Create Date: 2026-10-08 23:00:00.000000

La columna `monthly_payroll.commissions_manual` (6897f61b3985) se subió directo a main colgada
de su cabeza (e4a7c1b9f352), que develop ya tenía unida en b7f3d1e9a258. Esta migración vacía
junta las dos cabezas; la de main es idempotente, así que en una base que ya la corrió no hace
nada.
"""

revision = 'c5d9e3a7f218'
down_revision = ('b7f3d1e9a258', '6897f61b3985')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
