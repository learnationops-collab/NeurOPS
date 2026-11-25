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


class WaEnvio(db.Model):
    """Un número al que se le mandó (o se le está mandando) una plantilla desde la herramienta «Broadcast de
    WhatsApp» (ADR-W229). Una sola tabla: cada «Enviar» es un `lote`; los estados los va actualizando el webhook
    (enviado → entregado → leído), y si responde queda su conversación y lo primero que escribió (`respuesta`).
    Mandar no crea contactos: en el Inbox aparecen solo los que contestan.
    """
    __tablename__ = 'wa_envios'

    PENDIENTE, ENVIADO, ENTREGADO, LEIDO, RESPONDIO, FALLO = (
        'pendiente', 'enviado', 'entregado', 'leido', 'respondio', 'fallo')
    # Orden de avance: un estado viejo que llega tarde no pisa a uno posterior.
    ORDEN = {PENDIENTE: 0, ENVIADO: 1, ENTREGADO: 2, LEIDO: 3, RESPONDIO: 4, FALLO: 5}

    id = db.Column(db.Integer, primary_key=True)
    lote = db.Column(db.String(36), nullable=False, index=True)
    plantilla = db.Column(db.String(120), nullable=False)
    idioma = db.Column(db.String(10), nullable=False, default='es')
    con_nombre = db.Column(db.Boolean, nullable=False, default=True)  # la plantilla lleva {{1}} con el nombre
    telefono = db.Column(db.String(20), nullable=False, index=True)  # solo dígitos, con código de país
    nombre = db.Column(db.String(150), nullable=True)
    estado = db.Column(db.String(20), nullable=False, default=PENDIENTE, index=True)
    wamid = db.Column(db.String(200), nullable=True, unique=True)
    creado_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    enviado_en = db.Column(db.DateTime, nullable=True, index=True)
    actualizado_en = db.Column(db.DateTime, nullable=True)
    error = db.Column(db.String(300), nullable=True)
    respuesta = db.Column(db.String(200), nullable=True)
    enviado_por_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    contacto_id = db.Column(db.Integer, db.ForeignKey('ig_contactos.id', ondelete='SET NULL'), nullable=True)
