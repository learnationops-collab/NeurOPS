"""Une financial_sales.transferido_a, que llegó a producción por main, con develop

Revision ID: 93e66265ae82
Revises: 3b3aeb38c688, 132b9589504a
Create Date: 2026-10-09 18:00:00.000000

La columna `financial_sales.transferido_a` (a quién del equipo se le hizo un pago por
transferencia, 09/10/2026) llegó a main colgada de su cabeza (`132b9589504a`, sobre ee63a37b67f3)
para desplegarse sin las migraciones de develop. Esta migración vacía junta las dos cabezas, como
`3b3aeb38c688` hizo con `users.mascota`. `132b9589504a` es idempotente: en una base que ya tiene la
columna no hace nada.
"""

revision = '93e66265ae82'
down_revision = ('3b3aeb38c688', '132b9589504a')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
