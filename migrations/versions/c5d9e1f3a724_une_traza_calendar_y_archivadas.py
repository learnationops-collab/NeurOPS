"""Une la traza de Google Calendar de main con las archivadas sin reporte de develop

Revision ID: c5d9e1f3a724
Revises: e7a1c3f5b902, a3f6c9e2b815
Create Date: 2026-10-13 12:00:00.000000

Producción llegó a e7a1c3f5b902 (columnas calendar_* de appointments) y develop
a a3f6c9e2b815 (estado 'Archivada sin reporte'). No se tocan: esta migración
vacía junta las dos cabezas al pasar develop a main.
"""

revision = 'c5d9e1f3a724'
down_revision = ('e7a1c3f5b902', 'a3f6c9e2b815')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
