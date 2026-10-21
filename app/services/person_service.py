"""La persona (20/10/2026): una sola forma de encontrarla, crearla y cambiarle los datos.

El contrato está en docs/plan_personas.md. Reglas de `buscar` (las que ya se aprendieron en
producción, ver `client_dedup_service` y `BookingService.find_or_create_client`):
  · un id externo (ManyChat, Academia) o el email alcanzan solos;
  · instagram y teléfono se reciclan o se comparten: piden además que el nombre sea compatible.
Un dato nuevo entra siempre como secundario: el principal es el primero que se registró y solo lo
cambia alguien del equipo (`hacer_principal`). `uso` se llena solo por excepción; sin él vale el
principal (`dato`).
Mientras `person_identities` no esté cargada (scripts/backfill_person_identities.py) busca también en
las columnas de `people`, así no se crean duplicados en el medio.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy import event, func, inspect

from app import db
from app.models import (Appointment, Client, ConciliacionMovimiento, Conversation, Enrollment, FinancialAgenda,
                        FinancialSale, InstallmentPlan, ManychatAdLead, ManychatLead, Person, PersonEvent,
                        PersonIdentity, PublicRegistration, Sale, Subscription, WorkshopLead)
from app.services.client_dedup_service import (_es_email_placeholder, _names_compatible, _normalize_email,
                                               _normalize_instagram, _normalize_phone)

logger = logging.getLogger(__name__)

# En orden de confianza: el primero que encuentra a alguien decide.
ORDEN = ('manychat_id', 'learnation_user_id', 'email', 'phone', 'instagram')
FUERTES = ('manychat_id', 'learnation_user_id', 'email')
# Los datos principales que la persona muestra en sus columnas.
COLUMNAS = ('email', 'instagram', 'phone')
# Las columnas de `clients` que son identidad: lo que se guarde ahí se le anota a su persona.
COLUMNAS_CLIENTE = ('email', 'instagram', 'phone', 'learnation_user_id')
# Todas las tablas con `person_uuid` (las mueve `fusionar`).
TABLAS = (Client, Conversation, FinancialSale, FinancialAgenda, Appointment, InstallmentPlan, Enrollment, Sale,
          Subscription, ManychatLead, ManychatAdLead, WorkshopLead, ConciliacionMovimiento, PublicRegistration)
# Las que tienen `client_id`: mientras se migra, su persona sale de su cliente.
CON_CLIENTE = (FinancialSale, Appointment, InstallmentPlan, Enrollment, Sale, Subscription)


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


def telefono_crudo(phone):
    """El teléfono como se escribió, para mostrar en `Person.phone` (40 caracteres), o None si no tiene
    un número válido."""
    return str(phone).strip()[:40] if phone and normalizar('phone', phone) else None


def claves(email=None, instagram=None, phone=None, manychat_id=None, learnation_user_id=None):
    """[(kind, valor normalizado)] en orden de confianza, sin los vacíos ni los placeholders."""
    datos = {'email': email, 'instagram': instagram, 'phone': phone, 'manychat_id': manychat_id,
             'learnation_user_id': learnation_user_id}
    return [(k, v) for k, v in ((k, normalizar(k, datos[k])) for k in ORDEN) if v]


def nombre_limpio(nombre):
    """El nombre, o None si viene vacío o es una plantilla sin completar ('{{full_name}}' de ManyChat)."""
    n = ' '.join(str(nombre or '').split())
    return None if not n or (n.startswith('{{') and n.endswith('}}')) else n


def mismo_nombre(a, b):
    """¿Pueden ser la misma persona? Para BUSCAR por instagram o teléfono: el mismo nombre, uno vacío o
    genérico, o nombres parecidos ("Juan Perez" / "Juan Pérez García", `_names_corroborate`). Para
    FUSIONAR se sigue pidiendo `_names_compatible` (el mismo nombre)."""
    from app.services.sales_consistency_service import SalesConsistencyService
    return _names_compatible(a, b) or SalesConsistencyService._names_corroborate(a, b)


def _activas():
    return PersonIdentity.query.filter(PersonIdentity.retired_at.is_(None), PersonIdentity.review_note.is_(None))


def duenos(kind, value):
    """Los uuid de las personas (no fusionadas) que tienen este dato activo."""
    uuids = {r.person_uuid for r in _activas().with_entities(PersonIdentity.person_uuid).filter_by(kind=kind, value=value)}
    if kind == 'email':
        q = Person.query.filter(func.lower(Person.email) == value)
    elif kind == 'instagram':
        q = Person.query.filter(func.lower(func.replace(Person.instagram, '@', '')) == value)
    elif kind == 'phone':
        q = Person.query.filter(Person.phone.like(f'%{value}%'))
    else:
        q = None
    if q is not None:
        uuids |= {p.uuid for p in q.with_entities(Person.uuid)}
    if not uuids:
        return set()
    return {p.uuid for p in Person.query.with_entities(Person.uuid)
            .filter(Person.uuid.in_(uuids), Person.merged_into_uuid.is_(None))}


def buscar(nombre=None, **datos):
    """La persona de estos datos, o None. Nunca crea. Si un dato lo tienen varias (duplicados sin
    fusionar) gana la más antigua y queda en el log."""
    nombre = nombre_limpio(nombre)
    for kind, value in claves(**datos):
        uuids = duenos(kind, value)
        if not uuids:
            continue
        candidatos = Person.query.filter(Person.uuid.in_(uuids)).order_by(Person.created_at, Person.uuid).all()
        if kind not in FUERTES:
            candidatos = [p for p in candidatos if mismo_nombre(nombre, p.full_name)]
        if len(candidatos) > 1:
            logger.warning(f'[PERSONA] {kind}={value} lo tienen {[p.uuid for p in candidatos]}: uso {candidatos[0].uuid}')
        if candidatos:
            return candidatos[0]
    return None


def _pendientes(session, person):
    return [o for o in session.new if isinstance(o, PersonIdentity) and
            (o.person is person or (o.person_uuid and o.person_uuid == person.uuid))]


def _ya_tiene(session, person, kind, value):
    if any(o.kind == kind and o.value == value for o in _pendientes(session, person)):
        return True
    return bool(person.uuid) and PersonIdentity.query.filter_by(
        person_uuid=person.uuid, kind=kind, value=value).first() is not None


def _identidad(person, kind, *, primary=None, uso=None, value=None):
    q = PersonIdentity.query.filter(PersonIdentity.person_uuid == person.uuid, PersonIdentity.kind == kind,
                                    PersonIdentity.retired_at.is_(None))
    if primary:
        q = q.filter(PersonIdentity.is_primary.is_(True))
    if uso:
        q = q.filter(PersonIdentity.uso == uso)
    if value:
        q = q.filter(PersonIdentity.value == value)
    return q.first() if person.uuid else None


def _tiene_principal(session, person, kind):
    if any(o.kind == kind and o.is_primary for o in _pendientes(session, person)):
        return True
    return _identidad(person, kind, primary=True) is not None


def anotar(person, pares, fuente, uso=None):
    """Le suma a la persona los datos que todavía no tiene. El primero de cada tipo queda como
    principal; los demás, secundarios. Un email que ya es de otra persona con otro nombre queda
    anotado para revisar y no sirve para buscar. No hace commit."""
    session = db.session
    with session.no_autoflush:
        for kind, value in pares:
            if _ya_tiene(session, person, kind, value):
                continue
            nota = None
            if kind == 'email':
                otros = duenos(kind, value) - {person.uuid}
                ajenos = [p for p in Person.query.filter(Person.uuid.in_(otros))
                          if not mismo_nombre(person.full_name, p.full_name)] if otros else []
                if ajenos:
                    nota = f'También es de {ajenos[0].uuid}'
            principal = nota is None and not _tiene_principal(session, person, kind)
            usa = uso if uso and nota is None and _identidad(person, kind, uso=uso) is None else None
            session.add(PersonIdentity(person=person, kind=kind, value=value, is_primary=principal, uso=usa,
                                       source=fuente, review_note=nota))
            if principal and kind in COLUMNAS and kind != 'phone' and not getattr(person, kind):
                setattr(person, kind, value)


def resolver(nombre=None, email=None, instagram=None, phone=None, *, manychat_id=None, learnation_user_id=None,
             crear=True, fuente='cliente'):
    """Busca a la persona y, si no está y `crear`, la crea. Le anota todos los datos que trajo (los que
    ya tenía no se repiten; los nuevos quedan secundarios). Hace flush, no commit."""
    person = _resolver(nombre, email, instagram, phone, manychat_id, learnation_user_id, crear, fuente)
    if person is not None:
        db.session.flush()
    return person


def _resolver(nombre, email, instagram, phone, manychat_id, learnation_user_id, crear, fuente):
    """`resolver` sin flush: lo usa el seguimiento automático, que corre en medio de uno."""
    nombre = nombre_limpio(nombre)
    pares = claves(email, instagram, phone, manychat_id, learnation_user_id)
    person = buscar(nombre, email=email, instagram=instagram, phone=phone, manychat_id=manychat_id,
                    learnation_user_id=learnation_user_id)
    if person is None:
        if not crear:
            return None
        person = Person(uuid=str(uuid4()), full_name=nombre or None,
                        phone=telefono_crudo(phone))
        db.session.add(person)
    else:
        if nombre and not person.full_name:
            person.full_name = nombre
        if not person.phone and telefono_crudo(phone):
            person.phone = telefono_crudo(phone)  # el primero que llega, como se escribió
    anotar(person, pares, fuente)
    return person


def por_uuid(valor):
    """La persona de ese uuid; si se fusionó, la que quedó."""
    person = db.session.get(Person, str(valor).strip().lower()) if valor else None
    vistos = set()
    while person is not None and person.merged_into_uuid and person.uuid not in vistos:
        vistos.add(person.uuid)
        person = db.session.get(Person, person.merged_into_uuid)
    return person


def dato(person, kind, uso=None):
    """El dato para ese uso (el mail con que entra a la Academia); si no hay uno propio, el principal."""
    if person is None:
        return None
    if uso:
        ident = _identidad(person, kind, uso=uso)
        if ident:
            return ident.value
    ident = _identidad(person, kind, primary=True)
    return ident.value if ident else (getattr(person, kind, None) if kind in COLUMNAS else None)


def datos(person):
    """Lo que se muestra de la persona, para serializar."""
    if person is None:
        return None
    return {'uuid': person.uuid, 'nombre': person.full_name, 'email': person.email,
            'instagram': person.instagram, 'phone': person.phone}


def _evento(person, kind, field, desde, hasta, reason, usuario):
    db.session.add(PersonEvent(person_uuid=person.uuid, kind=kind, field=field, from_value=desde, to_value=hasta,
                               reason=reason, actor_id=getattr(usuario, 'id', None)))


def _mostrable(kind, crudo, value):
    """Lo que va en la columna de la persona: el teléfono como se escribió (con su código de país); el
    resto, normalizado."""
    return (telefono_crudo(crudo) or value) if kind == 'phone' else value


def hacer_principal(person, kind, value, usuario=None, uso=None, reason=None, corrige=False):
    """Alguien del equipo elige el dato principal de un tipo (o el de un uso, como el mail de la
    Academia). Si el dato no estaba, se agrega. `corrige`: el anterior estaba mal y se da de baja; sin
    él, el anterior queda como otro dato válido. Queda el evento con quién y desde qué valor. No hace commit."""
    crudo = value
    value = normalizar(kind, value)
    if not value:
        raise ValueError(f'El {kind} no es válido.')
    ident = _identidad(person, kind, value=value)
    if ident is None:
        ident = PersonIdentity(person=person, kind=kind, value=value, source='ficha')
        db.session.add(ident)
    anterior = _identidad(person, kind, uso=uso) if uso else _identidad(person, kind, primary=True)
    if anterior is not None and anterior is not ident:
        if uso:
            anterior.uso = None
        else:
            anterior.is_primary = False
        if corrige:
            anterior.retired_at = datetime.utcnow()
        db.session.flush()  # el índice de un principal por tipo no admite dos a la vez
    if uso:
        ident.uso = uso
    else:
        ident.is_primary = True
        if kind in COLUMNAS:
            setattr(person, kind, _mostrable(kind, crudo, value))
    ident.review_note = None
    ident.confirmed_by_id, ident.confirmed_at = getattr(usuario, 'id', None), datetime.utcnow()
    _evento(person, 'uso' if uso else 'principal', f'{kind}:{uso}' if uso else kind,
            anterior.value if anterior is not None else None, value,
            reason or ('Corrección: el anterior se dio de baja' if corrige and anterior is not None else None), usuario)
    db.session.flush()
    return ident


def retirar(person, kind, value, usuario=None, reason=None):
    """Da de baja un dato (mal tipeado, ya no es suyo): no se borra, pero ya no sirve para buscar."""
    ident = _identidad(person, kind, value=normalizar(kind, value))
    if ident is None:
        return None
    ident.retired_at = datetime.utcnow()
    if ident.is_primary:
        ident.is_primary = False
        if kind in COLUMNAS and getattr(person, kind) == ident.value:
            setattr(person, kind, None)
    _evento(person, 'baja', kind, ident.value, None, reason, usuario)
    db.session.flush()
    return ident


def fusionar(sobreviviente_uuid, uuids, motivo, usuario=None):
    """Junta varias personas en una: todas sus filas pasan a la que queda, con sus datos (sin pisar sus
    principales) y las demás quedan apuntando a ella (`merged_into_uuid`). Si quedan varios clientes de
    la misma persona, se fusionan también. Hace commit."""
    from app.services.client_dedup_service import ClientDedupService

    sobr = por_uuid(sobreviviente_uuid)
    otros = [p for p in (por_uuid(u) for u in uuids) if p is not None and p.uuid != sobr.uuid]
    if sobr is None or not otros:
        return sobr
    ids = [p.uuid for p in otros]
    db.session.flush()
    for model in TABLAS:
        model.query.filter(model.person_uuid.in_(ids)).update({model.person_uuid: sobr.uuid}, synchronize_session=False)
    # El pagador también; si quedó igual a quien compró, ya no es otra persona.
    FinancialSale.query.filter(FinancialSale.payer_person_uuid.in_(ids)).update(
        {FinancialSale.payer_person_uuid: sobr.uuid}, synchronize_session=False)
    FinancialSale.query.filter(FinancialSale.payer_person_uuid == FinancialSale.person_uuid).update(
        {FinancialSale.payer_person_uuid: None}, synchronize_session=False)
    db.session.expire_all()  # los objetos ya cargados tienen el person_uuid viejo
    propias = {(i.kind, i.value) for i in sobr.identities}
    principales = {i.kind for i in sobr.identities if i.is_primary and i.retired_at is None}
    usos = {(i.kind, i.uso) for i in sobr.identities if i.uso and i.retired_at is None}
    for ident in PersonIdentity.query.filter(PersonIdentity.person_uuid.in_(ids)).order_by(PersonIdentity.id).all():
        if (ident.kind, ident.value) in propias:
            db.session.delete(ident)
            continue
        propias.add((ident.kind, ident.value))
        ident.person_uuid = sobr.uuid
        if ident.is_primary and ident.retired_at is None:
            if ident.kind in principales:
                ident.is_primary = False
            else:
                principales.add(ident.kind)
                if ident.kind in COLUMNAS and not getattr(sobr, ident.kind):
                    setattr(sobr, ident.kind, ident.value)
        if ident.uso and (ident.kind, ident.uso) in usos:
            ident.uso = None
        elif ident.uso:
            usos.add((ident.kind, ident.uso))
    for p in otros:
        p.merged_into_uuid = sobr.uuid
        sobr.full_name = sobr.full_name or p.full_name
        _evento(sobr, 'fusion', None, p.uuid, sobr.uuid, motivo, usuario)
    db.session.flush()
    clientes = Client.query.filter_by(person_uuid=sobr.uuid).all()
    if len(clientes) > 1:
        queda = ClientDedupService._pick_survivor(clientes)
        ClientDedupService.merge_clients(queda.id, [c.id for c in clientes if c.id != queda.id], matched_on='persona')
    db.session.commit()
    return sobr


def cliente_de(person, crear=True):
    """El cliente comercial de la persona (total, baja, objeciones). Mientras se migra, muchos flujos
    todavía lo necesitan. No hace commit."""
    if person is None:
        return None
    client = Client.query.filter_by(person_uuid=person.uuid).order_by(Client.id).first()
    if client is not None or not crear:
        return client
    email = person.email
    if not email or Client.query.filter(func.lower(Client.email) == email).first():
        email = f'no-email-{uuid4().hex[:12]}@neurops.com'
    client = Client(full_name=person.full_name or 'Cliente Nuevo', email=email, phone=person.phone,
                    instagram=person.instagram, person=person,
                    uuid=person.uuid if not Client.query.filter_by(uuid=person.uuid).first() else str(uuid4()))
    db.session.add(client)
    db.session.flush()
    return client


# --- Transición: cada cliente tiene su persona y cada fila con client_id, su person_uuid ---

def _cambio(estado, col):
    return estado.attrs[col].history.has_changes()


def _persona_del_cliente(session, client, nuevo):
    estado = inspect(client)
    cambiadas = [c for c in COLUMNAS_CLIENTE if nuevo or _cambio(estado, c)]
    pares = [(k, v) for k, v in ((c, normalizar(c, getattr(client, c))) for c in cambiadas) if v]
    person = client.person
    if person is None and client.person_uuid:
        person = db.session.get(Person, client.person_uuid)
    if person is None:
        datos_cliente = {c: getattr(client, c) for c in COLUMNAS_CLIENTE}
        person = buscar(client.full_name, **datos_cliente)
        if person is None:
            client.uuid = client.uuid or str(uuid4())
            uso_uuid = client.uuid if db.session.get(Person, client.uuid) is None else str(uuid4())
            person = Person(uuid=uso_uuid, full_name=client.full_name,
                            phone=telefono_crudo(client.phone))
            session.add(person)
        client.person = person
    elif client.full_name and not person.full_name:
        person.full_name = client.full_name
    if pares:
        anotar(person, pares, 'cliente')


def _persona_por_cliente(obj, nuevo):
    if not nuevo and not _cambio(inspect(obj), 'client_id'):
        return
    if obj.person_uuid and nuevo:
        return
    cliente = obj.__dict__.get('client')
    if cliente is not None and cliente.person is not None:
        obj.person = cliente.person
    elif obj.client_id:
        puuid = db.session.query(Client.person_uuid).filter(Client.id == obj.client_id).scalar()
        if puuid:
            obj.person_uuid = puuid


def mantener(session):
    with session.no_autoflush:
        cambiados = [(o, o in session.new) for o in list(session.new) + list(session.dirty)]
        for obj, nuevo in cambiados:
            if isinstance(obj, Client):
                _persona_del_cliente(session, obj, nuevo)
        for obj, nuevo in cambiados:
            if isinstance(obj, CON_CLIENTE):
                _persona_por_cliente(obj, nuevo)


def register_person_tracking(app):
    @event.listens_for(db.session, 'before_flush')
    def _personas_before_flush(session, flush_context, instances):
        try:
            mantener(session)
        except Exception as e:
            # La fila se guarda igual: la persona que faltó la recupera el frente de vinculación.
            logger.error(f'[PERSONA] No se pudo vincular la persona: {e}')
