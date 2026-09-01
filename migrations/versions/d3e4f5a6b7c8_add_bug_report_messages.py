"""add bug report messages (conversation thread)

Revision ID: d3e4f5a6b7c8
Revises: c9d1e2f3a4b5
Create Date: 2026-09-02 00:00:00.000000

"""
from datetime import datetime
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd3e4f5a6b7c8'
down_revision = 'c9d1e2f3a4b5'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('bug_report_messages',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('bug_report_id', sa.Integer(), nullable=False),
    sa.Column('sender_id', sa.Integer(), nullable=True),
    sa.Column('sender_role', sa.String(length=20), nullable=True),
    sa.Column('message', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['bug_report_id'], ['bug_reports.id'], name=op.f('fk_bug_report_messages_bug_report_id_bug_reports'), ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sender_id'], ['users.id'], name=op.f('fk_bug_report_messages_sender_id_users'), ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_bug_report_messages'))
    )
    with op.batch_alter_table('bug_report_messages', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_bug_report_messages_bug_report_id'), ['bug_report_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_bug_report_messages_created_at'), ['created_at'], unique=False)

    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('user_last_read_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('manager_last_read_at', sa.DateTime(), nullable=True))

    # Migrar la vieja respuesta unica (admin_response) a un mensaje del hilo, para no
    # perder historial de reportes que ya tenian una respuesta guardada.
    conn = op.get_bind()
    existing = conn.execute(sa.text(
        "SELECT id, admin_response, responded_at, responded_by_id FROM bug_reports WHERE admin_response IS NOT NULL"
    )).fetchall()
    for row in existing:
        responder_role = None
        if row.responded_by_id is not None:
            role_row = conn.execute(sa.text("SELECT role FROM users WHERE id = :uid"), {"uid": row.responded_by_id}).fetchone()
            responder_role = role_row[0] if role_row else None
        conn.execute(sa.text(
            "INSERT INTO bug_report_messages (bug_report_id, sender_id, sender_role, message, created_at) "
            "VALUES (:bug_report_id, :sender_id, :sender_role, :message, :created_at)"
        ), {
            "bug_report_id": row.id,
            "sender_id": row.responded_by_id,
            "sender_role": responder_role,
            "message": row.admin_response,
            "created_at": row.responded_at or datetime.utcnow(),
        })

    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.drop_constraint(batch_op.f('fk_bug_reports_responded_by_id_users'), type_='foreignkey')
        batch_op.drop_column('is_read_by_user')
        batch_op.drop_column('responded_by_id')
        batch_op.drop_column('responded_at')
        batch_op.drop_column('admin_response')


def downgrade():
    with op.batch_alter_table('bug_reports', schema=None) as batch_op:
        batch_op.add_column(sa.Column('admin_response', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('responded_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('responded_by_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('is_read_by_user', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.create_foreign_key(batch_op.f('fk_bug_reports_responded_by_id_users'), 'users', ['responded_by_id'], ['id'], ondelete='SET NULL')
        batch_op.drop_column('manager_last_read_at')
        batch_op.drop_column('user_last_read_at')

    with op.batch_alter_table('bug_report_messages', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_bug_report_messages_created_at'))
        batch_op.drop_index(batch_op.f('ix_bug_report_messages_bug_report_id'))
    op.drop_table('bug_report_messages')
