"""«Pedir actualización»: pedidos de actualización sobre una sesión, con su respuesta (texto y audio)

Revision ID: b8d2f4a6c1e7
Revises: e3a5c7d9f1b4
Create Date: 2026-11-27

Idempotente.
"""
import sqlalchemy as sa
from alembic import op

revision = 'b8d2f4a6c1e7'
down_revision = 'e3a5c7d9f1b4'
branch_labels = None
depends_on = None


def upgrade():
    if 'update_requests' in sa.inspect(op.get_bind()).get_table_names():
        return
    op.create_table(
        'update_requests',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('appointment_id', sa.Integer(), sa.ForeignKey('appointments.id', ondelete='CASCADE'), nullable=False),
        sa.Column('person_uuid', sa.String(36), nullable=True),
        sa.Column('requested_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('recipient_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('audio', sa.LargeBinary(), nullable=True),
        sa.Column('audio_mime', sa.String(60), nullable=True),
        sa.Column('reply', sa.Text(), nullable=True),
        sa.Column('reply_audio', sa.LargeBinary(), nullable=True),
        sa.Column('reply_audio_mime', sa.String(60), nullable=True),
        sa.Column('replied_by', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('replied_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_update_requests_appointment_id', 'update_requests', ['appointment_id'])


def downgrade():
    op.drop_index('ix_update_requests_appointment_id', table_name='update_requests')
    op.drop_table('update_requests')
