"""Seed initial pipeline and stage

Revision ID: 4b1d5cf33b61
Revises: 0d4679c48539
Create Date: 2026-01-30 18:47:01.956122

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4b1d5cf33b61'
down_revision = '0d4679c48539'
branch_labels = None
depends_on = None


def upgrade():
    from sqlalchemy.sql import table, column
    from sqlalchemy import String, Integer, Boolean
    
    # Define tables for insertion
    pipelines = table('pipelines',
        column('id', Integer),
        column('name', String),
        column('is_active', Boolean)
    )
    
    stages = table('pipeline_stages',
        column('id', Integer),
        column('pipeline_id', Integer),
        column('name', String),
        column('order', Integer),
        column('is_active', Boolean)
    )
    
    conn = op.get_bind()
    
    # Insert Pipeline if not exists
    res = conn.execute(sa.text("SELECT id FROM pipelines WHERE name = 'General'"))
    pipeline_id = None
    row = res.fetchone()
    if row:
        pipeline_id = row[0]
    else:
        # Insert
        res_ins = conn.execute(
            pipelines.insert().values(name='General', is_active=True)
        )
        # Fetch the inserted ID (SQLite/Postgres differences make .inserted_primary_key tricky in raw alembic sometimes, 
        # but execute returns ResultProxy. lastrowid works for sqlite, returning works for pg)
        # For safety across DBs using a select after insert is robust enough for migration
        res = conn.execute(sa.text("SELECT id FROM pipelines WHERE name = 'General'"))
        pipeline_id = res.fetchone()[0]

    # Insert Stage if not exists
    res_stage = conn.execute(sa.text(f"SELECT id FROM pipeline_stages WHERE name = 'Entrante' AND pipeline_id = {pipeline_id}"))
    if not res_stage.fetchone():
        op.bulk_insert(stages, [
            {'pipeline_id': pipeline_id, 'name': 'Entrante', 'order': 0, 'is_active': True}
        ])


def downgrade():
    pass
