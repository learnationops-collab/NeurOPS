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
    # Cliente dueño del plan (fuente de verdad para buscarlo, ver bitácora): un pago de cuota
    # puede reportarse desde una cita distinta a la que originó el plan (ej. una llamada de
    # cobro puntual), así que buscar solo por appointment_id perdía el plan y lo recreaba desde
    # cero, borrando el historial de cuotas ya pagadas. appointment_id se conserva como
    # referencia de qué cita originó esta versión del plan.
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True, index=True)
    # Programa (AL/RR/SI) al que pertenece este plan — un cliente puede comprar más de un
    # programa a lo largo del tiempo, cada uno con su propio cronograma de cuotas independiente.
    # Nullable por planes creados antes de este campo (no se puede reconstruir retroactivamente
    # a qué programa pertenecían con certeza) — se tratan como "sin programa" en las consultas
    # que sí filtran por programa, sin bloquear la creación de un plan nuevo para otro programa.
    programa_code = db.Column(db.String(10), nullable=True, index=True)
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
            'programa_code': self.programa_code,
            'numero_cuota': self.numero_cuota,
            'monto': self.monto,
            'fecha_vencimiento': self.fecha_vencimiento.isoformat() if self.fecha_vencimiento else None,
            'estado': 'vencido' if is_vencida else self.estado,
            'fecha_pago': self.fecha_pago.isoformat() if self.fecha_pago else None
        }
