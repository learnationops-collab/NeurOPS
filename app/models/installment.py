from datetime import datetime
from app import db


class InstallmentPlan(db.Model):
    """Plan de cuotas (próximos pagos) declarado por el closer al registrar una venta
    parcial/con seña. Vive atado a la cita (Appointment), no a Enrollment (sistema
    legado sin datos recientes) ni a FinancialSale (registro plano sincronizado con
    Sheets, sin relación estructurada a un cronograma de cobros futuros)."""
    __tablename__ = 'installment_plans'
    id = db.Column(db.Integer, primary_key=True)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'), nullable=False, index=True)
    numero_cuota = db.Column(db.Integer, nullable=False)
    monto = db.Column(db.Float, nullable=False)
    fecha_vencimiento = db.Column(db.Date, nullable=False)
    estado = db.Column(db.String(20), default='pendiente', server_default='pendiente')  # pendiente | pagado
    fecha_pago = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    appointment = db.relationship('Appointment', backref=db.backref('installment_plans', lazy='dynamic', cascade='all, delete-orphan'))

    def to_dict(self):
        from datetime import date
        is_vencida = self.estado == 'pendiente' and self.fecha_vencimiento and self.fecha_vencimiento < date.today()
        return {
            'id': self.id,
            'appointment_id': self.appointment_id,
            'numero_cuota': self.numero_cuota,
            'monto': self.monto,
            'fecha_vencimiento': self.fecha_vencimiento.isoformat() if self.fecha_vencimiento else None,
            'estado': 'vencido' if is_vencida else self.estado,
            'fecha_pago': self.fecha_pago.isoformat() if self.fecha_pago else None
        }
