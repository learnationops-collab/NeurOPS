from datetime import date, datetime

from app import db
from app.models.person import ConPersona

SUBSCRIPTION_STATUSES = ('active', 'expired', 'cancelled')
# Qué cambió la suscripción: la abrió una venta, la extendió una renovación o un pago, la seña pasó
# a acceso completo, la Academia dio una prórroga, alguien la corrigió a mano o se la quitaron.
SUBSCRIPTION_EVENT_KINDS = ('alta', 'renovacion', 'conversion', 'extension', 'prorroga', 'correccion', 'quitado')


class Subscription(ConPersona, db.Model):
    """La suscripción: el producto de la Academia que el cliente ganó, hasta una fecha (20/10/2026).

    Work es la fuente de verdad: la abre la venta (7 días si es seña, la duración de la venta si
    no), la extienden los pagos y las renovaciones, y la Academia la refleja. Una por cliente y
    producto; cada cambio queda en `SubscriptionEvent`. Estar al día con las cuotas es otra cosa: lo
    dice la venta, no esta fecha."""
    __tablename__ = 'subscriptions'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False, index=True)
    product_slug = db.Column(db.String(100), nullable=False)
    program_code = db.Column(db.String(10), nullable=True)
    # La venta que la abrió o la extendió por última vez.
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id', ondelete='SET NULL'), nullable=True, index=True)
    starts_at = db.Column(db.Date, nullable=False)
    expires_at = db.Column(db.Date, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active', server_default='active')
    is_deposit = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    client = db.relationship('Client', backref=db.backref('subscriptions', lazy='dynamic', passive_deletes=True))
    sale = db.relationship('Sale')
    events = db.relationship('SubscriptionEvent', backref='subscription', lazy='dynamic',
                             cascade='all, delete-orphan', order_by='SubscriptionEvent.id')

    __table_args__ = (db.UniqueConstraint('client_id', 'product_slug', name='uq_subscriptions_client_product'),)

    def to_dict(self, with_events=False):
        data = {
            'id': self.id,
            'client_id': self.client_id,
            'product_slug': self.product_slug,
            'program_code': self.program_code,
            'sale_id': self.sale_id,
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'status': self.status,
            'is_deposit': bool(self.is_deposit),
            # Vencida o no se lee de la fecha: no hace falta un cron que la marque.
            'vigente': bool(self.expires_at and self.expires_at >= date.today() and self.status == 'active'),
        }
        if with_events:
            data['events'] = [e.to_dict() for e in self.events]
        return data


class SubscriptionEvent(db.Model):
    """Un cambio de la suscripción: de qué fecha a qué fecha, por qué, quién y desde dónde."""
    __tablename__ = 'subscription_events'
    id = db.Column(db.Integer, primary_key=True)
    subscription_id = db.Column(db.Integer, db.ForeignKey('subscriptions.id', ondelete='CASCADE'),
                                nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False)
    from_date = db.Column(db.Date, nullable=True)
    to_date = db.Column(db.Date, nullable=False)
    reason = db.Column(db.String(255), nullable=True)
    source = db.Column(db.String(20), nullable=False, default='work', server_default='work')  # work | academia
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    actor_email = db.Column(db.String(255), nullable=True)  # quien la pidió desde la Academia
    sale_id = db.Column(db.Integer, db.ForeignKey('sales.id', ondelete='SET NULL'), nullable=True)
    payment_id = db.Column(db.Integer, db.ForeignKey('financial_sales.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    actor = db.relationship('User')
    sale = db.relationship('Sale')
    payment = db.relationship('FinancialSale')

    def to_dict(self):
        return {
            'id': self.id,
            'kind': self.kind,
            'from_date': self.from_date.isoformat() if self.from_date else None,
            'to_date': self.to_date.isoformat() if self.to_date else None,
            'reason': self.reason,
            'source': self.source,
            'actor': (self.actor.username if self.actor else None) or self.actor_email,
            'sale_id': self.sale_id,
            'payment_id': self.payment_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }
