"""Eventos crudos que Meta manda al webhook de WhatsApp Cloud (app propia «Learnation Contacts»).

Igual que con Instagram: primero se guarda cada notificación tal como llegó (mensajes entrantes y
estados de los enviados) y después se procesa. Si el procesamiento falla, el evento sigue acá y se
puede reprocesar (regla de pérdida cero).
"""
from datetime import datetime

from app import db


class WhatsappWebhookEvento(db.Model):
    __tablename__ = 'whatsapp_webhook_eventos'

    id = db.Column(db.Integer, primary_key=True)
    recibido_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    # 'messages', 'statuses', 'messages,statuses'... para listar sin abrir el JSON.
    tipos = db.Column(db.String(200), nullable=False, default='')
    payload = db.Column(db.JSON, nullable=False)
    procesado_en = db.Column(db.DateTime, nullable=True, index=True)
    resultado = db.Column(db.String(200), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'recibido_en': self.recibido_en.isoformat() + 'Z',
            'tipos': self.tipos,
            'payload': self.payload,
            'procesado_en': self.procesado_en.isoformat() + 'Z' if self.procesado_en else None,
            'resultado': self.resultado,
        }


class WaDifusion(db.Model):
    """Un broadcast: una plantilla aprobada que sale a una lista de números, de a poco y con tope diario.

    `destino` dice a dónde lleva (setting o workshop) para medir de dónde vienen los leads. Las respuestas
    entran al Inbox de setters como contactos `wa:<número>` con `variables.difusion` = id de esta difusión.
    """
    __tablename__ = 'wa_difusiones'

    ACTIVA, PAUSADA, TERMINADA = 'activa', 'pausada', 'terminada'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(150), nullable=False)
    plantilla = db.Column(db.String(120), nullable=False)
    idioma = db.Column(db.String(10), nullable=False, default='es')
    # Si la plantilla lleva {{1}} con el nombre de la persona.
    con_nombre = db.Column(db.Boolean, nullable=False, default=True)
    destino = db.Column(db.String(20), nullable=False, default='setting')
    tope_diario = db.Column(db.Integer, nullable=False, default=30)
    estado = db.Column(db.String(20), nullable=False, default=PAUSADA)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    creado_por_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)


class WaDifusionDestino(db.Model):
    """Cada número de una difusión y lo que pasó con su mensaje (lo actualizan los estados del webhook)."""
    __tablename__ = 'wa_difusion_destinos'
    __table_args__ = (db.UniqueConstraint('difusion_id', 'telefono', name='uq_wa_difusion_telefono'),)

    PENDIENTE, ENVIADO, ENTREGADO, LEIDO, RESPONDIO, FALLO = (
        'pendiente', 'enviado', 'entregado', 'leido', 'respondio', 'fallo')
    # Orden de avance: un estado viejo que llega tarde no pisa a uno posterior.
    ORDEN = {PENDIENTE: 0, ENVIADO: 1, ENTREGADO: 2, LEIDO: 3, RESPONDIO: 4, FALLO: 5}

    id = db.Column(db.Integer, primary_key=True)
    difusion_id = db.Column(db.Integer, db.ForeignKey('wa_difusiones.id', ondelete='CASCADE'), nullable=False, index=True)
    telefono = db.Column(db.String(20), nullable=False, index=True)  # solo dígitos, con código de país
    nombre = db.Column(db.String(150), nullable=True)
    estado = db.Column(db.String(20), nullable=False, default=PENDIENTE, index=True)
    wamid = db.Column(db.String(200), nullable=True, unique=True)
    enviado_en = db.Column(db.DateTime, nullable=True, index=True)
    actualizado_en = db.Column(db.DateTime, nullable=True)
    error = db.Column(db.String(300), nullable=True)
    contacto_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='SET NULL'), nullable=True)
