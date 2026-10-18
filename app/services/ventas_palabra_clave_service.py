"""Las ventas del setter sin palabra clave: la otra mitad de «Mis agendas».

Pedido de Kerwin (17/10/2026): «las ventas de setting sin palabra clave tienen que aparecerle a los
setters junto con sus agendas [...] para que ellos decidan: esta viene de esta palabra clave, esta de
esta. Agrupado por cliente, porque hay distintos pagos de un mismo cliente y todos deberían asociarse
a la misma palabra clave. Eso nos va a permitir medir exactamente los ingresos que vienen de los
anuncios, y de qué anuncio».

**Qué ventas.** Los cobros completados desde `DESDE` cuya fuente es este setter: la regla de la
tarjeta «Ingresos por fuente» y de la nómina (`ComercialService.de_la_fuente_del_setter` sobre
`procedencia_por_venta`). Pendiente es la que Marketing no atribuye a ninguna palabra clave
(`anuncios_service.claves_de_cobros`, la misma regla del tablero): lo que sale de acá es lo que suma en
«Setting sin palabra clave» de Rendimiento.

**Por cliente.** Los cobros se agrupan por el cliente con el que se cruzan (`clientes_de_ventas`); uno
que no se cruza con ninguno es un grupo solo. Un grupo es «pendiente» si alguno de sus cobros no tiene
palabra clave.

**Asignar.** Igual que una agenda (`palabra_clave_service.asignar`): la conversación de ManyChat del
Instagram del cliente (y de los que se escribieron en sus ventas) recibe una respuesta con el anuncio
antes del primer pago y de su primera agenda, así Marketing atribuye TODOS sus pagos a ese anuncio.
"""
from collections import defaultdict
from datetime import datetime, time, timedelta

from app import db
from app.models import Ad, Appointment, Client, FinancialSale, LeadEventLog
from app.services.anuncios_service import anuncio_de_clave, claves_de_cobros
from app.services.comercial_service import ComercialService, clientes_de_ventas, es_agenda_del_setter, venta_completada
from app.services.palabra_clave_service import (
    ACCION, DESDE, ErrorDePalabraClave, _texto_del_registro, anuncio_de_palabra, normalizar_ig, responder_con_anuncio,
)


def _grupo(cobro, cliente_de):
    cid = cliente_de.get(cobro.id)
    return f'c{cid}' if cid else f'v{cobro.id}'


def _del_setter(setter):
    """(cobros del setter, {id: client_id}, {id: palabra clave o None})."""
    from app.services.procedencia_ingresos_service import procedencia_por_venta

    desde = datetime.combine(DESDE, time.min)
    cobros = [v for v in FinancialSale.query.filter(FinancialSale.date >= desde).all() if venta_completada(v)]
    mios = ComercialService.de_la_fuente_del_setter(setter.username, procedencia_por_venta(cobros))
    suyos = [c for c in cobros if c.id in mios]
    cliente_de = clientes_de_ventas(suyos)
    return suyos, cliente_de, claves_de_cobros(suyos, cliente_de=cliente_de)


def _nombre_de_clave(clave, cache):
    if clave not in cache:
        anuncio = anuncio_de_clave(clave) if clave else None
        cache[clave] = ((anuncio.keyword or anuncio.name) if anuncio else clave) if clave else None
    return cache[clave]


