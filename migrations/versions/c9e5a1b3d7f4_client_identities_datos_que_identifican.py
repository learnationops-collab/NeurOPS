"""identidad del cliente: clients.uuid (el id público de la persona) y client_identities (sus mails, instagrams, teléfonos e ids externos)

Los clientes existentes reciben su uuid acá. Las identidades se cargan con scripts/backfill_client_identities.py.

Revision ID: c9e5a1b3d7f4
Revises: b8d4f0a2c6e3
Create Date: 2026-10-20 21:00:00.000000

"""
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision = 'c9e5a1b3d7f4'
down_revision = 'b8d4f0a2c6e3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.add_column(sa.Column('uuid', sa.String(length=36), nullable=True))
    conn = op.get_bind()
    ids = [r[0] for r in conn.execute(sa.text('SELECT id FROM clients WHERE uuid IS NULL'))]
    for client_id in ids:
        conn.execute(sa.text('UPDATE clients SET uuid = :u WHERE id = :i'), {'u': str(uuid4()), 'i': client_id})
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.alter_column('uuid', existing_type=sa.String(length=36), nullable=False)
        batch_op.create_unique_constraint('uq_clients_uuid', ['uuid'])

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


def downgrade():
    with op.batch_alter_table('client_identities', schema=None) as batch_op:
        batch_op.drop_index('ix_client_identities_kind_value')
        batch_op.drop_index(batch_op.f('ix_client_identities_client_id'))
    op.drop_table('client_identities')
    with op.batch_alter_table('clients', schema=None) as batch_op:
        batch_op.drop_constraint('uq_clients_uuid', type_='unique')
        batch_op.drop_column('uuid')
