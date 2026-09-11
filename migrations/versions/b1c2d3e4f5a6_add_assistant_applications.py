"""add assistant applications (postulacion Asistente Administrativa y Personal)

Revision ID: b1c2d3e4f5a6
Revises: 3a8b192ec920
Create Date: 2026-09-11 00:00:00.000000

"""
from datetime import datetime
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1c2d3e4f5a6'
down_revision = '3a8b192ec920'
branch_labels = None
depends_on = None

# Mismos defaults que app/services/assistant_clarity.py (copiados a propósito:
# una migración no debe depender del código de la app, que puede cambiar).
CLARITY_CRITERIA = [
    {"criterion": "criterio", "label": "Cómo resuelve: retraso, compra, martes", "default_weight": 18},
    {"criterion": "experiencia", "label": "Experiencia en operaciones", "default_weight": 16},
    {"criterion": "escritura", "label": "Instrucciones para delegar", "default_weight": 14},
    {"criterion": "herramientas", "label": "Sheets, Notion, Meta, automatizaciones", "default_weight": 14},
    {"criterion": "ia", "label": "Nivel real de IA", "default_weight": 14},
    {"criterion": "digital", "label": "Negocio digital y trabajo remoto", "default_weight": 10},
    {"criterion": "video", "label": "Video de presentación y CV", "default_weight": 10},
    {"criterion": "dinero", "label": "Dinero y coordinación de gente", "default_weight": 4},
]


def upgrade():
    op.create_table(
        'assistant_applications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('dedupe_key', sa.String(length=64), nullable=True),
        # Bloque 1 · Identificación
        sa.Column('pais', sa.String(length=60), nullable=True),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=160), nullable=True),
        sa.Column('whatsapp', sa.String(length=40), nullable=True),
        sa.Column('edad', sa.String(length=40), nullable=True),
        # Bloque 2 · Requisitos (excluyentes)
        sa.Column('equipo', sa.String(length=200), nullable=True),
        sa.Column('disponibilidad', sa.String(length=200), nullable=True),
        sa.Column('horario', sa.String(length=200), nullable=True),
        sa.Column('empleo', sa.String(length=200), nullable=True),
        # Bloque 3 · Remuneración
        sa.Column('confirma', sa.String(length=200), nullable=True),
        sa.Column('remuneracion', sa.String(length=40), nullable=True),
        # Bloque 4 · Experiencia
        sa.Column('experiencia', sa.String(length=120), nullable=True),
        sa.Column('digital', sa.String(length=120), nullable=True),
        sa.Column('remoto', sa.String(length=120), nullable=True),
        sa.Column('dinero', sa.String(length=200), nullable=True),
        sa.Column('pm', sa.String(length=120), nullable=True),
        sa.Column('educacion', sa.String(length=120), nullable=True),
        sa.Column('area', sa.String(length=200), nullable=True),
        # Bloque 5 · Idiomas
        sa.Column('idioma2', sa.String(length=60), nullable=True),
        sa.Column('ingles', sa.String(length=60), nullable=True),
        # Bloque 6 · Herramientas
        sa.Column('sheets', sa.String(length=120), nullable=True),
        sa.Column('ia_nivel', sa.String(length=120), nullable=True),
        sa.Column('ia_avanzado', sa.String(length=300), nullable=True),
        sa.Column('ia_construido', sa.Text(), nullable=True),
        sa.Column('ia_uso', sa.Text(), nullable=True),
        sa.Column('meta', sa.String(length=200), nullable=True),
        sa.Column('meta_presupuesto', sa.Text(), nullable=True),
        sa.Column('notion', sa.String(length=200), nullable=True),
        sa.Column('wa_tools', sa.String(length=200), nullable=True),
        sa.Column('automatizaciones', sa.String(length=200), nullable=True),
        sa.Column('automatizacion_ejemplo', sa.Text(), nullable=True),
        sa.Column('diseno', sa.String(length=300), nullable=True),
        sa.Column('diseno_link', sa.String(length=500), nullable=True),
        # Bloque 7 · Organización y escritura
        sa.Column('pendientes', sa.String(length=200), nullable=True),
        sa.Column('instrucciones', sa.Text(), nullable=True),
        # Bloque 8 · Cómo resolvés
        sa.Column('retraso', sa.Text(), nullable=True),
        sa.Column('monitor', sa.String(length=300), nullable=True),
        sa.Column('martes', sa.Text(), nullable=True),
        # Bloque 9 · Video y CV
        sa.Column('video', sa.String(length=500), nullable=True),
        sa.Column('video_verificado', sa.String(length=60), nullable=True),
        sa.Column('cv', sa.String(length=500), nullable=True),
        # Descarte duro del propio formulario (rama `ko`).
        sa.Column('descartado', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('motivo_descarte', sa.Text(), nullable=True),
        sa.Column('completo', sa.Boolean(), nullable=False, server_default=sa.false()),
        # Veredicto manual del revisor.
        sa.Column('estado', sa.String(length=20), nullable=True),
        sa.Column('estado_motivo', sa.Text(), nullable=True),
        sa.Column('revisado_por_id', sa.Integer(), nullable=True),
        sa.Column('revisado_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['revisado_por_id'], ['users.id'], name=op.f('fk_assistant_applications_revisado_por_id_users')),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_assistant_applications')),
    )
    with op.batch_alter_table('assistant_applications', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_assistant_applications_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_assistant_applications_dedupe_key'), ['dedupe_key'], unique=True)

    op.create_table(
        'assistant_application_clarity_weights',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('criterion', sa.String(length=40), nullable=False),
        sa.Column('label', sa.String(length=160), nullable=False),
        sa.Column('weight', sa.Integer(), nullable=False),
        sa.Column('default_weight', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_assistant_application_clarity_weights')),
        sa.UniqueConstraint('criterion', name=op.f('uq_assistant_application_clarity_weights_criterion')),
    )

    # Semilla de los 8 pesos por defecto (la pestaña Clarity los edita después).
    conn = op.get_bind()
    now = datetime.utcnow()
    table = sa.table(
        'assistant_application_clarity_weights',
        sa.column('criterion', sa.String),
        sa.column('label', sa.String),
        sa.column('weight', sa.Integer),
        sa.column('default_weight', sa.Integer),
        sa.column('updated_at', sa.DateTime),
    )
    conn.execute(table.insert(), [
        {
            "criterion": c['criterion'],
            "label": c['label'],
            "weight": c['default_weight'],
            "default_weight": c['default_weight'],
            "updated_at": now,
        }
        for c in CLARITY_CRITERIA
    ])


def downgrade():
    op.drop_table('assistant_application_clarity_weights')
    with op.batch_alter_table('assistant_applications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_assistant_applications_dedupe_key'))
        batch_op.drop_index(batch_op.f('ix_assistant_applications_created_at'))
    op.drop_table('assistant_applications')
