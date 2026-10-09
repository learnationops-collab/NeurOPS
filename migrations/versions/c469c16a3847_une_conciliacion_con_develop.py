"""Une la conciliación de pasarelas, que llegó a producción por main, con develop

Revision ID: c469c16a3847
Revises: 93e66265ae82, 6f248427caf5
Create Date: 2026-10-09 20:00:00.000000

Las tablas de Finanzas › Diferencias (`conciliacion_cargas`, `conciliacion_movimientos` y
`conciliacion_revisiones`, 09/10/2026) llegaron a main colgadas de su cabeza (`6f248427caf5`, sobre
132b9589504a) para desplegarse sin las migraciones de develop. Esta migración vacía junta las dos
cabezas, como `93e66265ae82` hizo con `transferido_a`. `6f248427caf5` es idempotente: en una base
que ya tiene las tablas no hace nada.
"""

revision = 'c469c16a3847'
down_revision = ('93e66265ae82', '6f248427caf5')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
