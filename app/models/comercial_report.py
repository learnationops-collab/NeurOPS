"""El reporte diario de la dirección comercial.

Es el cierre del día del director: qué trabajó con cada grupo, qué trabajó con cada persona, y
las tres listas del cierre (victorias, a mejorar, próximos días). Distinto del reporte diario del
closer (`CloserDailyReport`) y del setter (`SetterDailyStats`), que son los NÚMEROS que cada uno
carga de su propio día; esto es el registro de gestión sobre ellos.

Se guarda uno por día (`fecha` única). El registro por persona vive en `ReporteDirectorPersona`
en vez de un JSON dentro del reporte, porque la pantalla de Historial se consulta justamente por
persona ("Registro de trabajo · Nerina"): con un JSON habría que leer todos los reportes de la
historia y filtrarlos en memoria en cada visita.

Las tres listas del cierre sí son JSON: son listas de texto libre sin identidad propia, nunca se
consultan por separado y no se relacionan con nada.
"""
from datetime import datetime

from app import db


class ReporteDirector(db.Model):
    __tablename__ = 'reportes_director'

    id = db.Column(db.Integer, primary_key=True)
    director_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    # Día que se reporta, en la zona horaria del director. Uno por día: volver a guardar el mismo
    # día actualiza el reporte en vez de crear un segundo (el director corrige lo que escribió).
    fecha = db.Column(db.Date, nullable=False, unique=True, index=True)

    grupal_closers = db.Column(db.Text, nullable=True)
    grupal_setters = db.Column(db.Text, nullable=True)

    victorias = db.Column(db.JSON, nullable=True)
    mejoras = db.Column(db.JSON, nullable=True)
    proximos = db.Column(db.JSON, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    director = db.relationship('User', foreign_keys=[director_id])
    personas = db.relationship('ReporteDirectorPersona', backref='reporte', lazy='dynamic',
                               cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'fecha': self.fecha.isoformat() if self.fecha else None,
            'director': self.director.username if self.director else None,
            'grupal': {'closers': self.grupal_closers or '', 'setters': self.grupal_setters or ''},
            'listas': {'victorias': self.victorias or [], 'mejoras': self.mejoras or [],
                       'proximos': self.proximos or []},
            'individual': [p.to_dict() for p in self.personas.all()],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }


class ReporteDirectorPersona(db.Model):
    """Qué se trabajó con una persona en un día. `trabajo=False` ("No hizo falta") también se
    guarda: que el director haya decidido que no hacía falta es un dato del registro, y sin esa
    fila no se podría distinguir de un día que simplemente no llegó a responder."""
    __tablename__ = 'reportes_director_persona'

    id = db.Column(db.Integer, primary_key=True)
    reporte_id = db.Column(db.Integer, db.ForeignKey('reportes_director.id'), nullable=False, index=True)
    miembro_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    trabajo = db.Column(db.Boolean, nullable=False)
    texto = db.Column(db.Text, nullable=True)

    miembro = db.relationship('User', foreign_keys=[miembro_id])
    __table_args__ = (db.UniqueConstraint('reporte_id', 'miembro_id', name='_reporte_miembro_uc'),)

    def to_dict(self):
        return {
            'miembro_id': self.miembro_id,
            'nombre': self.miembro.username if self.miembro else None,
            'rol': self.miembro.role if self.miembro else None,
            'trabajo': bool(self.trabajo),
            'texto': self.texto or '',
        }
