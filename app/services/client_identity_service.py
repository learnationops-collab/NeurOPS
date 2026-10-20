"""La identidad del cliente (20/10/2026): una sola forma de encontrar a una persona.

`Client.uuid` es el id que comparten todos los servicios; `ClientIdentity` guarda cada mail, instagram,
teléfono e id externo con que apareció. Reglas de `buscar` (las que ya se aprendieron en producción,
ver `client_dedup_service` y `BookingService.find_or_create_client`):
  · un id externo (ManyChat, Academia) o el email alcanzan solos;
  · instagram y teléfono se reciclan o se comparten: piden además que el nombre sea compatible.
Mientras la tabla no esté cargada (scripts/backfill_client_identities.py) busca también en las columnas
de `clients`, así no se crean duplicados en el medio.
"""
import logging
from uuid import uuid4

from sqlalchemy import event, func, inspect

from app import db
from app.models import Client, ClientIdentity
from app.services.client_dedup_service import (_es_email_placeholder, _names_compatible, _normalize_email,
                                               _normalize_instagram, _normalize_phone)

logger = logging.getLogger(__name__)

# En orden de confianza: el primero que encuentra a alguien decide.
ORDEN = ('manychat_id', 'learnation_user_id', 'email', 'phone', 'instagram')
FUERTES = ('manychat_id', 'learnation_user_id', 'email')
# Columna de `clients` que también es una identidad.
COLUMNAS = {'email': 'email', 'instagram': 'instagram', 'phone': 'phone', 'learnation_user_id': 'learnation_user_id'}


def normalizar(kind, value):
    if value is None:
        return None
    if kind == 'email':
        v = _normalize_email(value)
        return None if not v or _es_email_placeholder(v) else v
    if kind == 'instagram':
        v = str(value).strip().lower().split('instagram.com/')[-1].strip('/').split('?')[0]
        v = _normalize_instagram(v)
        return None if not v or v.startswith('no_ig_') else v
    if kind == 'phone':
        return _normalize_phone(value)
    v = str(value).strip()
    return v or None


def claves(email=None, instagram=None, phone=None, manychat_id=None, learnation_user_id=None):
    """[(kind, valor normalizado)] en orden de confianza, sin los vacíos ni los placeholders."""
    datos = {'email': email, 'instagram': instagram, 'phone': phone, 'manychat_id': manychat_id,
             'learnation_user_id': learnation_user_id}
    return [(k, v) for k, v in ((k, normalizar(k, datos[k])) for k in ORDEN) if v]


def _ids_por_columna(kind, value):
    if kind == 'email':
        q = Client.query.filter(func.lower(Client.email) == value)
    elif kind == 'instagram':
        q = Client.query.filter(func.lower(func.replace(Client.instagram, '@', '')) == value)
    elif kind == 'phone':
        q = Client.query.filter(Client.phone.like(f'%{value}%'))
    elif kind == 'learnation_user_id' and value.isdigit():
        q = Client.query.filter(Client.learnation_user_id == int(value))
    else:
        return set()
    return {c.id for c in q.with_entities(Client.id)}


def duenos(kind, value):
    """Los ids de los clientes que tienen este dato."""
    ids = {r.client_id for r in ClientIdentity.query.with_entities(ClientIdentity.client_id)
           .filter_by(kind=kind, value=value)}
    return ids | _ids_por_columna(kind, value)


def buscar(nombre=None, **datos):
    """El cliente de estos datos, o None. Si un dato lo tienen varios clientes (duplicados sin fusionar)
    gana el más antiguo y queda en el log."""
    for kind, value in claves(**datos):
        ids = duenos(kind, value)
        if not ids:
            continue
        candidatos = Client.query.filter(Client.id.in_(ids)).order_by(Client.id).all()
        if kind not in FUERTES:
            candidatos = [c for c in candidatos if _names_compatible(nombre, c.full_name)]
        if len(candidatos) > 1:
            logger.warning(f'[IDENTIDAD] {kind}={value} lo tienen {[c.id for c in candidatos]}: uso #{candidatos[0].id}')
        if candidatos:
            return candidatos[0]
    return None


def _ya_tiene(session, client, kind, value):
    for obj in session.new:
        if isinstance(obj, ClientIdentity) and obj.kind == kind and obj.value == value and \
                (obj.client is client or (client.id and obj.client_id == client.id)):
            return True
    if not client.id:
        return False
    with session.no_autoflush:
        return ClientIdentity.query.filter_by(client_id=client.id, kind=kind, value=value).first() is not None


def anotar(client, pares, fuente):
    """Le suma al cliente los datos que todavía no tiene. No hace commit."""
    session = db.session
    for kind, value in pares:
        if not _ya_tiene(session, client, kind, value):
            session.add(ClientIdentity(client=client, kind=kind, value=value, source=fuente))


def resolver(nombre=None, email=None, instagram=None, phone=None, *, manychat_id=None, learnation_user_id=None,
             crear=True, fuente='cliente'):
    """Busca al cliente y, si no está y `crear`, lo crea. Completa sus columnas vacías y le anota todos
    los datos que trajo (un segundo mail o instagram quedan como identidad). Hace flush, no commit."""
    pares = claves(email, instagram, phone, manychat_id, learnation_user_id)
    client = buscar(nombre, email=email, instagram=instagram, phone=phone, manychat_id=manychat_id,
                    learnation_user_id=learnation_user_id)
    datos = dict(pares)
    if client is None:
        if not crear:
            return None
        mail = datos.get('email')
        if mail and Client.query.filter(func.lower(Client.email) == mail).first():
            mail = None  # el email ya es de otro cliente que el nombre no corroboró
        client = Client(full_name=nombre or (mail.split('@')[0] if mail else 'Cliente Nuevo'),
                        email=mail or f'no-email-{uuid4().hex[:12]}@neurops.com',
                        phone=str(phone).strip() if datos.get('phone') else None,
                        instagram=datos.get('instagram'))
        db.session.add(client)
    else:
        if nombre and not client.full_name:
            client.full_name = nombre
        mail = datos.get('email')
        if mail and (not client.email or _es_email_placeholder(client.email)) and \
                not Client.query.filter(func.lower(Client.email) == mail, Client.id != client.id).first():
            client.email = mail
        if datos.get('phone') and not client.phone:
            client.phone = str(phone).strip()
        if datos.get('instagram') and not client.instagram:
            client.instagram = datos['instagram']
    anotar(client, pares, fuente)
    db.session.flush()
    return client


def por_uuid(valor):
    return Client.query.filter_by(uuid=str(valor).strip().lower()).first() if valor else None


def _anotar_columnas(session):
    """Lo que se guarda en las columnas del cliente queda también como identidad."""
    for obj in list(session.new) + list(session.dirty):
        if not isinstance(obj, Client):
            continue
        estado = inspect(obj)
        nuevo = obj in session.new
        pares = []
        for kind, col in COLUMNAS.items():
            if not nuevo and not estado.attrs[col].history.has_changes():
                continue
            value = normalizar(kind, getattr(obj, col))
            if value:
                pares.append((kind, value))
        if pares:
            anotar(obj, pares, 'cliente')


def register_identity_tracking(app):
    @event.listens_for(db.session, 'before_flush')
    def _identidad_before_flush(session, flush_context, instances):
        try:
            _anotar_columnas(session)
        except Exception as e:
            # El cliente se guarda igual: el dato que faltó lo recupera el backfill.
            logger.error(f'[IDENTIDAD] No se pudo anotar la identidad del cliente: {e}')
