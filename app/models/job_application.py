from datetime import datetime
from app import db

# Los 8 criterios ponderados de "Clarity" (ver docs del handoff de postulación).
# `default_weight` es el punto de partida sembrado por la migración; el peso
# efectivo (editable desde el panel) vive en la tabla ClarityWeight.
CLARITY_CRITERIA = [
    {"criterion": "formacion", "label": "Formación como closer (pregunta 10)", "default_weight": 22},
    {"criterion": "experiencia", "label": "Experiencia y a qué se dedica (8 y 9)", "default_weight": 18},
    {"criterion": "cierre", "label": "Porcentaje de cierre medido (11)", "default_weight": 16},
    {"criterion": "video", "label": "Video y llamada (22 y 23)", "default_weight": 12},
    {"criterion": "obstaculo", "label": "Cómo resuelve un obstáculo (17)", "default_weight": 10},
    {"criterion": "ingles", "label": "Nivel de inglés (12)", "default_weight": 8},
    {"criterion": "herramientas", "label": "Herramientas y CRM (13)", "default_weight": 8},
    {"criterion": "objetivos", "label": "Objetivos a largo plazo (18)", "default_weight": 6},
]

VOTE_VALUES = ('pre', 'des')


class JobApplication(db.Model):
    """Postulación al puesto de Closer de ventas, recibida desde el formulario
    público de institute.thelearnation.com (ver /formulario). Una fila por
    candidato; se actualiza (no se duplica) por `dedupe_key` en cada submit,
    porque la landing reenvía cuando el candidato usa "Editar mis respuestas".
    """
    __tablename__ = 'job_applications'

    id = db.Column(db.Integer, primary_key=True)
    dedupe_key = db.Column(db.String(64), index=True, unique=True, nullable=True)

    nombre = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), nullable=False)
    disclaimer = db.Column(db.String(10), nullable=True)
    whatsapp = db.Column(db.String(40), nullable=True)
    edad = db.Column(db.String(40), nullable=True)
    pais = db.Column(db.String(60), nullable=True)
    instagram = db.Column(db.String(80), nullable=True)
    dedicacion = db.Column(db.Text, nullable=True)
    conocimiento = db.Column(db.String(60), nullable=True)
    formacion = db.Column(db.Text, nullable=True)
    # 'nada' o el número (0-100) como texto, tal como lo manda el formulario.
    cierre = db.Column(db.String(10), nullable=True)
    ingles = db.Column(db.String(20), nullable=True)
    herramientas = db.Column(db.JSON, nullable=True)
    reporte = db.Column(db.String(160), nullable=True)
    aportes = db.Column(db.JSON, nullable=True)
    habilidades = db.Column(db.Text, nullable=True)
    obstaculo = db.Column(db.Text, nullable=True)
    objetivos = db.Column(db.Text, nullable=True)
    porque = db.Column(db.JSON, nullable=True)
    fuente = db.Column(db.String(60), nullable=True)
    bolsa = db.Column(db.String(120), nullable=True)
    video = db.Column(db.String(500), nullable=True)
    llamada = db.Column(db.String(500), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def veredicto(self):
        votos = {v.reviewer_id: v.vote for v in self.votes}
        valores = votos.values()
        hay_pre = 'pre' in valores
        hay_des = 'des' in valores
        if hay_pre and hay_des:
            return 'decidir'
        if hay_pre:
            return 'preseleccionada'
        if hay_des:
            return 'descartado'
        return 'sin_calificar'

    def to_dict(self, weights=None, include_respuestas=True):
        from app.services import clarity

        data = {
            "id": self.id,
            "dedupe_key": self.dedupe_key,
            "nombre": self.nombre,
            "email": self.email,
            "veredicto": self.veredicto(),
            "votos": {v.reviewer_id: v.vote for v in self.votes},
            "score": clarity.score_de(self, weights) if weights is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            # Se muestran siempre: la tabla del inbox (Formación/Inglés/Cierre) los
            # necesita aunque include_respuestas=False no traiga el resto del formulario.
            "conocimiento": self.conocimiento,
            "cierre": self.cierre,
            "ingles": self.ingles,
        }
        if include_respuestas:
            data.update({
                "disclaimer": self.disclaimer,
                "whatsapp": self.whatsapp,
                "edad": self.edad,
                "pais": self.pais,
                "instagram": self.instagram,
                "dedicacion": self.dedicacion,
                "formacion": self.formacion,
                "herramientas": self.herramientas or [],
                "reporte": self.reporte,
                "aportes": self.aportes or [],
                "habilidades": self.habilidades,
                "obstaculo": self.obstaculo,
                "objetivos": self.objetivos,
                "porque": self.porque or [],
                "fuente": self.fuente,
                "bolsa": self.bolsa,
                "video": self.video,
                "llamada": self.llamada,
            })
        return data

    def __repr__(self):
        return f'<JobApplication {self.nombre} · {self.email}>'


class JobApplicationVote(db.Model):
    """Voto de un revisor (Mario/Marlon, o cualquier admin) sobre un candidato.
    `reviewer_id` es el `User.id` de la sesión real: no hay switch de demo."""
    __tablename__ = 'job_application_votes'
    __table_args__ = (
        db.UniqueConstraint('application_id', 'reviewer_id', name='uq_job_application_vote_reviewer'),
    )

    id = db.Column(db.Integer, primary_key=True)
    application_id = db.Column(db.Integer, db.ForeignKey('job_applications.id', ondelete='CASCADE'), nullable=False, index=True)
    reviewer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    vote = db.Column(db.String(10), nullable=False)  # 'pre' | 'des'
    voted_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    application = db.relationship('JobApplication', backref=db.backref('votes', lazy='joined', cascade='all, delete-orphan'))
    reviewer = db.relationship('User', foreign_keys=[reviewer_id])

    def to_dict(self):
        return {
            "id": self.id,
            "application_id": self.application_id,
            "reviewer_id": self.reviewer_id,
            "reviewer_name": self.reviewer.username if self.reviewer else None,
            "vote": self.vote,
            "voted_at": self.voted_at.isoformat() if self.voted_at else None,
        }


class ClarityWeight(db.Model):
    """Peso editable por criterio de Clarity. Sembrada por la migración con los
    defaults de CLARITY_CRITERIA; el panel los ajusta desde la pestaña Clarity."""
    __tablename__ = 'job_application_clarity_weights'

    id = db.Column(db.Integer, primary_key=True)
    criterion = db.Column(db.String(40), unique=True, nullable=False)
    label = db.Column(db.String(160), nullable=False)
    weight = db.Column(db.Integer, nullable=False)
    default_weight = db.Column(db.Integer, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "criterion": self.criterion,
            "label": self.label,
            "weight": self.weight,
            "default_weight": self.default_weight,
        }
