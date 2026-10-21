"""Se borra la copia del contacto de financial_agendas: lead, mail, whatsapp e instagram (Etapa 2c, parte 2)

El contacto de una agenda es el de su persona (`FinancialAgenda.contacto()`), y toda agenda tiene una desde
que entra (`agenda_contacto_service.dar_persona`, que con ningún dato de contacto la crea solo con el nombre).
`nombre` se queda: es la fuente o el setter, no la copia.

Antes del borrado, a cada agenda sin persona (en la copia de producción del 21/10/2026 eran 2 de 4.411, viejas)
se le crea una con el nombre de `lead` o, si está vacío, el de `nombre`. Así ninguna queda sin persona.

Correr SOLO con la aprobación de Santiago y cuando ya no quede código que lea o escriba esas columnas:
`person_service._persona_de_agenda` (2c-leads), `sheets_service._rebuild_agendas` y `financial_sales.py`
(2c-parte3). El downgrade vuelve a crear las columnas vacías: lo que tenían no vuelve; las personas creadas
para las agendas sin persona se quedan.

Revision ID: d4a9e2c7b1f5
Revises: c3f5a8d1e6b4
Create Date: 2026-10-21 20:00:00.000000

"""
from datetime import datetime
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = 'd4a9e2c7b1f5'
down_revision = 'c3f5a8d1e6b4'
branch_labels = None
depends_on = None

COLUMNAS = ('lead', 'mail', 'whatsapp', 'instagram')


def _persona_a_las_agendas_sin_persona(bind):
    agendas = bind.execute(sa.text(
        'SELECT id, lead, nombre FROM financial_agendas WHERE person_uuid IS NULL')).fetchall()
    for agenda_id, lead, nombre in agendas:
        uuid = str(uuid4())
        nombre_persona = ((lead or '').strip() or (nombre or '').strip() or None)
        bind.execute(sa.text('INSERT INTO people (uuid, full_name, created_at) VALUES (:u, :n, :c)'),
                     {'u': uuid, 'n': nombre_persona[:160] if nombre_persona else None, 'c': datetime.utcnow()})
        bind.execute(sa.text('UPDATE financial_agendas SET person_uuid = :u WHERE id = :i'), {'u': uuid, 'i': agenda_id})
    return len(agendas)


def upgrade():
    _persona_a_las_agendas_sin_persona(op.get_bind())
    with op.batch_alter_table('financial_agendas') as batch:
        for columna in COLUMNAS:
            batch.drop_column(columna)


def downgrade():
    with op.batch_alter_table('financial_agendas') as batch:
        for columna in COLUMNAS:
            batch.add_column(sa.Column(columna, sa.String(length=255), nullable=True))
