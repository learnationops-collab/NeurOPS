from datetime import datetime
from app import db

class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    program_id = db.Column(db.Integer, db.ForeignKey('programs.id'), nullable=False)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    enrollment_date = db.Column(db.DateTime, default=datetime.utcnow)

    payments = db.relationship('Payment', backref='enrollment', lazy='dynamic', cascade="all, delete-orphan")
    closer_rel = db.relationship('User', foreign_keys=[closer_id], backref='sales_made')

    @property
    def total_paid(self):
        completed_payments = self.payments.filter_by(status='completed').all()
        return sum(p.amount for p in completed_payments)

class PaymentMethod(db.Model):
    __tablename__ = 'payment_methods'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)
    commission_percent = db.Column(db.Float, default=0.0)
    commission_fixed = db.Column(db.Float, default=0.0)
    is_active = db.Column(db.Boolean, default=True)
    
    payments = db.relationship('Payment', backref='method', lazy='dynamic')

class Payment(db.Model):
    __tablename__ = 'payments'
    id = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    payment_method_id = db.Column(db.Integer, db.ForeignKey('payment_methods.id'), nullable=True)
    amount = db.Column(db.Float, nullable=False)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    payment_type = db.Column(db.String(20))
    status = db.Column(db.String(20), default='completed')

    payment_method = db.relationship('PaymentMethod', overlaps="method,payments")
