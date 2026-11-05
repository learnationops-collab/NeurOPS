"""Las notas de Gemini de una reunión de Meet, leídas del Drive de team@ (app/services/notas_meet/).

Una fila por Doc «… - Notas de Gemini». Se vincula a la agenda por el evento de Calendar que el Doc trae
en su link (o, si no, por el invitado y la hora) y, por la agenda o por el email del invitado, a la persona.
Las reuniones internas (fulfillment, grupales) quedan sin agenda ni persona.
"""
from datetime import datetime

from app import db
from app.models.person import ConPersona


class MeetingNote(ConPersona, db.Model):
    __tablename__ = 'meeting_notes'
    id = db.Column(db.Integer, primary_key=True)
    drive_file_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(500), nullable=False)
    # Lo que va antes de «:» en el título del evento: 'Sesión diagnóstica', 'Onboarding Session'…
    kind = db.Column(db.String(100), nullable=True, index=True)
    # Cuándo empezó la reunión (UTC naive), según el título del Doc.
    meeting_at = db.Column(db.DateTime, nullable=True, index=True)
    calendar_event_id = db.Column(db.String(255), nullable=True, index=True)
    calendar_ref = db.Column(db.String(255), nullable=True)
    guests = db.Column(db.JSON, nullable=True)  # emails de los invitados
    recording_url = db.Column(db.String(500), nullable=True)
    summary = db.Column(db.Text, nullable=True)
    content = db.Column(db.Text, nullable=True)  # el Doc entero en markdown
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id', ondelete='SET NULL'),
                               nullable=True, index=True)
    # Cómo se vinculó la agenda: 'evento' o 'invitado'.
    link_method = db.Column(db.String(10), nullable=True)
    drive_modified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    appointment = db.relationship('Appointment', foreign_keys=[appointment_id])

    @property
    def doc_url(self):
        return f'https://docs.google.com/document/d/{self.drive_file_id}/edit'

    def to_dict(self, con_contenido=False):
        datos = {
            'id': self.id,
            'title': self.title,
            'kind': self.kind,
            'meeting_at': self.meeting_at.isoformat() + 'Z' if self.meeting_at else None,
            'guests': self.guests or [],
            'recording_url': self.recording_url,
            'doc_url': self.doc_url,
            'summary': self.summary,
            'calendar_event_id': self.calendar_event_id,
            'appointment_id': self.appointment_id,
            'person_uuid': self.person_uuid,
        }
        if con_contenido:
            datos['content'] = self.content
        return datos
