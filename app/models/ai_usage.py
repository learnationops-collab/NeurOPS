"""Una fila por llamada a Claude: quien la hizo, para que, con que modelo y cuanto costo.

Existe para saber quien usa la IA y cuanto gasta, y para que mas adelante un tope mensual pueda
cortar el uso antes de llamar (se suma `cost_usd` del mes). La escribe solo `claude_service`: toda
llamada pasa por ahi, salga bien o mal.

Se guardan los tokens crudos ademas del costo: si cambian los precios, el costo se puede recalcular
sin perder la historia. Las llamadas que fallan quedan con `status='error'` y tokens en 0.
No se guarda el texto de la conversacion (trae datos de alumnos y deudas).
"""
from datetime import datetime

from app import db


class AiUsage(db.Model):
    __tablename__ = 'ai_usage'

    OK = 'ok'
    ERROR = 'error'

    id = db.Column(db.Integer, primary_key=True)
    # SET NULL: si se borra el usuario, el gasto sigue contando en el total del mes.
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    # Para que se uso, ej. 'copiloto'. Texto libre y corto: cada funcion nueva trae el suyo.
    feature = db.Column(db.String(50), nullable=False, index=True)
    model = db.Column(db.String(60), nullable=False)

    input_tokens = db.Column(db.Integer, nullable=False, default=0)
    output_tokens = db.Column(db.Integer, nullable=False, default=0)
    cache_creation_input_tokens = db.Column(db.Integer, nullable=False, default=0)
    cache_read_input_tokens = db.Column(db.Integer, nullable=False, default=0)
    cost_usd = db.Column(db.Numeric(12, 6), nullable=False, default=0)

    status = db.Column(db.String(10), nullable=False, default=OK)
    error = db.Column(db.String(255), nullable=True)
    # El request-id de Anthropic: es lo que piden para investigar una llamada puntual.
    request_id = db.Column(db.String(80), nullable=True)
    duration_ms = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, index=True)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'feature': self.feature,
            'model': self.model,
            'input_tokens': self.input_tokens,
            'output_tokens': self.output_tokens,
            'cache_creation_input_tokens': self.cache_creation_input_tokens,
            'cache_read_input_tokens': self.cache_read_input_tokens,
            'cost_usd': float(self.cost_usd or 0),
            'status': self.status,
            'error': self.error,
            'request_id': self.request_id,
            'duration_ms': self.duration_ms,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
