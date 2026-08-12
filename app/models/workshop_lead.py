from datetime import datetime
from app import db


class WorkshopLead(db.Model):
    """Lead capturado por el gate de las landings públicas de institute.thelearnation.com
    (por ahora /replay/, la clase grabada).

    Es una tabla de entrada, deliberadamente separada de `clients`: acá cae todo el
    que completa el gate, sin validar ni deduplicar contra el CRM. El pase a
    `Client` es una decisión comercial posterior (la marca `promoted_client_id`).

    OJO: el gate NO pide dato de contacto. Esto mide el embudo (cuánta gente
    entra a la clase, con qué perfil y desde qué anuncio), no habilita
    seguimiento comercial: no hay forma de escribirle a nadie de esta tabla.
    """
    __tablename__ = 'workshop_leads'

    id = db.Column(db.Integer, primary_key=True)

    # Identifica UNA completada del gate. La landing reintenta los envíos
    # fallidos, y sin esta clave un POST que llegó pero cuya respuesta se perdió
    # generaría una fila nueva en cada reintento.
    dedupe_key = db.Column(db.String(64), index=True, unique=True, nullable=True)

    # --- Datos del gate ---
    nombre = db.Column(db.String(80), nullable=False)
    apellido = db.Column(db.String(80), nullable=True)
    profesion = db.Column(db.String(60), nullable=True)
    etapa = db.Column(db.String(60), nullable=True)
    examen = db.Column(db.String(40), nullable=True)

    # --- Procedencia ---
    page_path = db.Column(db.String(255), nullable=True)
    utm_source = db.Column(db.String(64), index=True, nullable=True)
    utm_medium = db.Column(db.String(64), nullable=True)
    utm_campaign = db.Column(db.String(120), nullable=True)
    utm_content = db.Column(db.String(120), nullable=True)
    utm_term = db.Column(db.String(120), nullable=True)
    referrer = db.Column(db.String(500), nullable=True)

    # --- Seguimiento ---
    # 'nuevo' -> recién entró | 'contactado' -> el setter ya escribió | 'descartado'
    status = db.Column(db.String(20), default='nuevo', index=True)
    notes = db.Column(db.Text, nullable=True)
    promoted_client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)

    promoted_client = db.relationship('Client', foreign_keys=[promoted_client_id])

    @property
    def full_name(self):
        return ' '.join(p for p in [self.nombre, self.apellido] if p).strip()

    def to_dict(self):
        return {
            "id": self.id,
            "dedupe_key": self.dedupe_key,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "full_name": self.full_name,
            "profesion": self.profesion,
            "etapa": self.etapa,
            "examen": self.examen,
            "page_path": self.page_path,
            "utm_source": self.utm_source,
            "utm_medium": self.utm_medium,
            "utm_campaign": self.utm_campaign,
            "utm_content": self.utm_content,
            "utm_term": self.utm_term,
            "referrer": self.referrer,
            "status": self.status,
            "notes": self.notes,
            "promoted_client_id": self.promoted_client_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f'<WorkshopLead {self.full_name} · {self.examen or "sin examen"}>'
