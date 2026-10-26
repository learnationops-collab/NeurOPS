"""Log de la persona, avisos y configuración del usuario (docs/plan_notas_avisos_settings.md, etapa 1)

- `lead_event_logs`: `person_uuid`, `origen`/`origen_id`, `payload` y `parent_id`; `appointment_id` pasa a
  opcional. Las filas que ya existen se completan con la persona y el origen de su agenda (es la misma
  relación escrita de otra forma: no cambia nada de lo que dicen).
- `notifications`: `tipo`, `target_type`/`target`, `person_uuid` y `payload`, para los avisos de `avisar`.
- `user_view_settings` pasa a ser `user_settings` (`view_name` → `clave`, `settings` → `valor`), con
  `updated_at` y una fila por usuario y clave.

Revision ID: f1a8d3c6b2e9
Revises: c4e9a1d7f2b8
Create Date: 2026-10-26 18:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'f1a8d3c6b2e9'
down_revision = 'c4e9a1d7f2b8'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('lead_event_logs', schema=None) as batch_op:
        batch_op.alter_column('appointment_id', existing_type=sa.Integer(), nullable=True)
        batch_op.add_column(sa.Column('person_uuid', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('origen', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('origen_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('payload', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('parent_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_lead_event_logs_person_uuid', 'people', ['person_uuid'], ['uuid'])
        batch_op.create_foreign_key('fk_lead_event_logs_parent_id', 'lead_event_logs', ['parent_id'], ['id'])
        batch_op.create_index('ix_lead_event_logs_person_fecha', ['person_uuid', 'created_at'], unique=False)
        batch_op.create_index('ix_lead_event_logs_origen', ['origen', 'origen_id'], unique=False)
    op.execute("""
        UPDATE lead_event_logs SET
            person_uuid = (SELECT a.person_uuid FROM appointments a WHERE a.id = lead_event_logs.appointment_id),
            origen = 'appointment',
            origen_id = appointment_id
        WHERE appointment_id IS NOT NULL
    """)

    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tipo', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('target_type', sa.String(length=10), nullable=True))
        batch_op.add_column(sa.Column('target', sa.JSON(), nullable=True))
        batch_op.add_column(sa.Column('person_uuid', sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column('payload', sa.JSON(), nullable=True))
        batch_op.create_foreign_key('fk_notifications_person_uuid', 'people', ['person_uuid'], ['uuid'])
        batch_op.create_index('ix_notifications_tipo', ['tipo'], unique=False)
        batch_op.create_index('ix_notifications_person_uuid', ['person_uuid'], unique=False)

    op.rename_table('user_view_settings', 'user_settings')
    with op.batch_alter_table('user_settings', schema=None) as batch_op:
        batch_op.alter_column('view_name', new_column_name='clave', existing_type=sa.String(length=64),
                              existing_nullable=False)
        batch_op.alter_column('settings', new_column_name='valor', existing_type=sa.JSON())
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(), nullable=True))
        batch_op.create_unique_constraint('uq_user_settings_user_clave', ['user_id', 'clave'])


def downgrade():
    with op.batch_alter_table('user_settings', schema=None) as batch_op:
        batch_op.drop_constraint('uq_user_settings_user_clave', type_='unique')
        batch_op.drop_column('updated_at')
        batch_op.alter_column('valor', new_column_name='settings', existing_type=sa.JSON())
        batch_op.alter_column('clave', new_column_name='view_name', existing_type=sa.String(length=64),
                              existing_nullable=False)
    op.rename_table('user_settings', 'user_view_settings')

    with op.batch_alter_table('notifications', schema=None) as batch_op:
        batch_op.drop_index('ix_notifications_person_uuid')
        batch_op.drop_index('ix_notifications_tipo')
        batch_op.drop_constraint('fk_notifications_person_uuid', type_='foreignkey')
        batch_op.drop_column('payload')
        batch_op.drop_column('person_uuid')
        batch_op.drop_column('target')
        batch_op.drop_column('target_type')
        batch_op.drop_column('tipo')

    # Las entradas sin agenda (las nuevas que no son de una agenda) no entran en el esquema viejo.
    op.execute('DELETE FROM lead_event_logs WHERE appointment_id IS NULL')
    with op.batch_alter_table('lead_event_logs', schema=None) as batch_op:
        batch_op.drop_index('ix_lead_event_logs_origen')
        batch_op.drop_index('ix_lead_event_logs_person_fecha')
        batch_op.drop_constraint('fk_lead_event_logs_parent_id', type_='foreignkey')
        batch_op.drop_constraint('fk_lead_event_logs_person_uuid', type_='foreignkey')
        batch_op.drop_column('parent_id')
        batch_op.drop_column('payload')
        batch_op.drop_column('origen_id')
        batch_op.drop_column('origen')
        batch_op.drop_column('person_uuid')
        batch_op.alter_column('appointment_id', existing_type=sa.Integer(), nullable=False)
