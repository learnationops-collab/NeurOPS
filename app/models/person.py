from datetime import datetime
from uuid import uuid4

from sqlalchemy.orm import declared_attr

from app import db

# Las formas de reconocer a una persona (ver person_service para cómo se busca con cada una).
IDENTITY_KINDS = ('email', 'instagram', 'phone', 'manychat_id', 'learnation_user_id')
# Para qué se usa un dato cuando NO es el principal. Vacío (lo normal) = el principal sirve para todo.
IDENTITY_USOS = ('pago', 'academia')
PERSON_EVENT_KINDS = ('principal', 'uso', 'baja', 'fusion')


class Person(db.Model):
    """La persona (20/10/2026): la única fuente de verdad de quién es alguien. Su `uuid` es su id en
    todos los servicios (Work, Academia, ManyChat, n8n). Las demás tablas la apuntan por `person_uuid`
    y no copian sus datos. Ver docs/plan_personas.md.

    `email`, `phone` e `instagram` son los principales: los escribe solo `person_service` (el primero
    que se registra, o el que elige alguien del equipo con `hacer_principal`). Todos sus datos, con los
    secundarios, están en `PersonIdentity`."""
    __tablename__ = 'people'
    uuid = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid4()))
    full_name = db.Column(db.String(160), nullable=True)
    email = db.Column(db.String(255), nullable=True, index=True)
    phone = db.Column(db.String(40), nullable=True)
    instagram = db.Column(db.String(100), nullable=True)
    # Si se fusionó con otra, la que quedó. Las fusionadas no se borran: sus uuid pueden estar afuera.
    merged_into_uuid = db.Column(db.String(36), db.ForeignKey('people.uuid'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    identities = db.relationship('PersonIdentity', backref='person', lazy='dynamic', passive_deletes=True)

    def __repr__(self):
        return f'<Person {self.full_name or self.uuid}>'


class PersonIdentity(db.Model):
    """Un dato que identifica a una persona: un mail, instagram, teléfono o id externo. Puede tener
    varios de cada tipo; uno es el principal (`is_primary`). `uso` se llena solo por excepción (el mail
    con que paga o entra a la Academia, si es otro): sin él, para ese uso vale el principal.

    Sin unique en (kind, value) a propósito: hay duplicados por fusionar y teléfonos compartidos, y un
    choque no puede romper el guardado de un webhook."""
    __tablename__ = 'person_identities'
    id = db.Column(db.Integer, primary_key=True)
    person_uuid = db.Column(db.String(36), db.ForeignKey('people.uuid', ondelete='CASCADE'), nullable=False, index=True)
    kind = db.Column(db.String(30), nullable=False)
    # Normalizado (person_service.normalizar): minúsculas, sin @, el teléfono por sus últimos 8 dígitos.
    value = db.Column(db.String(255), nullable=False)
    is_primary = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())
    uso = db.Column(db.String(20), nullable=True)
    # De dónde salió: 'cliente', 'agenda', 'pago', 'manychat', 'academia', 'ficha', 'backfill'.
    source = db.Column(db.String(30), nullable=True)
    # Ya es de otra persona y el nombre no coincide: queda anotado pero no sirve para buscar.
    review_note = db.Column(db.String(255), nullable=True)
    confirmed_by_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    # Dado de baja (mal tipeado, ya no es suyo): no se borra, pero no sirve para buscar.
    retired_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_person_identities_kind_value', 'kind', 'value'),
        # Un principal por tipo, y un dato por uso, entre los que siguen activos.
        db.Index('uq_person_identities_primary', 'person_uuid', 'kind', unique=True,
                 postgresql_where=db.text('is_primary AND retired_at IS NULL'),
                 sqlite_where=db.text('is_primary AND retired_at IS NULL')),
        db.Index('uq_person_identities_uso', 'person_uuid', 'kind', 'uso', unique=True,
                 postgresql_where=db.text('uso IS NOT NULL AND retired_at IS NULL'),
                 sqlite_where=db.text('uso IS NOT NULL AND retired_at IS NULL')),
    )

    def to_dict(self):
        return {'id': self.id, 'person_uuid': self.person_uuid, 'kind': self.kind, 'value': self.value,
                'is_primary': bool(self.is_primary), 'uso': self.uso, 'source': self.source,
                'review_note': self.review_note, 'retired_at': self.retired_at.isoformat() if self.retired_at else None}


class PersonEvent(db.Model):
    """Un cambio sobre la persona hecho a propósito: otro principal, un dato para un uso, una baja o
    una fusión. Quién, cuándo, de qué valor a cuál."""
    __tablename__ = 'person_events'
    id = db.Column(db.Integer, primary_key=True)
    person_uuid = db.Column(db.String(36), db.ForeignKey('people.uuid', ondelete='CASCADE'), nullable=False, index=True)
    kind = db.Column(db.String(20), nullable=False)
    field = db.Column(db.String(30), nullable=True)
    from_value = db.Column(db.String(255), nullable=True)
    to_value = db.Column(db.String(255), nullable=True)
    reason = db.Column(db.String(255), nullable=True)
    actor_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='SET NULL'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class ConPersona:
    """Mixin de las tablas que apuntan a una persona: `person_uuid` y la relación `person`."""

    @declared_attr
    def person_uuid(cls):
        return db.Column(db.String(36), db.ForeignKey('people.uuid', ondelete='SET NULL'), nullable=True, index=True)

    @declared_attr
    def person(cls):
        return db.relationship('Person', foreign_keys=[cls.person_uuid])


class Conversation(ConPersona, db.Model):
    """La conversación con una persona por un canal (en la práctica, Instagram): quién es, qué setter la
    tiene y en qué etapa está. Sus interacciones con el bot (entrada por palabra clave, mensajes enviados y
    respondidos, calificación) son `LeadAnswer` (`answers`). Era `manychat_leads` hasta el 23/10/2026: la
    escribía ManyChat y ahora el motor propio de Instagram (`automatizaciones/registro.py`)."""
    __tablename__ = 'conversations'
    id = db.Column(db.Integer, primary_key=True)
    channel = db.Column(db.String(20), nullable=False, default='instagram', server_default='instagram')
    # El id de la conversación en el canal: 'ig:<IGSID>' del motor propio, el id de suscriptor de ManyChat
    # (solo dígitos, las viejas) o una marca de las armadas a mano ('synth_', 'manual_').
    external_id = db.Column(db.String(100), unique=True, nullable=False)
    # El perfil que el canal informa (nombre y usuario de Instagram) y si sigue a la cuenta.
    name = db.Column(db.String(150))
    ig = db.Column(db.String(100))
    follower = db.Column(db.Boolean, default=False)
    last_stage = db.Column(db.Integer, nullable=True)  # última etapa numérica del flujo
    setter = db.Column(db.String(100), nullable=True)  # el setter del reparto
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    answers = db.relationship('LeadAnswer', backref='conversation', lazy='dynamic', cascade='all, delete-orphan')
