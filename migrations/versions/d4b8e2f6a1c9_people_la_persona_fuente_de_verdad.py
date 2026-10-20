"""people: la persona como única fuente de verdad, con sus identidades y conversaciones; person_uuid en todas las tablas

Ver docs/plan_personas.md. Cada cliente pasa a tener su persona con el MISMO uuid (el que ya se compartió
afuera) y se llena person_uuid donde ya hay client_id. Las identidades se cargan después con
scripts/backfill_person_identities.py. Reemplaza a client_identities (solo existió en develop).

Revision ID: d4b8e2f6a1c9
Revises: c9e5a1b3d7f4
Create Date: 2026-10-20 23:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

revision = 'd4b8e2f6a1c9'
down_revision = 'c9e5a1b3d7f4'
branch_labels = None
depends_on = None

# Tablas que apuntan a la persona, y la columna de cliente de la que sale su person_uuid inicial.
TABLAS = {
    'clients': None,
    'conversations': None,
    'financial_sales': 'client_id',
    'financial_agendas': None,
    'appointments': 'client_id',
    'installment_plans': 'client_id',
    'enrollments': 'client_id',
    'sales': 'client_id',
    'subscriptions': 'client_id',
    'leads': None,
    'manychat_leads': None,
    'manychat_ad_leads': None,
    'workshop_leads': 'promoted_client_id',
    'conciliacion_movimientos': None,
    'public_registrations': None,
}


def upgrade():
    with op.batch_alter_table('client_identities', schema=None) as batch_op:
        batch_op.drop_index('ix_client_identities_kind_value')
        batch_op.drop_index(batch_op.f('ix_client_identities_client_id'))
    op.drop_table('client_identities')

    op.create_table(
        'people',
        sa.Column('uuid', sa.String(length=36), nullable=False),
        sa.Column('full_name', sa.String(length=160), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('phone', sa.String(length=40), nullable=True),
        sa.Column('instagram', sa.String(length=100), nullable=True),
        sa.Column('merged_into_uuid', sa.String(length=36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['merged_into_uuid'], ['people.uuid'], name='fk_people_merged_into_uuid'),
        sa.PrimaryKeyConstraint('uuid'),
    )
    op.create_index('ix_people_email', 'people', ['email'], unique=False)

    op.create_table(
        'person_identities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('person_uuid', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=30), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('uso', sa.String(length=20), nullable=True),
        sa.Column('source', sa.String(length=30), nullable=True),
        sa.Column('review_note', sa.String(length=255), nullable=True),
        sa.Column('confirmed_by_id', sa.Integer(), nullable=True),
        sa.Column('confirmed_at', sa.DateTime(), nullable=True),
        sa.Column('retired_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['person_uuid'], ['people.uuid'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['confirmed_by_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_person_identities_person_uuid', 'person_identities', ['person_uuid'], unique=False)
    op.create_index('ix_person_identities_kind_value', 'person_identities', ['kind', 'value'], unique=False)
    op.create_index('uq_person_identities_primary', 'person_identities', ['person_uuid', 'kind'], unique=True,
                    postgresql_where=sa.text('is_primary AND retired_at IS NULL'),
                    sqlite_where=sa.text('is_primary AND retired_at IS NULL'))
    op.create_index('uq_person_identities_uso', 'person_identities', ['person_uuid', 'kind', 'uso'], unique=True,
                    postgresql_where=sa.text('uso IS NOT NULL AND retired_at IS NULL'),
                    sqlite_where=sa.text('uso IS NOT NULL AND retired_at IS NULL'))

    op.create_table(
        'person_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('person_uuid', sa.String(length=36), nullable=False),
        sa.Column('kind', sa.String(length=20), nullable=False),
        sa.Column('field', sa.String(length=30), nullable=True),
        sa.Column('from_value', sa.String(length=255), nullable=True),
        sa.Column('to_value', sa.String(length=255), nullable=True),
        sa.Column('reason', sa.String(length=255), nullable=True),
        sa.Column('actor_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['person_uuid'], ['people.uuid'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_person_events_person_uuid', 'person_events', ['person_uuid'], unique=False)

    op.create_table(
        'conversations',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('channel', sa.String(length=20), nullable=False),
        sa.Column('external_id', sa.String(length=100), nullable=True),
        sa.Column('keyword', sa.String(length=100), nullable=True),
        sa.Column('ad_id', sa.Integer(), nullable=True),
        sa.Column('setter', sa.String(length=100), nullable=True),
        sa.Column('stage', sa.String(length=100), nullable=True),
        sa.Column('qualification', sa.String(length=10), nullable=True),
        sa.Column('data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_conversations_channel_external_id', 'conversations', ['channel', 'external_id'], unique=False)

    for tabla in TABLAS:
        with op.batch_alter_table(tabla, schema=None) as batch_op:
            batch_op.add_column(sa.Column('person_uuid', sa.String(length=36), nullable=True))
            batch_op.create_index(f'ix_{tabla}_person_uuid', ['person_uuid'], unique=False)
            batch_op.create_foreign_key(f'fk_{tabla}_person_uuid', 'people', ['person_uuid'], ['uuid'], ondelete='SET NULL')

    # Una persona por cliente, con su mismo uuid. Los emails sintéticos no son de nadie.
    op.execute("""
        INSERT INTO people (uuid, full_name, email, phone, instagram, created_at)
        SELECT uuid, full_name,
               CASE WHEN email LIKE '%no-email-%' OR email LIKE '%no_email_%' OR email NOT LIKE '%@%' THEN NULL
                    ELSE lower(trim(email)) END,
               phone, instagram, created_at
        FROM clients
    """)
    op.execute('UPDATE clients SET person_uuid = uuid')
    for tabla, col in TABLAS.items():
        if col:
            op.execute(f"""
                UPDATE {tabla} SET person_uuid = (SELECT c.person_uuid FROM clients c WHERE c.id = {tabla}.{col})
                WHERE {col} IS NOT NULL
            """)


def downgrade():
    for tabla in reversed(list(TABLAS)):
        with op.batch_alter_table(tabla, schema=None) as batch_op:
            batch_op.drop_constraint(f'fk_{tabla}_person_uuid', type_='foreignkey')
            batch_op.drop_index(f'ix_{tabla}_person_uuid')
            batch_op.drop_column('person_uuid')
    op.drop_index('ix_conversations_channel_external_id', table_name='conversations')
    op.drop_table('conversations')
    op.drop_index('ix_person_events_person_uuid', table_name='person_events')
    op.drop_table('person_events')
    op.drop_index('uq_person_identities_uso', table_name='person_identities')
    op.drop_index('uq_person_identities_primary', table_name='person_identities')
    op.drop_index('ix_person_identities_kind_value', table_name='person_identities')
    op.drop_index('ix_person_identities_person_uuid', table_name='person_identities')
    op.drop_table('person_identities')
    op.drop_index('ix_people_email', table_name='people')
    op.drop_table('people')

    op.create_table(
        'client_identities',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('client_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=30), nullable=False),
        sa.Column('value', sa.String(length=255), nullable=False),
        sa.Column('source', sa.String(length=30), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('client_identities', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_client_identities_client_id'), ['client_id'], unique=False)
        batch_op.create_index('ix_client_identities_kind_value', ['kind', 'value'], unique=False)
