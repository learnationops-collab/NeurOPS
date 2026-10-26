"""Avisos: las columnas de `notifications` en castellano (docs/plan_notas_avisos_settings.md, etapa 3)

- `subject` → `asunto`, `content` → `descripcion`, `associated_type` → `origen`, `associated_id` →
  `origen_id`, `read_by` → `leido_por`.
- Se va `related_users` (nadie la leía).
- `target_users` queda solo para los avisos viejos (no tienen `target_type` y la campanita no los muestra);
  se borra con las tablas viejas al final de la etapa 2.

Revision ID: a7c3e9f2d4b1
Revises: d7b3e9a1f4c2
Create Date: 2026-10-26 22:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'a7c3e9f2d4b1'
down_revision = 'd7b3e9a1f4c2'
branch_labels = None
depends_on = None

RENOMBRES = [('subject', 'asunto'), ('content', 'descripcion'), ('associated_type', 'origen'),
             ('associated_id', 'origen_id'), ('read_by', 'leido_por')]


def upgrade():
    with op.batch_alter_table('notifications') as t:
        for viejo, nuevo in RENOMBRES:
            t.alter_column(viejo, new_column_name=nuevo)
        t.drop_column('related_users')
        t.alter_column('target_users', existing_type=sa.JSON(), nullable=True)
    op.create_index('ix_notifications_origen', 'notifications', ['origen', 'origen_id'])


def downgrade():
    op.drop_index('ix_notifications_origen', table_name='notifications')
    with op.batch_alter_table('notifications') as t:
        t.add_column(sa.Column('related_users', sa.JSON(), nullable=True))
        for viejo, nuevo in RENOMBRES:
            t.alter_column(nuevo, new_column_name=viejo)
