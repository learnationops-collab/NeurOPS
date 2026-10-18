"""conversational_messages.rama y lead_answers.calificacion_por_rama: la calificación que deja la rama

Kerwin (18/10/2026): recibir «¿Qué quiere mejorar?» marca descalificado cuando ManyChat no manda el
dato (en esa rama no lo manda: 16 personas «Sin dato» en 7 días). Se marca ese mensaje como de los
descalificados y se completa para atrás, como hace `rama_mensajes.reaplicar`: a quien lo recibió y no
tiene ningún sí o no, el envío de ese mensaje queda descalificado (deducido). Una base sin ese mensaje
(staging, local) no cambia.

Revision ID: b8e2d4f6a1c9
Revises: a3f9c1e7b2d4
Create Date: 2026-10-18 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'b8e2d4f6a1c9'
down_revision = 'a3f9c1e7b2d4'
branch_labels = None
depends_on = None

TITULO = '¿Qué quiere mejorar?'


def upgrade():
    with op.batch_alter_table('conversational_messages', schema=None) as batch_op:
        batch_op.add_column(sa.Column('rama', sa.String(length=20), nullable=True))
    with op.batch_alter_table('lead_answers', schema=None) as batch_op:
        batch_op.add_column(sa.Column('calificacion_por_rama', sa.Boolean(), nullable=False, server_default=sa.false()))

    conexion = op.get_bind()
    conexion.execute(sa.text("UPDATE conversational_messages SET rama = 'descalificados' WHERE title = :t"), {'t': TITULO})
    ids = [r[0] for r in conexion.execute(
        sa.text("SELECT message_id FROM conversational_messages WHERE rama = 'descalificados'"))]
    if not ids:
        return
    con_dato = {r[0] for r in conexion.execute(
        sa.text("SELECT DISTINCT lead_id FROM lead_answers WHERE qualification IN ('true', 'false')"))}
    vistas = set()
    for mid in ids:
        filas = conexion.execute(sa.text(
            "SELECT id, lead_id FROM lead_answers WHERE id_option_send = :m "
            "AND (qualification IS NULL OR qualification NOT IN ('true', 'false')) ORDER BY created_at, id"),
            {'m': mid}).fetchall()
        for answer_id, lead_id in filas:
            if lead_id in con_dato or lead_id in vistas:
                continue
            conexion.execute(sa.text(
                "UPDATE lead_answers SET qualification = 'false', calificacion_por_rama = :si WHERE id = :i"),
                {'si': True, 'i': answer_id})
            vistas.add(lead_id)


def downgrade():
    op.execute("UPDATE lead_answers SET qualification = 'null' WHERE calificacion_por_rama")
    with op.batch_alter_table('lead_answers', schema=None) as batch_op:
        batch_op.drop_column('calificacion_por_rama')
    with op.batch_alter_table('conversational_messages', schema=None) as batch_op:
        batch_op.drop_column('rama')
