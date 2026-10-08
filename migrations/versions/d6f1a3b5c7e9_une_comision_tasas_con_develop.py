"""Une la rama de comision_tasas con la de develop

Revision ID: d6f1a3b5c7e9
Revises: f2b8d4a6c910, a9d3c5e7f142
Create Date: 2026-10-08 12:05:00.000000

`a9d3c5e7f142` (porcentajes de comisión) cuelga de la cabeza de main para poder llegar a producción
antes que las ocho migraciones de develop que la separan; esta migración vacía las junta para que
develop siga teniendo una sola cabeza. Cuando develop pase entero a main, producción (parada en
`a9d3c5e7f142`) aplica la otra rama y termina acá.
"""

revision = 'd6f1a3b5c7e9'
down_revision = ('f2b8d4a6c910', 'a9d3c5e7f142')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
