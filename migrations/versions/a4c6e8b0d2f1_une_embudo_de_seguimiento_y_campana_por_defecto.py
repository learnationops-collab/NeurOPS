"""Une la cabeza de develop (embudo de seguimiento) con la de main (campaña por defecto)

Solo en develop: c7d9e1f3a5b8 llegó a main antes y entró a develop con la mezcla. Con dos cabezas,
`flask db upgrade` fallaba y el servidor de pruebas no desplegaba.

Revision ID: a4c6e8b0d2f1
Revises: e3a9c5b17d40, c7d9e1f3a5b8
Create Date: 2026-11-16 22:10:00.000000

"""

revision = 'a4c6e8b0d2f1'
down_revision = ('e3a9c5b17d40', 'c7d9e1f3a5b8')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
