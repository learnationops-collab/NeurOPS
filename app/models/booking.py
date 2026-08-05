from datetime import datetime
from app import db

class Appointment(db.Model):
    __tablename__ = 'appointments'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    setter_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False)
    start_time = db.Column(db.DateTime, index=True)
    origin = db.Column(db.String(100))
    is_pinned = db.Column(db.Boolean, default=False)
    google_event_id = db.Column(db.String(255))
    last_stage = db.Column(db.String(100))
    result = db.Column(db.String(100))
    closer_result = db.Column(db.String(100), default='Pendiente', nullable=True)
    is_rescheduled = db.Column(db.Boolean, default=False, nullable=True)
    with_decision_maker = db.Column(db.Boolean, nullable=True)
    offer_presented = db.Column(db.Boolean, nullable=True)
    linked_call = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    # Última vez que se modificó cualquier campo de la cita. Permite distinguir "cuándo pasó la
    # llamada" (start_time) de "cuándo el closer efectivamente la procesó" — necesario para que
    # el reporte diario pueda contar trabajo de limpieza de backlog hecho hoy sobre citas de
    # días/meses anteriores, algo que start_time por sí solo no puede reflejar.
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Campos de flujo de mazo secuencial (Setter & Closer)
    setter_processed = db.Column(db.Boolean, default=False, nullable=False)
    closer_processed = db.Column(db.Boolean, default=False, nullable=False)
    setter_notes = db.Column(db.Text, nullable=True)
    closer_notes = db.Column(db.Text, nullable=True)
    ig_chat_link = db.Column(db.String(500), nullable=True)
    keyword = db.Column(db.String(100), nullable=True)
    examen = db.Column(db.String(255), nullable=True)
    fecha_seguimiento = db.Column(db.String(255), nullable=True)
    fecha_seguimiento_cobro = db.Column(db.String(255), nullable=True)
    seguimiento_realizado = db.Column(db.Boolean, default=False, server_default='0')

    # Categorización del seguimiento (pipeline de recuperación v7): 'no_tomada' (no show/canceló/
    # reprogramó sin fecha), 'tomada' (asistió pero quedó una decisión pendiente o falta 2da llamada),
    # 'cerrada' (cliente ya pagó: seguimiento de cobranza/renovación/upsell).
    seguimiento_tipo = db.Column(db.String(50), nullable=True)
    seguimiento_sub = db.Column(db.String(255), nullable=True)
    seguimiento_intento = db.Column(db.Integer, default=1, server_default='1')

    # Recordatorio PRE-llamada (distinto del seguimiento post-llamada de arriba): mientras el lead
    # sigue en el pipeline de confirmación ("Por confirmar"/"Conversando"), le permite al closer
    # dejarse un aviso para volver a escribirle antes de que llegue la hora de la cita. DateTime UTC
    # real (no String) porque necesita compararse con la hora actual para calcular "vencido"/"hoy".
    pre_call_reminder_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    closer = db.relationship('User', foreign_keys=[closer_id], backref='appointments_assigned')
    setter = db.relationship('User', foreign_keys=[setter_id], backref='appointments_set')
    # Note: client is already provided by backref in Client model

class Availability(db.Model):
    __tablename__ = 'availability'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    date = db.Column(db.Date, nullable=False) 
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)

class WeeklyAvailability(db.Model):
    __tablename__ = 'weekly_availability'
    id = db.Column(db.Integer, primary_key=True)
    closer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False) 
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    is_active = db.Column(db.Boolean, default=True)

class SurveyQuestion(db.Model):
    __tablename__ = 'survey_questions'
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(255), nullable=False)
    question_type = db.Column(db.String(50), default='text')
    options = db.Column(db.Text)
    order = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    mapping_field = db.Column(db.String(50), nullable=True)
    event_id = db.Column(db.Integer, db.ForeignKey('events.id'), nullable=True)
    group_id = db.Column(db.Integer, db.ForeignKey('event_groups.id'), nullable=True)
    is_global = db.Column(db.Boolean, default=False)
    step = db.Column(db.String(20), default='first_survey')
    
    event = db.relationship('Event', backref='questions')
    group = db.relationship('EventGroup', backref='group_questions')

class SurveyAnswer(db.Model):
    __tablename__ = 'survey_answers'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id'), nullable=False) 
    question_id = db.Column(db.Integer, db.ForeignKey('survey_questions.id'), nullable=False)
    answer = db.Column(db.Text)
    appointment_id = db.Column(db.Integer, db.ForeignKey('appointments.id'))
    
    question = db.relationship('SurveyQuestion')
    appointment = db.relationship('Appointment', backref='survey_answers')
