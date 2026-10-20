from datetime import datetime

from app import db

# Las formas de reconocer a una persona. manychat_id y learnation_user_id las da un sistema (no se
# tipean): alcanzan solas. El email también. Instagram y teléfono se reciclan o se comparten, y piden
# además que el nombre coincida (ver client_identity_service).
IDENTITY_KINDS = ('email', 'instagram', 'phone', 'manychat_id', 'learnation_user_id')


class ClientIdentity(db.Model):
    """Un dato que identifica a un cliente (20/10/2026). `clients.uuid` es el id de la persona en todos
    los servicios; esta tabla junta todos sus mails, instagrams, teléfonos e ids externos, así
    quien chatea con un instagram y paga con otro mail sigue siendo el mismo cliente.

    Sin unique en (kind, value) a propósito: hay valores en dos clientes (duplicados por fusionar o un
    teléfono compartido) y un choque no puede romper el guardado de un webhook."""
    __tablename__ = 'client_identities'
    id = db.Column(db.Integer, primary_key=True)
    client_id = db.Column(db.Integer, db.ForeignKey('clients.id', ondelete='CASCADE'), nullable=False, index=True)
    kind = db.Column(db.String(30), nullable=False)
    # Normalizado (client_identity_service.normalizar): minúsculas, sin @, el teléfono por sus últimos 8 dígitos.
    value = db.Column(db.String(255), nullable=False)
    # De dónde salió: 'cliente', 'agenda', 'pago', 'manychat', 'academia', 'backfill'.
    source = db.Column(db.String(30), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    client = db.relationship('Client', backref=db.backref('identities', lazy='dynamic', passive_deletes=True))

    __table_args__ = (db.Index('ix_client_identities_kind_value', 'kind', 'value'),)

    def to_dict(self):
        return {'id': self.id, 'client_id': self.client_id, 'kind': self.kind, 'value': self.value,
                'source': self.source, 'created_at': self.created_at.isoformat() if self.created_at else None}
