"""Rúbrica nueva de Clarity para el puesto de Asistente (formulario de 35 preguntas)

Revision ID: f2b8d4a6c910
Revises: c3e7a2b9d104
Create Date: 2026-10-07 11:00:00.000000

El score pasa de 8 a 10 criterios (se va `escritura`, que medía una prueba que el
formulario ya no hace; entran `aporte`, `idiomas` y `pretension`). Los pesos
sembrados por la migración original no los había editado nadie (se verificó contra
producción antes de escribir esto: los 8 estaban en su `default_weight`), así que se
reemplazan todos por los nuevos de fábrica. El downgrade vuelve a sembrar los 8
anteriores.

Los datos van copiados a propósito: una migración no debe depender del código de la
app, que puede cambiar (ver `app/services/assistant_clarity.py`).
"""
from datetime import datetime

import sqlalchemy as sa
from alembic import op


revision = 'f2b8d4a6c910'
down_revision = 'c3e7a2b9d104'
branch_labels = None
depends_on = None

TABLA = 'assistant_application_clarity_weights'

NUEVOS = [
    ("criterio", "Cómo resuelve: atraso y pendientes", 20),
    ("aporte", "Qué aporta que casi nadie tenga", 10),
    ("experiencia", "Experiencia en operaciones", 14),
    ("herramientas", "Sheets, Notion, Meta, WhatsApp masivo y automatizaciones", 14),
    ("ia", "Nivel real de IA", 16),
    ("digital", "Negocio digital y trabajo remoto", 6),
    ("dinero", "Dinero y coordinación de gente", 6),
    ("video", "Video de presentación y CV", 6),
    ("idiomas", "Inglés y segundo idioma", 4),
    ("pretension", "Pretensión dentro del rango", 4),
]

ANTERIORES = [
    ("criterio", "Cómo resuelve: retraso, compra, martes", 18),
    ("experiencia", "Experiencia en operaciones", 16),
    ("escritura", "Instrucciones para delegar", 14),
    ("herramientas", "Sheets, Notion, Meta, automatizaciones", 14),
    ("ia", "Nivel real de IA", 14),
    ("digital", "Negocio digital y trabajo remoto", 10),
    ("video", "Video de presentación y CV", 10),
    ("dinero", "Dinero y coordinación de gente", 4),
]


def _sembrar(criterios):
    tabla = sa.table(
        TABLA,
        sa.column('criterion', sa.String),
        sa.column('label', sa.String),
        sa.column('weight', sa.Integer),
        sa.column('default_weight', sa.Integer),
        sa.column('updated_at', sa.DateTime),
    )
    conn = op.get_bind()
    conn.execute(sa.text(f'DELETE FROM {TABLA}'))
    ahora = datetime.utcnow()
    conn.execute(tabla.insert(), [
        {"criterion": c, "label": label, "weight": peso, "default_weight": peso, "updated_at": ahora}
        for c, label, peso in criterios
    ])


def upgrade():
    # Idempotente: producción recibió la rúbrica nueva antes, por main (d8c2f5a7e913). Si ya está
    # (hay una fila `aporte`), no se toca: volver a sembrar pisaría los pesos que alguien ajustó.
    if op.get_bind().execute(sa.text(f"SELECT 1 FROM {TABLA} WHERE criterion = 'aporte'")).first():
        return
    _sembrar(NUEVOS)


def downgrade():
    _sembrar(ANTERIORES)
