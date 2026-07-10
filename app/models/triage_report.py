from app import db


class TriageDailyReport(db.Model):
    """Reporte diario de triaje con confirmaciones del día, confirmaciones futuras y recuperaciones."""
    __tablename__ = 'triage_daily_reports'

    id = db.Column(db.Integer, primary_key=True)
    triage_name = db.Column(db.String(100), nullable=False, default='Kerwin')
    date = db.Column(db.Date, nullable=False)

    # Confirmaciones del día
    today_agendas = db.Column(db.Integer, default=0)
    today_contacted = db.Column(db.Integer, default=0)
    today_confirmed = db.Column(db.Integer, default=0)
    today_canceled = db.Column(db.Integer, default=0)
    today_rescheduled = db.Column(db.Integer, default=0)

    # Confirmaciones futuras
    future_agendas = db.Column(db.Integer, default=0)
    future_contacted = db.Column(db.Integer, default=0)
    future_confirmed = db.Column(db.Integer, default=0)
    future_canceled = db.Column(db.Integer, default=0)
    future_rescheduled = db.Column(db.Integer, default=0)

    # Recuperaciones
    recoveries_contacted = db.Column(db.Integer, default=0)
    recoveries_replied = db.Column(db.Integer, default=0)
    recoveries_scheduled = db.Column(db.Integer, default=0)

    __table_args__ = (db.UniqueConstraint('triage_name', 'date', name='_triage_report_date_uc'),)

    def to_dict(self):
        return {
            "id": self.id,
            "triage_name": self.triage_name,
            "date": self.date.isoformat() if self.date else None,
            "today_agendas": self.today_agendas,
            "today_contacted": self.today_contacted,
            "today_confirmed": self.today_confirmed,
            "today_canceled": self.today_canceled,
            "today_rescheduled": self.today_rescheduled,
            "future_agendas": self.future_agendas,
            "future_contacted": self.future_contacted,
            "future_confirmed": self.future_confirmed,
            "future_canceled": self.future_canceled,
            "future_rescheduled": self.future_rescheduled,
            "recoveries_contacted": self.recoveries_contacted,
            "recoveries_replied": self.recoveries_replied,
            "recoveries_scheduled": self.recoveries_scheduled
        }

