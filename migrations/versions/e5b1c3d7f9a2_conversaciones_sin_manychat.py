"""Conversaciones sin ManyChat: manychat_leads pasa a ser conversations (23/10/2026)

ManyChat se apagó: lo reemplaza el motor propio de Instagram. Su tabla de prospectos queda como la
conversación de cada persona (una por canal), con sus interacciones en `lead_answers`:

  · Se borra la `conversations` anterior: era un espejo de manychat_leads y lead_answers que nadie leía.
  · manychat_leads → conversations; manychat_id → external_id; se suma `channel` ('instagram').
  · lead_answers.lead_id → conversation_id.
  · Se borran manychat_ad_leads (la tabla de leads de antes) y las plantillas de difusión del workshop por
    ManyChat (workshop_templates, workshop_buttons, workshop_template_sends, workshop_interactions; vacías).
  · El origen de las agendas «ManyChat» y «ManyChat / Instagram» pasa a «Instagram».

El downgrade vuelve a los nombres de antes; las tablas borradas vuelven vacías y el origen no se revierte.

Revision ID: e5b1c3d7f9a2
Revises: d4a9e2c7b1f5
Create Date: 2026-10-23 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'e5b1c3d7f9a2'
down_revision = 'd4a9e2c7b1f5'
branch_labels = None
depends_on = None

TABLAS_WORKSHOP = ('workshop_interactions', 'workshop_buttons', 'workshop_template_sends', 'workshop_templates')


def upgrade():
    op.drop_table('conversations')

    op.rename_table('manychat_leads', 'conversations')
    op.alter_column('conversations', 'manychat_id', new_column_name='external_id')
    op.add_column('conversations', sa.Column('channel', sa.String(20), nullable=False, server_default='instagram'))
    op.execute('ALTER SEQUENCE IF EXISTS manychat_leads_id_seq RENAME TO conversations_id_seq')
    op.execute('ALTER INDEX IF EXISTS manychat_leads_pkey RENAME TO conversations_pkey')
    op.execute('ALTER INDEX IF EXISTS manychat_leads_manychat_id_key RENAME TO conversations_external_id_key')
    op.execute('ALTER INDEX IF EXISTS ix_manychat_leads_person_uuid RENAME TO ix_conversations_person_uuid')

    op.alter_column('lead_answers', 'lead_id', new_column_name='conversation_id')
    op.execute('CREATE INDEX IF NOT EXISTS ix_lead_answers_conversation_id ON lead_answers (conversation_id)')

    op.drop_table('manychat_ad_leads')
    for tabla in TABLAS_WORKSHOP:
        op.execute(f'DROP TABLE IF EXISTS {tabla}')

    op.execute("UPDATE appointments SET origin = 'Instagram' WHERE origin IN ('ManyChat', 'ManyChat / Instagram')")


def downgrade():
    op.create_table(
        'workshop_templates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('external_id', sa.String(100), unique=True),
        sa.Column('description', sa.Text()),
        sa.Column('is_active', sa.Boolean()),
        sa.Column('created_at', sa.DateTime()),
    )
    op.create_table(
        'workshop_template_sends',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('workshop_templates.id'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('count', sa.Integer()),
        sa.UniqueConstraint('template_id', 'date', name='_template_date_uc'),
    )
    op.create_table(
        'workshop_buttons',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('template_id', sa.Integer(), sa.ForeignKey('workshop_templates.id'), nullable=False),
        sa.Column('label', sa.String(100), nullable=False),
        sa.Column('identifier', sa.String(100), nullable=False),
    )
    op.create_table(
        'manychat_ad_leads',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('manychat_id', sa.String(100), nullable=False),
        sa.Column('lead_name', sa.String(150)),
        sa.Column('ad_id', sa.Integer()),
        sa.Column('keyword', sa.String(100)),
        sa.Column('qualification', sa.String(10)),
        sa.Column('person_uuid', sa.String(36), sa.ForeignKey('people.uuid', ondelete='SET NULL'), index=True),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )

    op.execute('DROP INDEX IF EXISTS ix_lead_answers_conversation_id')
    op.alter_column('lead_answers', 'conversation_id', new_column_name='lead_id')

    op.execute('ALTER INDEX IF EXISTS ix_conversations_person_uuid RENAME TO ix_manychat_leads_person_uuid')
    op.execute('ALTER INDEX IF EXISTS conversations_external_id_key RENAME TO manychat_leads_manychat_id_key')
    op.execute('ALTER INDEX IF EXISTS conversations_pkey RENAME TO manychat_leads_pkey')
    op.execute('ALTER SEQUENCE IF EXISTS conversations_id_seq RENAME TO manychat_leads_id_seq')
    op.drop_column('conversations', 'channel')
    op.alter_column('conversations', 'external_id', new_column_name='manychat_id')
    op.rename_table('conversations', 'manychat_leads')

    op.create_table(
        'workshop_interactions',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('button_id', sa.Integer(), sa.ForeignKey('workshop_buttons.id'), nullable=False),
        sa.Column('lead_id', sa.Integer(), sa.ForeignKey('manychat_leads.id')),
        sa.Column('created_at', sa.DateTime()),
    )
    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('channel', sa.String(20), nullable=False),
        sa.Column('external_id', sa.String(100)),
        sa.Column('keyword', sa.String(100)),
        sa.Column('ad_id', sa.Integer()),
        sa.Column('setter', sa.String(100)),
        sa.Column('stage', sa.String(100)),
        sa.Column('qualification', sa.String(10)),
        sa.Column('data', sa.JSON()),
        sa.Column('person_uuid', sa.String(36), sa.ForeignKey('people.uuid', ondelete='SET NULL'), index=True),
        sa.Column('created_at', sa.DateTime()),
        sa.Column('updated_at', sa.DateTime()),
    )
    op.create_index('ix_conversations_channel_external_id', 'conversations', ['channel', 'external_id'])
