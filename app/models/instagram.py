"""Eventos crudos que Meta manda al webhook de Instagram (app propia «Learnation Inbox-IG»).

Primer paso del reemplazo de ManyChat: antes de responder nada, NeurOPS guarda cada notificación
tal como llegó (DMs, comentarios, echos de lo que manda Kommo). Sirve para comprobar qué entrega
Meta a una app sin App Review y, más adelante, como registro de entrada del motor de flujos: si el
procesamiento falla, el evento sigue acá y se puede reprocesar (regla de pérdida cero).
"""
from datetime import datetime

from app import db


class InstagramWebhookEvento(db.Model):
    __tablename__ = 'instagram_webhook_eventos'

    id = db.Column(db.Integer, primary_key=True)
    recibido_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    # Lo que trae cada `entry` resumido para listar sin abrir el JSON: 'messages', 'comments',
    # 'messages,echo', etc. El detalle completo está en `payload`.
    tipos = db.Column(db.String(200), nullable=False, default='')
    payload = db.Column(db.JSON, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'recibido_en': self.recibido_en.isoformat() + 'Z',
            'tipos': self.tipos,
            'payload': self.payload,
        }
