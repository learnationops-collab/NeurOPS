"""appointments: las agendas que archivó el barrido pasan a 'Archivada sin reporte'

Revision ID: a3f6c9e2b815
Revises: b7e4c2a9d561
Create Date: 2026-10-10 18:00:00.000000

Hasta el 10/10/2026 el barrido de mantenimiento (`CloserService.archive_stale_backlog`) dejaba como
'Lead Perdido' la agenda que nadie confirmó ni reportó en 30 días: el mismo valor con el que un
closer descarta un lead. En la base local eran 2569 de 2589 «Lead perdido». El dueño pidió que
tengan su propio estado, 'Archivada sin reporte', y el barrido ya lo escribe; esto pasa las viejas.

Solo se tocan las que SIGUEN como las dejó el barrido: `closer_result = 'Lead Perdido'` y la firma
«[Sistema] Archivado automáticamente» en `closer_notes`. Una que alguien reportó después (un closer,
o `corregir_archivados_con_pago.py`, que las pasa a 'Show up') ya no dice 'Lead Perdido' y queda
como está. Los números no cambian: los dos estados son descartadas y van al mismo grupo.

Idempotente (la segunda vez no encuentra ninguna). El downgrade devuelve a 'Lead Perdido' las que
tienen la firma y siguen como 'Archivada sin reporte'.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a3f6c9e2b815'
down_revision = 'b7e4c2a9d561'
branch_labels = None
depends_on = None

LEAD_PERDIDO = 'Lead Perdido'
ARCHIVADA = 'Archivada sin reporte'
# La firma que el barrido agrega a las notas (`NOTA_ARCHIVADA` en closer_agendas_service). Acá va
# escrita a mano: una migración no importa código de la app, que puede cambiar después.
FIRMA = '%[Sistema] Archivado automáticamente%'

citas = sa.table('appointments',
                 sa.column('closer_result', sa.String),
                 sa.column('closer_notes', sa.Text))


def _pasar(de, a):
    op.execute(citas.update()
               .where(citas.c.closer_result == de)
               .where(citas.c.closer_notes.like(FIRMA))
               .values(closer_result=a))


def upgrade():
    _pasar(LEAD_PERDIDO, ARCHIVADA)


def downgrade():
    _pasar(ARCHIVADA, LEAD_PERDIDO)
