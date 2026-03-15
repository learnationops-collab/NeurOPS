from app import db


class TriageDailyReport(db.Model):
    """Reporte diario de triage con agendas nuevas, confirmadas, asistencias, cancelaciones, reprogramandos y no shows."""
    __tablename__ = 'triage_daily_reports'

    id = db.Column(db.Integer, primary_key=True)
    triage_name = db.Column(db.String(100), nullable=False, default='Kerwin')
    date = db.Column(db.Date, nullable=False)

    agendas_nuevas = db.Column(db.Integer, default=0)
    agendas_confirmadas = db.Column(db.Integer, default=0)
    asistencias = db.Column(db.Integer, default=0)
    cancelaciones = db.Column(db.Integer, default=0)
    reprogramandos = db.Column(db.Integer, default=0)
    no_shows = db.Column(db.Integer, default=0)

    __table_args__ = (db.UniqueConstraint('triage_name', 'date', name='_triage_report_date_uc'),)

