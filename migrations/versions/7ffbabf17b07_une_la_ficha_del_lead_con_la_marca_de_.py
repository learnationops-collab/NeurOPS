"""une la ficha del lead con la marca de agenda duplicada

Sin operaciones: junta las dos cabezas que quedaron al traer a develop el trabajo
de agendas repetidas que se hizo en main. Cada rama creo su tabla o su columna por
su lado y ninguna toca lo de la otra, asi que no hay nada que reconciliar — pero
con dos cabezas `flask db upgrade` falla, y ese comando es el release de Railway.

Revision ID: 7ffbabf17b07
Revises: b2f1a7c94e05, e7a1c4b90d33
Create Date: 2026-09-28 11:38:31.820155

"""


# revision identifiers, used by Alembic.
revision = '7ffbabf17b07'
down_revision = ('b2f1a7c94e05', 'e7a1c4b90d33')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
