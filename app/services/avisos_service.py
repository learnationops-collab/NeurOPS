"""Los avisos al equipo: una sola puerta, `avisar` (docs/plan_notas_avisos_settings.md §2.2 y §2.3).

Un aviso es una fila de `notifications` con su destinatario como `target_type` + `target`: 'user' (id),
'rol' (nombre del rol) o 'grupo' (lista de ids). Quién lo leyó va en `leido_por`.

`TIPOS` es el catálogo: el rótulo, los canales por defecto y si es obligatorio. Cada usuario elige sus
canales por tipo en su configuración (`user_settings`, clave 'avisos'); lo obligatorio no se apaga.
Por ahora el único canal es la campanita ('centro'); WhatsApp entra en la etapa 4. Los avisos a los
canales de Discord (agenda nueva, reporte del setter) no son avisos a una persona: siguen aparte.
"""
from datetime import datetime, timedelta

from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import Notification

TIPOS = {
    'nota': {'rotulo': 'Notas sobre tus leads', 'canales': ['centro'], 'obligatorio': False},
    'aviso': {'rotulo': 'Avisos de un compañero', 'canales': ['centro'], 'obligatorio': False},
    'agenda_nueva': {'rotulo': 'Agenda nueva', 'canales': ['centro'], 'obligatorio': True},
    'agenda_reprogramada': {'rotulo': 'Agenda reprogramada', 'canales': ['centro'], 'obligatorio': True},
    'sesion_adicional': {'rotulo': 'Sesión adicional de un lead que ya tenía agenda', 'canales': ['centro'],
                         'obligatorio': True},
    'momentum_nueva': {'rotulo': 'Momentum nueva', 'canales': ['centro'], 'obligatorio': False},
    'agenda_sin_evento': {'rotulo': 'Agenda sin evento de Google Calendar', 'canales': ['centro'],
                          'obligatorio': True},
    'google_desconectado': {'rotulo': 'Google Calendar desconectado', 'canales': ['centro'], 'obligatorio': True},
    'closer_sin_resolver': {'rotulo': 'Agenda con un closer que no existe', 'canales': ['centro'],
                            'obligatorio': False},
}
TARGETS = ('user', 'rol', 'grupo')
# Lo que la campanita mira hacia atrás: un aviso de hace más de tres meses ya no se va a leer.
VENTANA = timedelta(days=90)


def canales_de(user_id, tipo):
    from app.services import user_settings_service

    catalogo = TIPOS[tipo]
    if catalogo['obligatorio']:
        return list(catalogo['canales'])
    elegidos = (user_settings_service.leer(user_id, 'avisos') or {}).get(tipo)
    return list(catalogo['canales'] if elegidos is None else elegidos)


def destino(roles=(), ids=()):
    """(target_type, target) para «estos roles y estas personas»: un solo rol o una sola persona van como
    tales; una mezcla se resuelve a la lista de ids de hoy ('grupo')."""
    from app.models import User

    ids = sorted({int(i) for i in ids if i is not None})
    if not ids and len(roles) == 1:
        return 'rol', roles[0]
    if len(ids) == 1 and not roles:
        return 'user', ids[0]
    if roles:
        ids = sorted(set(ids) | {u.id for u in User.query.filter_by(is_active=True)
                                 if any(u.tiene_rol(r) for r in roles)})
    return 'grupo', ids


def avisar(tipo, target_type, target, asunto, descripcion='', origen=None, origen_id=None,
           person_uuid=None, payload=None):
    """Crea el aviso (sin commit: va en la transacción de quien avisa). Un aviso a una sola persona que
    apagó la campanita para ese tipo no se guarda; a un rol o grupo se filtra al leer."""
    if tipo not in TIPOS:
        raise KeyError(f'Tipo de aviso desconocido: {tipo}')
    if target_type not in TARGETS:
        raise ValueError(f'Destinatario desconocido: {target_type}')
    if target_type == 'user' and 'centro' not in canales_de(int(target), tipo):
        return None
    aviso = Notification(tipo=tipo, target_type=target_type, target=target, asunto=asunto[:100],
                         descripcion=descripcion or '', origen=origen, origen_id=origen_id,
                         person_uuid=person_uuid, payload=payload, leido_por=[])
    db.session.add(aviso)
    return aviso


