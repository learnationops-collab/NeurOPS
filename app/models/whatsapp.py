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
