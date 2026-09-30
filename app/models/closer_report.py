from datetime import datetime
from app import db


class CloserDailyReport(db.Model):
    """Reporte diario de closers con agendas segmentadas y ventas detalladas."""
    __tablename__ = 'closer_daily_reports'

    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False)
    is_non_working_day = db.Column(db.Boolean, default=False, server_default='0')
    # Cuándo se envió/actualizó este reporte (distinto de `date`, que es el día que reporta —
    # el closer puede mandar el de ayer, ver `_dia_reportable` en app/api/closer.py).
    created_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # --- GENERALES ---
    slots = db.Column(db.Integer, default=0)
    offers_made = db.Column(db.Integer, default=0)

    # --- LLAMADAS ---
    decision_makers = db.Column(db.Integer, default=0)
    rescheduled_calls = db.Column(db.Integer, default=0)

    # --- CONFIRMACIONES: agendas que el closer confirmó ese día (pipeline «① Confirmaciones») ---
    confirmations_done = db.Column(db.Integer, default=0, server_default='0')

    # --- AGENDAS: Primera Llamada ---
    first_call_scheduled = db.Column(db.Integer, default=0)
    first_call_attended = db.Column(db.Integer, default=0)
    first_call_no_show = db.Column(db.Integer, default=0)
    first_call_rescheduled = db.Column(db.Integer, default=0)
    first_call_canceled = db.Column(db.Integer, default=0)

    # --- AGENDAS: Segunda Llamada ---
    second_call_scheduled = db.Column(db.Integer, default=0)
    second_call_attended = db.Column(db.Integer, default=0)
    second_call_no_show = db.Column(db.Integer, default=0)
    second_call_rescheduled = db.Column(db.Integer, default=0)
    second_call_canceled = db.Column(db.Integer, default=0)

    # --- VENTAS: PIF ---
    pif_count = db.Column(db.Integer, default=0)
    pif_cash_collected = db.Column(db.Float, default=0.0)
    pif_in_call_count = db.Column(db.Integer, default=0)
    pif_in_call_cash = db.Column(db.Float, default=0.0)

    # --- VENTAS: Split Pay ---
    split_count = db.Column(db.Integer, default=0)
    split_cash_collected = db.Column(db.Float, default=0.0)
    split_in_call_count = db.Column(db.Integer, default=0)
    split_in_call_cash = db.Column(db.Float, default=0.0)

    # --- VENTAS: Señas ---
    deposit_count = db.Column(db.Integer, default=0)
    deposit_cash_collected = db.Column(db.Float, default=0.0)
    deposit_in_call_count = db.Column(db.Integer, default=0)
    deposit_in_call_cash = db.Column(db.Float, default=0.0)

    # --- VENTAS: Cuotas ---
    installment_count = db.Column(db.Integer, default=0)
    installment_cash_collected = db.Column(db.Float, default=0.0)
    installment_in_call_count = db.Column(db.Integer, default=0)
    installment_in_call_cash = db.Column(db.Float, default=0.0)

    # --- VENTAS: Renovación ---
    renewal_count = db.Column(db.Integer, default=0)
    renewal_cash_collected = db.Column(db.Float, default=0.0)
    renewal_in_call_count = db.Column(db.Integer, default=0)
    renewal_in_call_cash = db.Column(db.Float, default=0.0)

    # --- VENTAS: Upsell ---
    upsell_count = db.Column(db.Integer, default=0)
    upsell_cash_collected = db.Column(db.Float, default=0.0)
    upsell_in_call_count = db.Column(db.Integer, default=0)
    upsell_in_call_cash = db.Column(db.Float, default=0.0)

    # --- SEGUIMIENTOS ---
    follow_ups_sent = db.Column(db.Integer, default=0)
    follow_ups_replied = db.Column(db.Integer, default=0)
    follow_ups_closed = db.Column(db.Integer, default=0)

    # --- RECUPERACIONES ---
    recoveries_contacted = db.Column(db.Integer, default=0)
    recoveries_replied = db.Column(db.Integer, default=0)
    recoveries_scheduled = db.Column(db.Integer, default=0)

    # --- REFERIDOS ---
    referrals_sourced = db.Column(db.Integer, default=0)
    referrals_scheduled = db.Column(db.Integer, default=0)

    # --- REFLEXIÓN (legacy: 2 campos) ---
    reflection_victory = db.Column(db.Text, nullable=True)
    reflection_opportunity = db.Column(db.Text, nullable=True)

    # --- REFLEXIÓN DIARIA (5 preguntas como JSON) ---
    reflections = db.Column(db.JSON, nullable=True)


    closer = db.relationship('User', foreign_keys=[closer_id], overlaps="closer_daily_reports_rel")
    __table_args__ = (db.UniqueConstraint('closer_id', 'date', name='_closer_report_date_uc'),)

    def enviado_en_su_zona(self):
        """Cuándo se envió, en la zona del closer (datetime con zona), o None si no se sabe.

        `created_at` está en UTC naive, como toda la base: un reporte mandado a las 21:00 de La
        Paz ya es el día siguiente en UTC, así que comparar su fecha UTC con `date` marcaría como
        atrasado un reporte mandado a tiempo."""
        if not self.created_at:
            return None
        import pytz
        from app.services.user_time_service import zona_del_usuario
        return pytz.UTC.localize(self.created_at).astimezone(zona_del_usuario(self.closer))

    def enviado_tarde(self):
        """Si se mandó un día después del que reporta (p. ej. el de ayer, mandado hoy)."""
        enviado = self.enviado_en_su_zona()
        return bool(enviado and self.date and enviado.date() > self.date)
