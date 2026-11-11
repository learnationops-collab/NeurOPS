"""WhatsApp por la API propia de Meta (app del portfolio Learnation, Tech Provider).

Dos tablas:
  · whatsapp_webhook_eventos: cada notificación tal como llegó (mensajes, estados de entrega, eventos de
    coexistence). Se guarda antes de procesar nada, para poder reprocesar (regla de pérdida cero).
  · whatsapp_conexiones: un número conectado a la app (por Embedded Signup o cargado a mano), con su
    cuenta de WhatsApp, su token y, si es de un closer, a quién pertenece. Reemplaza el
    PHONE_NUMBER_ID fijo de Whatchimp.
"""
from datetime import datetime

from app import db

ESTADOS_CONEXION = ('pendiente', 'conectado', 'desconectado')


class WhatsappWebhookEvento(db.Model):
    __tablename__ = 'whatsapp_webhook_eventos'

    id = db.Column(db.Integer, primary_key=True)
    recibido_en = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)
    # Resumen para listar sin abrir el JSON: 'messages', 'statuses', 'history', 'smb_message_echoes'...
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
            'resultado': self.resultado,
        }


class WhatsappConexion(db.Model):
    __tablename__ = 'whatsapp_conexiones'

    id = db.Column(db.Integer, primary_key=True)
    waba_id = db.Column(db.String(64), nullable=False, index=True)
    phone_number_id = db.Column(db.String(64), nullable=False, unique=True)
    numero = db.Column(db.String(32), nullable=True)            # display_phone_number, solo dígitos
    nombre_verificado = db.Column(db.String(200), nullable=True)
    # El closer dueño del número (coexistence). NULL = número de empresa (avisos internos, broadcasts).
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True, index=True)
    # Token de negocio del cliente (canje del Embedded Signup). NULL = se usa WHATSAPP_TOKEN del entorno.
    token = db.Column(db.Text, nullable=True)
    coexistence = db.Column(db.Boolean, nullable=False, default=False)
    estado = db.Column(db.String(20), nullable=False, default='pendiente')
    conectado_en = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('whatsapp_conexiones', lazy='dynamic'))

    def to_dict(self):
        """Sin el token: nunca sale de la base."""
        return {
            'id': self.id,
            'waba_id': self.waba_id,
            'phone_number_id': self.phone_number_id,
            'numero': self.numero,
            'nombre_verificado': self.nombre_verificado,
            'user_id': self.user_id,
            'coexistence': self.coexistence,
            'estado': self.estado,
            'tiene_token_propio': bool(self.token),
            'conectado_en': self.conectado_en.isoformat() + 'Z' if self.conectado_en else None,
        }
