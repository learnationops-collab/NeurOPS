from datetime import datetime

from app import db


class WorkshopGrupo(db.Model):
    """Un grupo de WhatsApp de un taller, atado a un conjunto de anuncios de Meta (ADR-W146).

    La landing manda a cada visita al grupo del conjunto que la trajo (`workshop_grupos_service`), así
    después se sabe de qué conjunto vino cada persona. El grupo general, para las visitas sin anuncio,
    sigue siendo `WorkshopEvent.whatsapp_url`. `conjunto_id` es el id del adset; `codigo` («cg1») es
    la otra forma de nombrarlo en el `utm_term` cuando el link se escribe a mano.
    """
    __tablename__ = 'workshop_grupos'
    __table_args__ = (
        db.UniqueConstraint('event_id', 'nombre', name='uq_workshop_grupo_nombre'),
        db.UniqueConstraint('event_id', 'conjunto_id', name='uq_workshop_grupo_conjunto'),
    )
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.Integer, db.ForeignKey('workshop_events.id', ondelete='CASCADE'), nullable=False, index=True)
    nombre = db.Column(db.String(80), nullable=False)
    codigo = db.Column(db.String(40), nullable=True)
    whatsapp_url = db.Column(db.String(300), nullable=False)
    conjunto_id = db.Column(db.String(40), nullable=True)
    conjunto_nombre = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)

    # `selectin`: el listado de talleres trae los grupos de todos en una sola consulta (el chip
    # «N grupos» y la API pública los leen de acá). El cascade borra los grupos con su taller también
    # en SQLite, que no aplica el ON DELETE.
    evento = db.relationship('WorkshopEvent', backref=db.backref(
        'grupos', cascade='all, delete-orphan', lazy='selectin', order_by='WorkshopGrupo.id'))

    def to_dict(self):
        return {
            'id': self.id,
            'nombre': self.nombre,
            'codigo': self.codigo,
            'whatsapp_url': self.whatsapp_url,
            'conjunto_id': self.conjunto_id,
            'conjunto_nombre': self.conjunto_nombre,
        }
