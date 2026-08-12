from datetime import datetime
from app import db


class WorkshopLead(db.Model):
    """Lead capturado por el gate de las landings públicas de institute.thelearnation.com
    (por ahora /replay/, la clase grabada).

    Es una tabla de entrada, deliberadamente separada de `clients`: acá cae todo el
    que completa el gate, sin validar ni deduplicar contra el CRM. El pase a
    `Client` es una decisión comercial posterior (la marca `promoted_client_id`).

    El teléfono se guarda normalizado en E.164 (`+5491122334455`) para que el
    setter pueda abrir WhatsApp sin limpiarlo a mano.
    """
    __tablename__ = 'workshop_leads'

    id = db.Column(db.Integer, primary_key=True)

    # --- Datos del gate ---
    nombre = db.Column(db.String(80), nullable=False)
    apellido = db.Column(db.String(80), nullable=True)
    phone = db.Column(db.String(24), index=True, nullable=True)   # E.164
    phone_country = db.Column(db.String(8), nullable=True)        # prefijo elegido, ej '+54'
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

    @property
    def whatsapp_url(self):
        """Link directo al chat, listo para que el setter lo abra."""
        if not self.phone:
            return None
        return 'https://wa.me/' + self.phone.lstrip('+')

    def to_dict(self):
        return {
            "id": self.id,
            "nombre": self.nombre,
            "apellido": self.apellido,
            "full_name": self.full_name,
            "phone": self.phone,
            "phone_country": self.phone_country,
            "whatsapp_url": self.whatsapp_url,
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
        return f'<WorkshopLead {self.full_name} {self.phone or "sin teléfono"}>'
