"""marca de agenda duplicada en financial_agendas

Revision ID: e7a1c4b90d33
Revises: 1d590aa97756
Create Date: 2026-09-26 23:10:00.000000

La fila repetida del mismo lead se marca en vez de borrarse: borrar es
irreversible y pierde el registro de lo que Calendly mando de verdad.

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7a1c4b90d33'
down_revision = '1d590aa97756'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('financial_agendas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('duplicada_de_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('descartada_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('descartada_por_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('descartada_motivo', sa.String(length=255), nullable=True))
        # Indice porque TODA consulta del libro de agendas y del embudo filtra por
        # `duplicada_de_id IS NULL`: sin el, cada listado suma un scan de la tabla.
        batch_op.create_index('ix_financial_agendas_duplicada_de_id', ['duplicada_de_id'], unique=False)
        # ondelete SET NULL y no el NO ACTION por defecto: si alguien borra a mano la fila
        # que se conservo, la descartada no debe bloquear el DELETE con un IntegrityError
        # -- simplemente deja de apuntar a nadie y vuelve a verse en el libro, que es el
        # comportamiento sano cuando su referencia ya no existe.
        batch_op.create_foreign_key(
            'fk_financial_agendas_duplicada_de_id', 'financial_agendas', ['duplicada_de_id'], ['id'],
            ondelete='SET NULL')
        batch_op.create_foreign_key(
            'fk_financial_agendas_descartada_por_id', 'users', ['descartada_por_id'], ['id'])


def downgrade():
    with op.batch_alter_table('financial_agendas', schema=None) as batch_op:
        batch_op.drop_constraint('fk_financial_agendas_descartada_por_id', type_='foreignkey')
        batch_op.drop_constraint('fk_financial_agendas_duplicada_de_id', type_='foreignkey')
        batch_op.drop_index('ix_financial_agendas_duplicada_de_id')
        batch_op.drop_column('descartada_motivo')
        batch_op.drop_column('descartada_por_id')
        batch_op.drop_column('descartada_at')
        batch_op.drop_column('duplicada_de_id')
