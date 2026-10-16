"""Une `aut_flujos.activo_desde`, que llegó a producción por main, con develop

Revision ID: 8efcff59c55b
Revises: a1c7e4b9d3f2, c5e1a7d3f924
Create Date: 2026-10-16 12:30:00.000000

La columna `aut_flujos.activo_desde` (c5e1a7d3f924) se subió directo a main, y develop ya tenía su
propia cabeza (a1c7e4b9d3f2, el destino de cada anuncio de Meta). Con dos cabezas el
`flask db upgrade` del despliegue de staging falla; esta migración vacía las junta.
"""

revision = '8efcff59c55b'
down_revision = ('a1c7e4b9d3f2', 'c5e1a7d3f924')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
