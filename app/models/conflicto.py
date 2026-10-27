from datetime import datetime

from app import db
from app.models.person import ConPersona

CONFLICTO_TIPOS = ('cobranza', 'cobro', 'datos', 'fichas', 'producto')
CONFLICTO_ESTADOS = ('abierto', 'resuelto', 'descartado')


class Conflicto(ConPersona, db.Model):
    """Un caso de datos que no cierra y que decide una persona, no un script (vista Conflictos, 27/10/2026).

    Lo que se cargó ese día no se guarda acá: la historia se arma en vivo desde las ventas, los pagos y las
    agendas de la persona (`conflictos_service.historia`). `historia` guarda solo lo que no está en ninguna
    tabla (una nota de la limpieza, un reembolso pedido por WhatsApp)."""
    __tablename__ = 'conflictos'
    id = db.Column(db.Integer, primary_key=True)
    tipo = db.Column(db.String(20), nullable=False, default='cobranza', server_default='cobranza')
    # «Qué no cierra», en una línea.
    titulo = db.Column(db.String(255), nullable=False)
    detalle = db.Column(db.Text, nullable=True)
    monto = db.Column(db.Float, nullable=True)
    # De dónde viene: la venta o el pago que lo originó, y la fecha que el closer reconoce.
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id', ondelete='SET NULL'), nullable=True, index=True)
    financial_sale_id = db.Column(db.Integer, db.ForeignKey('financial_sales.id', ondelete='SET NULL'),
                                  nullable=True, index=True)
    origen_fecha = db.Column(db.DateTime, nullable=True)
    origen_texto = db.Column(db.String(255), nullable=True)
    responsable_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    estado = db.Column(db.String(20), nullable=False, default='abierto', server_default='abierto', index=True)
    resolucion = db.Column(db.Text, nullable=True)
    resuelto_por_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    resuelto_at = db.Column(db.DateTime, nullable=True)
    # [{fecha, fuente, titulo, mal, nota}]: lo que no vive en otra tabla.
    historia = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    responsable = db.relationship('User', foreign_keys=[responsable_id])
    resuelto_por = db.relationship('User', foreign_keys=[resuelto_por_id])
