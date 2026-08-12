from datetime import datetime
from app import db


class LandingSession(db.Model):
    """Una visita a la landing de la grabacion (/replay/).

    Es una fila por sesion de navegador, no un chorro de eventos: la landing
    manda latidos cada 15 s y el endpoint hace UPSERT sobre `session_key`. Con
    eso alcanza para permanencia y embudo, y no crece sin control.

    Diferencia con LandingTracking (track-visit): aquel cuenta impresiones de
    pagina, una fila por carga. Este mide COMPORTAMIENTO dentro de una visita
    (cuanto se queda, si le da play, cuanto ve, si llega a la oferta).

    No guarda datos personales. Si la persona completa el gate, el vinculo con
    su nombre esta en workshop_lead_id.
    """
    __tablename__ = 'landing_sessions'

    id = db.Column(db.Integer, primary_key=True)

    # UUID que genera el navegador y guarda en sessionStorage. Identifica la
    # visita, no a la persona: si vuelve mañana es otra sesion.
    session_key = db.Column(db.String(64), index=True, unique=True, nullable=False)

    page_path = db.Column(db.String(255), index=True, nullable=True)
    referrer = db.Column(db.String(500), nullable=True)
    dispositivo = db.Column(db.String(16), nullable=True)   # 'movil' | 'escritorio'

    utm_source = db.Column(db.String(64), index=True, nullable=True)
    utm_medium = db.Column(db.String(64), nullable=True)
    utm_campaign = db.Column(db.String(120), index=True, nullable=True)
    utm_content = db.Column(db.String(120), nullable=True)
    utm_term = db.Column(db.String(120), nullable=True)

    # --- Permanencia ---
    # Solo cuenta tiempo con la pestaña VISIBLE. Una pestaña de fondo abierta
    # ocho horas no es permanencia, y contarla arruinaria el promedio.
    segundos_visible = db.Column(db.Integer, default=0)
    segundos_video = db.Column(db.Integer, default=0)   # desde que dio play

    # --- Hitos del embudo, en orden ---
    abrio_gate = db.Column(db.Boolean, default=False)
    completo_gate = db.Column(db.Boolean, default=False)
    dio_play = db.Column(db.Boolean, default=False)
    vio_oferta = db.Column(db.Boolean, default=False)      # bloque de conversion revelado
    clic_agenda = db.Column(db.Boolean, default=False)     # CTA de la sesion de aceleracion

    workshop_lead_id = db.Column(db.Integer, db.ForeignKey('workshop_leads.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lead = db.relationship('WorkshopLead', foreign_keys=[workshop_lead_id],
                           backref=db.backref('sesiones', lazy='dynamic'))

    # Etapa alcanzada, de mayor a menor. Sirve para el embudo sin recalcularlo
    # en cada consulta.
    ETAPAS = ['entro', 'abrio_gate', 'completo_gate', 'dio_play', 'vio_oferta', 'clic_agenda']

    @property
    def etapa(self):
        if self.clic_agenda:
            return 'clic_agenda'
        if self.vio_oferta:
            return 'vio_oferta'
        if self.dio_play:
            return 'dio_play'
        if self.completo_gate:
            return 'completo_gate'
        if self.abrio_gate:
            return 'abrio_gate'
        return 'entro'

    def to_dict(self):
        return {
            "id": self.id,
            "session_key": self.session_key,
            "page_path": self.page_path,
            "referrer": self.referrer,
            "dispositivo": self.dispositivo,
            "utm_source": self.utm_source,
            "utm_medium": self.utm_medium,
            "utm_campaign": self.utm_campaign,
            "utm_content": self.utm_content,
            "utm_term": self.utm_term,
            "segundos_visible": self.segundos_visible or 0,
            "segundos_video": self.segundos_video or 0,
            "abrio_gate": bool(self.abrio_gate),
            "completo_gate": bool(self.completo_gate),
            "dio_play": bool(self.dio_play),
            "vio_oferta": bool(self.vio_oferta),
            "clic_agenda": bool(self.clic_agenda),
            "etapa": self.etapa,
            "workshop_lead_id": self.workshop_lead_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f'<LandingSession {self.session_key[:8]} · {self.etapa} · {self.segundos_visible}s>'