def ventas(setter):
    """{'pendientes': [...], 'completadas': [...], 'resumen': {'clientes', 'monto'}}: un grupo por
    cliente, los más recientes primero, cada uno con sus pagos y la palabra clave de cada pago."""
    suyos, cliente_de, claves = _del_setter(setter)
    grupos = defaultdict(list)
    for cobro in suyos:
        grupos[_grupo(cobro, cliente_de)].append(cobro)
    ids = {cliente_de[c.id] for c in suyos if cliente_de.get(c.id)}
    clientes = {c.id: c for c in Client.query.filter(Client.id.in_(ids)).all()} if ids else {}

    nombres, pendientes, completadas = {}, [], []
    for grupo, pagos in grupos.items():
        pagos.sort(key=lambda p: (p.date or datetime.min, p.id))
        cliente = clientes.get(cliente_de.get(pagos[0].id))
        instagram = (normalizar_ig(cliente.instagram) if cliente else None) or next(
            (ig for ig in (normalizar_ig(p.instagram) for p in pagos) if ig), None)
        filas = [{
            'id': p.id,
            'fecha': p.date.isoformat() if p.date else None,
            'tipo': (p.tipo_pago or '').strip() or None,
            'programa': ComercialService.clasificar_venta(p)[0],
            'monto': round(float(p.monto or 0), 2),
            'palabra_clave': _nombre_de_clave(claves.get(p.id), nombres),
        } for p in pagos]
        fila = {
            'grupo': grupo,
            'client_id': cliente.id if cliente else None,
            'cliente': (cliente.full_name if cliente else None) or pagos[0].nombre_cliente or 'Sin nombre',
            'instagram': instagram,
            'total': round(sum(f['monto'] for f in filas), 2),
            'primera': filas[0]['fecha'],
            'ultima': filas[-1]['fecha'],
            'pagos': filas,
            'palabras': sorted({f['palabra_clave'] for f in filas if f['palabra_clave']}),
        }
        (completadas if all(f['palabra_clave'] for f in filas) else pendientes).append(fila)

    for lista in (pendientes, completadas):
        lista.sort(key=lambda f: f['ultima'] or '', reverse=True)
    monto = round(sum(f['monto'] for g in pendientes for f in g['pagos'] if not f['palabra_clave']), 2)
    return {'pendientes': pendientes, 'completadas': completadas,
            'resumen': {'clientes': len(pendientes), 'monto': monto}}


def asignar(setter, grupo, ad_id=None, palabra=None, instagram=None):
    """Le pone a TODOS los pagos de ese cliente el anuncio por el que llegó. Hace commit."""
    suyos, cliente_de, _ = _del_setter(setter)
    pagos = [c for c in suyos if _grupo(c, cliente_de) == grupo]
    if not pagos:
        raise ErrorDePalabraClave('Estas ventas no son tuyas.', 403)
    if ad_id:
        anuncio = db.session.get(Ad, ad_id)
        if not anuncio:
            raise ErrorDePalabraClave('Ese anuncio no existe: elegilo de la lista.', 404)
    elif palabra is not None:
        anuncio = anuncio_de_palabra(palabra)
    else:
        raise ErrorDePalabraClave('Elegí el anuncio de la lista o escribí la palabra clave.')

    cid = cliente_de.get(pagos[0].id)
    cliente = db.session.get(Client, cid) if cid else None
    nuevo = normalizar_ig(instagram) if instagram is not None else None
    if instagram is not None and (instagram or '').strip() and not nuevo:
        raise ErrorDePalabraClave('Ese Instagram no parece un usuario: escribilo sin espacios ni links.')
    igs = []
    for ig in [nuevo, normalizar_ig(cliente.instagram) if cliente else None, *(normalizar_ig(p.instagram) for p in pagos)]:
        if ig and ig not in igs:
            igs.append(ig)
    if not igs:
        raise ErrorDePalabraClave('Falta el Instagram del cliente: es con lo que Marketing encuentra su conversación.')
    if cliente and nuevo and not normalizar_ig(cliente.instagram):
        cliente.instagram = nuevo

    # La respuesta va antes del primer pago y de su primera agenda: así cuenta para todo lo suyo.
    primero = min(p.date for p in pagos if p.date)
    agendas = Appointment.query.filter(Appointment.client_id == cid).all() if cid else []
    momentos = [primero] + [m for a in agendas for m in (a.start_time, a.created_at) if m]
    antes_de_todo = min(momentos) - timedelta(minutes=1)
    nombre = (cliente.full_name if cliente else None) or pagos[0].nombre_cliente
    for ig in igs:
        responder_con_anuncio(ig, f'manual_venta_{grupo}', nombre, anuncio, primero, antes_de_todo)

    palabra_final = anuncio.keyword or anuncio.name
    suyas = Appointment.query.filter(Appointment.client_id == cid, es_agenda_del_setter(setter.id)).all() if cid else []
    for a in suyas:
        if not a.keyword:
            a.keyword = palabra_final
    if agendas:
        primera = min(agendas, key=lambda a: a.created_at or datetime.max)
        db.session.add(LeadEventLog(appointment_id=primera.id, user_id=setter.id, action_type=ACCION,
                                    description=f'{_texto_del_registro(anuncio, setter)} (ventas)',
                                    created_at=datetime.utcnow()))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise ErrorDePalabraClave('No se pudo guardar: probá de nuevo.', 500) from None
    return {'grupo': grupo, 'instagram': igs[0], 'pagos': len(pagos),
            'anuncio': {'id': anuncio.id, 'keyword': palabra_final}}
