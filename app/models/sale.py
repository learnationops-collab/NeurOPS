from datetime import datetime

from app import db
from app.models.person import ConPersona

# Qué se vendió: una inscripción nueva, una renovación o un upsell. Cada una es una venta propia.
SALE_KINDS = ('new', 'renewal', 'upsell')
SALE_STATUSES = ('active', 'cancelled', 'refunded')


class Sale(ConPersona, db.Model):
    """La venta: el compromiso del cliente con un programa (20/10/2026).

    Los pagos son las filas de `FinancialSale` que apuntan acá (`FinancialSale.sale_id`): esa tabla
    sigue siendo la plata cobrada, que es lo que leen comisiones, nómina y conciliación. El plan de
    cuotas también cuelga de la venta (`InstallmentPlan.sale_id`)."""
    __tablename__ = 'sales'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id', ondelete='SET NULL'), nullable=True, index=True)
    program_code = db.Column(db.String(10), nullable=True, index=True)  # AL / RR / SI
    kind = db.Column(db.String(20), nullable=False, default='new', server_default='new')
    status = db.Column(db.String(20), nullable=False, default='active', server_default='active')
    sold_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    closer_email = db.Column(db.String(255), nullable=True)
    setter = db.Column(db.String(255), nullable=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='SET NULL'),
                               nullable=True, index=True)
    agreed_total = db.Column(db.Float, nullable=True)
    # De dónde salió: 'backfill' (agrupada desde los pagos históricos), 'ficha' o 'manual'.
    source = db.Column(db.String(20), nullable=True)
    # Por qué el agrupado retroactivo no está seguro de esta venta; vacío = encajó sin dudas.
    review_note = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship('Client', backref=db.backref('sales', lazy='dynamic'))
    payments = db.relationship('FinancialSale', backref='sale', lazy='dynamic')

    def to_dict(self):
        return {
            'id': self.id,
            'client_id': self.client_id,
            'program_code': self.program_code,
            'kind': self.kind,
            'status': self.status,
            'sold_at': self.sold_at.isoformat() if self.sold_at else None,
            'closer_email': self.closer_email,
            'setter': self.setter,
            'appointment_id': self.appointment_id,
            'agreed_total': self.agreed_total,
            'source': self.source,
            'review_note': self.review_note,
        }
