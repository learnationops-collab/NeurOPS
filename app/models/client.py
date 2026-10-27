from uuid import uuid4
from datetime import datetime
from app import db
from app.models.person import ConPersona
from app.models.segmento import ConSegmento

class Client(ConPersona, ConSegmento, db.Model):
    __tablename__ = 'clients'
    id = db.Column(db.Integer, primary_key=True)
    # Igual al uuid de su persona (`person_uuid`, ver app/models/person.py) en los clientes que ya
    # existían: es el id que se compartió afuera. La persona es la fuente de verdad de quién es.
    uuid = db.Column(db.String(36), unique=True, nullable=False, default=lambda: str(uuid4()))
    full_name = db.Column(db.String(120))
    email = db.Column(db.String(120), index=True, unique=True)
    phone = db.Column(db.String(20))
    instagram = db.Column(db.String(64))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    objeciones = db.Column(db.Text, nullable=True) # Objeciones del prospecto
    observaciones = db.Column(db.Text, nullable=True) # Notas de triage / calificacion
    dolores = db.Column(db.Text, nullable=True) # Dolores del prospecto
    form_data = db.Column(db.JSON, nullable=True) # Datos del formulario de calificacion externa
    # Agendas 2.0: el ultimo formulario que completo (preguntas y respuestas tal como las vio, nota y
    # si califico). Lo tienen tambien los que no calificaron y por eso no tienen agenda.
    formulario_payload = db.Column(db.JSON(none_as_null=True), nullable=True)
    follow_up_status = db.Column(db.String(50), nullable=True, default='Por contactar')
    # Grupo de Calendly ("grupo 1"/"grupo 2"/"grupo 3", tal como llega en el JSON de n8n al
    # agendar). Clientes previos a este campo (o sin grupo en el payload) quedan en None —
    # se muestra como "Grupo sin asignar" en vez de fabricar un valor.
    grupo = db.Column(db.String(50), nullable=True)

    # Vinculación con la Academia (Learnation, academy.thelearnation.com) — ver
    # docs/integracion_learnation_api.md. El cruce con la Academia es por email, pero se
    # cachea el id que devuelve para no tener que resolverlo de nuevo en cada consulta/
    # asignación. El acceso (producto y vencimiento) vive en `Subscription`.
    learnation_user_id = db.Column(db.Integer, nullable=True)

    # La baja del cliente (ver `app/services/baja_service.py`): se fue del programa. Lo que pagó
    # sigue contando como cobrado, pero ya no debe nada ni entra en ninguna lista de cobro. Vive
    # en el cliente y no en sus inscripciones ni en sus cuotas porque la deuda y el cobro son por
    # persona, y porque así revertirla es borrar
    # la marca: nada de lo que había se tocó.
    baja_at = db.Column(db.DateTime, nullable=True, index=True)
    baja_motivo = db.Column(db.String(255), nullable=True)
    baja_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    # El anuncio por el que llegó este cliente, elegido a mano por el setter para sus VENTAS
    # (18/10/2026): manda sobre lo que diga ManyChat para todos sus pagos, así una palabra clave
    # equivocada se puede cambiar (`ventas_palabra_clave_service`, `anuncios_service.claves_de_cobros`).
    anuncio_ventas_id = db.Column(db.Integer, db.ForeignKey('ads.id'), nullable=True)

    # Relationships
    appointments = db.relationship('Appointment', backref='client', lazy='dynamic', cascade="all, delete-orphan")
    survey_answers = db.relationship('SurveyAnswer', backref='client', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Client {self.full_name or self.email}>'

