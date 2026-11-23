from datetime import datetime

from app import db


class DailyClose(db.Model):
    """El cierre del día de una persona (reporte único, ADR-W203): lo común a los tres roles.

    Los números siguen en la tabla de cada rol (`closer_daily_reports`, `setter_daily_stats`,
    `triage_daily_reports`); acá va la victoria, el «mañana», el estado y lo cargado a mano.
    Quién lee y escribe esto: `app/reporte_dia/`.
    """
    __tablename__ = 'daily_closes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    date = db.Column(db.Date, nullable=False)
    role = db.Column(db.String(20), nullable=False)
    # {tipo:'persona'|'sin_gente', persona:{id,nombre,detalle}|null, que, por, prueba_url, motivo, mas:[{persona, que}]}
    victory = db.Column(db.JSON, nullable=True)
    tomorrow = db.Column(db.Text, nullable=True)
    platform_issue = db.Column(db.Text, nullable=True)
    workflow = db.Column(db.Text, nullable=True)
    is_non_working_day = db.Column(db.Boolean, nullable=False, default=False, server_default='0')
    status = db.Column(db.String(15), nullable=False, default='en_curso', server_default='en_curso')
    closed_at = db.Column(db.DateTime, nullable=True, index=True)
    # Lo cargado a mano y las correcciones del día: {mano: {clave: v}, mano_meta: {clave: {por, en}},
    # correcciones: {clave: v}, legado: bool}. `legado`: el día ya tenía reporte del flujo viejo.
    data = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])
    __table_args__ = (db.UniqueConstraint('user_id', 'date', name='_daily_close_user_date_uc'),)
