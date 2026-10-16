"""une las cabezas: leads y respuestas del reporte del setter (main) con los anuncios por palabra clave (develop)

Revision ID: c7e2f9a4d1b6
Revises: b2d6f9a3c8e1, f4c8a2d6b913
Create Date: 2026-10-15 13:00:00.000000

`f4c8a2d6b913` (leads por canal y respuestas a las aperturas) salió primero a main, colgada de la
cabeza de main; develop ya tenía su propia cadena (`b2d6f9a3c8e1`, campañas y conjuntos de los
anuncios). Vacía: solo une las dos ramas para que `flask db upgrade` tenga una sola cabeza.
"""


revision = 'c7e2f9a4d1b6'
down_revision = ('b2d6f9a3c8e1', 'f4c8a2d6b913')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
