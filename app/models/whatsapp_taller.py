"""El broadcast de cada taller (ADR-W259): su audiencia (los contactos con la etiqueta del plan) y su flujo de
recordatorios (pasos programados relativos a la hora del taller). Lo que sale va a `WaEnvio`, un lote por paso.

El plan con `event_id` vacío es el «estándar»: un taller sin plan arranca con una copia de sus pasos.
"""
from datetime import datetime

from app import db


class WaPlanTaller(db.Model):
    __tablename__ = 'wa_planes_taller'

    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('workshop_events.id', ondelete='CASCADE'), nullable=True, unique=True)
    etiqueta = db.Column(db.String(60), nullable=True)  # la de su audiencia, p. ej. «WS 26/11»
    # Qué grupos se descartan al mandar: {agendados, clientes, alumnos} (bool). Las bajas se descartan siempre.
    descartes = db.Column(db.JSON, nullable=True)
    actualizado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    pasos = db.relationship('WaPasoTaller', backref='plan', cascade='all, delete-orphan',
                            order_by='WaPasoTaller.orden')


class WaPasoTaller(db.Model):
    """Un envío del flujo. Cuándo: `modo` «ahora» (al programar), «relativo» (`minutos` desde el inicio, negativo
    antes) u «hora» (`dias` desde el día del taller a la `hora` HH:MM de Argentina). A quién: `a_quien` «todos»,
    «no_respondieron», «tocaron» (`valor` = el botón) o «etiqueta» (`valor`), menos los de `excluir` (etiquetas).
    `parametros`: qué va en {{1}}, {{2}}… de la plantilla (claves de `taller.VARIABLES` o {'fijo': texto})."""
    __tablename__ = 'wa_pasos_taller'

    BORRADOR, PROGRAMADO, LANZADO, VENCIDO = 'borrador', 'programado', 'lanzado', 'vencido'

    id = db.Column(db.Integer, primary_key=True)
    plan_id = db.Column(db.Integer, db.ForeignKey('wa_planes_taller.id', ondelete='CASCADE'), nullable=False, index=True)
    orden = db.Column(db.Integer, nullable=False, default=0)
    nombre = db.Column(db.String(60), nullable=True)
    modo = db.Column(db.String(10), nullable=False, default='relativo')
    minutos = db.Column(db.Integer, nullable=True)
    dias = db.Column(db.Integer, nullable=True)
    hora = db.Column(db.String(5), nullable=True)
    # 'plantilla' (sale a cualquiera, aprobada por Meta) o 'mensaje' (texto común: solo a quien escribió o tocó un
    # botón en las últimas 24 h; ADR-W266). `mensaje`: {texto, titulo?, url?}.
    tipo = db.Column(db.String(10), nullable=False, default='plantilla', server_default='plantilla')
    mensaje = db.Column(db.JSON, nullable=True)
    plantilla = db.Column(db.String(120), nullable=True)
    idioma = db.Column(db.String(10), nullable=False, default='es')
    parametros = db.Column(db.JSON, nullable=True)
    a_quien = db.Column(db.String(20), nullable=False, default='todos')
    valor = db.Column(db.String(60), nullable=True)
    excluir = db.Column(db.JSON, nullable=True)
    estado = db.Column(db.String(15), nullable=False, default=BORRADOR, index=True)
    lote = db.Column(db.String(36), nullable=True)
    lanzado_en = db.Column(db.DateTime, nullable=True)
