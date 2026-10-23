from app import db


# Los medios de pago (nombre y fee) que usan el ABM de admin, la venta rápida y el importador. Las tablas
# del espejo viejo de las ventas (`enrollments`, `payments`) se borraron en la Etapa 2c
# (docs/plan_personas.md): las ventas son `Sale` y sus pagos `FinancialSale`.
class PaymentMethod(db.Model):
    __tablename__ = 'payment_methods'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    commission_percent = db.Column(db.Float, default=0.0)
    commission_fixed = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
