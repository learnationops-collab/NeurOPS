"""Los avisos al equipo: una sola puerta, `avisar` (docs/plan_notas_avisos_settings.md §2.2 y §2.3).

Un aviso es una fila de `notifications` con su destinatario como `target_type` + `target`: 'user' (id),
'rol' (nombre del rol) o 'grupo' (lista de ids). Quién lo leyó va en `read_by`.

`TIPOS` es el catálogo: el rótulo, los canales por defecto y si es obligatorio. Cada usuario elige sus
canales por tipo en su configuración (`user_settings`, clave 'avisos'); lo obligatorio no se apaga.
Por ahora el único canal es la campanita ('centro'); WhatsApp y Discord entran en las etapas 3 y 4.
"""
from sqlalchemy.orm.attributes import flag_modified

from app import db
from app.models import Notification

TIPOS = {
    'nota': {'rotulo': 'Notas sobre tus leads', 'canales': ['centro'], 'obligatorio': False},
}
TARGETS = ('user', 'rol', 'grupo')


def canales_de(user_id, tipo):
    from app.services import user_settings_service

    catalogo = TIPOS[tipo]
    if catalogo['obligatorio']:
        return list(catalogo['canales'])
    elegidos = (user_settings_service.leer(user_id, 'avisos') or {}).get(tipo)
    return list(catalogo['canales'] if elegidos is None else elegidos)


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
    aviso = Notification(tipo=tipo, target_type=target_type, target=target, subject=asunto[:100],
                         content=descripcion or '', associated_type=origen, associated_id=origen_id,
                         person_uuid=person_uuid, payload=payload, read_by=[])
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


def sin_leer(usuario, tipo=None):
    """Los avisos sin leer de este usuario (de los tipos que no apagó)."""
    q = Notification.query.filter(Notification.target_type.isnot(None))
    if tipo:
        q = q.filter(Notification.tipo == tipo)
    return [a for a in q.all()
            if _es_para(a, usuario) and usuario.id not in (a.read_by or [])
            and 'centro' in canales_de(usuario.id, a.tipo)]


def marcar_leidos(usuario, person_uuid, tipo='nota'):
    """Marca como leídos los avisos de ese tipo sobre esa persona (al abrir su ficha). Hace commit."""
    if not person_uuid:
        return
    cambio = False
    for a in sin_leer(usuario, tipo):
        if a.person_uuid == person_uuid:
            a.read_by = [*(a.read_by or []), usuario.id]
            flag_modified(a, 'read_by')
            cambio = True
    if cambio:
        db.session.commit()


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
    avisos = Notification.query.filter(Notification.associated_type == 'log',
                                       Notification.associated_id.in_(log_ids)).all()
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
        salida.setdefault(a.associated_id, []).extend(quienes)
    return salida