def _es_para(aviso, usuario):
    if aviso.target_type == 'user':
        return str(aviso.target) == str(usuario.id)
    if aviso.target_type == 'rol':
        return usuario.tiene_rol(aviso.target) and (not usuario.created_at or aviso.created_at >= usuario.created_at)
    if aviso.target_type == 'grupo':
        return usuario.id in [int(x) for x in (aviso.target or [])]
    return False


def de(usuario, tipo=None, desde=None):
    """Los avisos de este usuario (de los tipos que no apagó), del más nuevo al más viejo."""
    q = Notification.query.filter(Notification.target_type.isnot(None))
    if tipo:
        q = q.filter(Notification.tipo == tipo)
    q = q.filter(Notification.created_at >= (desde or datetime.utcnow() - VENTANA))
    return [a for a in q.order_by(Notification.created_at.desc()).all()
            if a.tipo in TIPOS and _es_para(a, usuario) and 'centro' in canales_de(usuario.id, a.tipo)]


def leido(aviso, usuario):
    return usuario.id in (aviso.leido_por or [])


def sin_leer(usuario, tipo=None):
    return [a for a in de(usuario, tipo) if not leido(a, usuario)]


def marcar(avisos, usuario):
    """Marca como leídos esos avisos para este usuario. Hace commit."""
    cambio = False
    for a in avisos:
        if not leido(a, usuario):
            a.leido_por = [*(a.leido_por or []), usuario.id]
            flag_modified(a, 'leido_por')
            cambio = True
    if cambio:
        db.session.commit()


def a_dict(aviso, usuario):
    return {'id': aviso.id, 'tipo': aviso.tipo, 'rotulo': TIPOS[aviso.tipo]['rotulo'], 'asunto': aviso.asunto,
            'descripcion': aviso.descripcion, 'origen': aviso.origen, 'origen_id': aviso.origen_id,
            'person_uuid': aviso.person_uuid, 'payload': aviso.payload, 'leido': leido(aviso, usuario),
            'created_at': aviso.created_at.isoformat() + 'Z' if aviso.created_at else None}


def marcar_leidos(usuario, person_uuid, tipo='nota'):
    """Marca como leídos los avisos de ese tipo sobre esa persona (al abrir su ficha). Hace commit."""
    if person_uuid:
        marcar([a for a in sin_leer(usuario, tipo) if a.person_uuid == person_uuid], usuario)


def personas_con_notas_sin_leer(usuario):
    """Los `person_uuid` con notas sin leer: el punto del mazo."""
    return {a.person_uuid for a in sin_leer(usuario, 'nota') if a.person_uuid}


def clientes_con_notas_sin_leer(usuario):
    """Los ids de cliente con notas sin leer, para las pantallas que todavía marcan por cliente."""
    from app.models import Client

    personas = personas_con_notas_sin_leer(usuario)
    if not personas:
        return set()
    return {c.id for c in Client.query.filter(Client.person_uuid.in_(personas)).with_entities(Client.id)}


def destinatarios_de_log(log_ids):
    """{id de la entrada del log: [nombres de a quién se le avisó]}, para el «notificados» del hilo."""
    from app.models import User

    if not log_ids:
        return {}
    avisos = Notification.query.filter(Notification.origen == 'log', Notification.origen_id.in_(log_ids)).all()
    ids = set()
    for a in avisos:
        if a.target_type == 'user':
            ids.add(int(a.target))
        elif a.target_type == 'grupo':
            ids |= {int(x) for x in a.target or []}
    nombres = {u.id: u.username for u in User.query.filter(User.id.in_(ids))} if ids else {}
    salida = {}
    for a in avisos:
        if a.target_type == 'rol':
            quienes = [f'{a.target}s']
        else:
            quienes = [nombres[int(i)] for i in ([int(a.target)] if a.target_type == 'user' else a.target or [])
                       if int(i) in nombres]
        salida.setdefault(a.origen_id, []).extend(quienes)
    return salida
