"""El origen guardado de cada agenda y de cada venta (ADR-W101, 04/11/2026).

La cadena es conversación → agenda → venta → pago → suscripción, con la persona como eje:

  · La agenda guarda de dónde salió: `conversation_id` y su palabra clave (`keyword`, la clave ya
    normalizada) si llegó por Setting, o `workshop_event_id` si llegó por un taller. `atribucion` dice
    cómo se supo:
      - 'link'          el link de agenda que salió de la conversación (Instagram propio; todavía no existe).
      - 'setter'        el anuncio que eligió el setter en «Mis agendas» (`anuncio_id`).
      - 'conversacion'  la regla de Marketing (`anuncios_atribuidor._Atribuidor`): la última palabra clave de
                        la persona hasta la reunión o, si no hay, la primera después.
      - 'legado'        la palabra clave que la agenda ya traía de ManyChat.
      - 'workshop'      el taller: el último `WorkshopEvent` hasta el alta de la agenda (o su reunión, si fue antes).
      - 'ninguna'       no se encontró nada; se vuelve a probar mientras la agenda tenga menos de `DIAS` días.
  · La venta nueva apunta a su agenda (`Sale.appointment_id`): la última de la persona hasta la venta.
  · Renovación y upsell heredan el origen de la primera venta nueva de la persona (`origen_de_venta`).
  · Los pagos y la suscripción ya cuelgan de la venta (`FinancialSale.sale_id`, `Sale.subscription_id`).

Se fija una sola vez, no en cada lectura: `fijar_pendientes` corre cada `MINUTOS` en el scheduler para lo
nuevo (cubre todos los caminos que crean agendas y ventas) y `scripts/backfill_origenes.py` para lo viejo.
"""
from datetime import datetime, timedelta

import pytz
from sqlalchemy import or_

from app import db
from app.models import Appointment, Client, WorkshopEvent
from app.models.marketing import clave_de_palabra, clave_de_reporte
from app.models.sale import Sale
from app.services.anuncios_atribuidor import _Atribuidor
from app.services.anuncios_claves_service import _clave_de_cada_anuncio, _en_tandas, es_keyword_valida
from app.services.comercial_cruces import no_es_marcador
from app.services.fuente_service import es_workshop_landing, es_workshop_vivo
from app.services.identity_service import normalize_ig


MINUTOS = 10
DIAS = 7
# Lo que no se recalcula: lo decidió una persona o salió del link.
FIJAS = ('link', 'setter')
CON_CLAVE = ('link', 'setter', 'conversacion', 'legado')
ZONA_TALLERES = pytz.timezone('America/La_Paz')  # la de `workshop_metrics_service._tz` por defecto
# Una venta cargada al día siguiente de la llamada sigue siendo de esa agenda.
MARGEN_VENTA = timedelta(days=1)


def es_de_workshop(appt):
    return es_workshop_landing(appt.origin) or es_workshop_vivo(appt.origin)


def _dia_local(instante):
    return pytz.UTC.localize(instante).astimezone(ZONA_TALLERES).date()


def taller_de(appt, talleres):
    """El taller que trajo la agenda: el último hasta su alta, o hasta la reunión si ésta fue antes."""
    instantes = [i for i in (appt.created_at, appt.start_time) if i]
    if not instantes:
        return None
    dia = _dia_local(min(instantes))
    previos = [t for t in talleres if t.date <= dia]
    return previos[-1] if previos else None


def fijar_agendas(appts, recalcular=False):
    """Le guarda el origen a cada agenda (sin commit). Con `recalcular`, también a las que ya lo tenían,
    salvo las elegidas a mano o por link."""
    appts = [a for a in appts if a.atribucion not in FIJAS and (recalcular or a.atribucion in (None, 'ninguna'))]
    if not appts:
        return {}
    clave_de_anuncio = _clave_de_cada_anuncio()
    talleres = WorkshopEvent.query.order_by(WorkshopEvent.date).all()
    setting = [a for a in appts if not es_de_workshop(a)]
    clientes = {}
    for tanda in _en_tandas({a.client_id for a in setting if a.client_id}):
        clientes.update({c.id: c for c in Client.query.filter(Client.id.in_(tanda))})

    def ig_de(a):
        c = clientes.get(a.client_id)
        return normalize_ig(c.instagram) if c else None

    def nombre_de(a):
        c = clientes.get(a.client_id)
        return c.full_name if c else None

    atribuidor = _Atribuidor({ig_de(a) for a in setting} - {None}, clave_de_anuncio,
                             {nombre_de(a) for a in setting} - {None}, {a.person_uuid for a in setting} - {None})
    cuenta = {}
    for a in appts:
        if es_de_workshop(a):
            taller = taller_de(a, talleres)
            a.workshop_event_id = taller.id if taller else None
            a.atribucion = 'workshop'
        else:
            conversacion, clave = atribuidor.origen(ig_de(a), a.start_time, nombre_de(a), a.person_uuid)
            elegida = clave_de_anuncio.get(a.anuncio_id) if a.anuncio_id else None
            if elegida:
                clave, a.atribucion = elegida, 'setter'
            elif clave:
                a.atribucion = 'conversacion'
            elif es_keyword_valida(a.keyword):
                clave, a.atribucion = clave_de_palabra(a.keyword), 'legado'
            else:
                a.atribucion = 'ninguna'
            a.conversation_id = conversacion
            if clave and not elegida:  # la del setter ya quedó escrita como la eligió
                a.keyword = clave[:100]
        cuenta[a.atribucion] = cuenta.get(a.atribucion, 0) + 1
    return cuenta


def _agenda_para(venta, agendas):
    """La agenda de la venta: la última reunión hasta la venta (con su margen) o, si no hay, la última alta."""
    hasta = (venta.sold_at or datetime.utcnow()) + MARGEN_VENTA
    reuniones = [a for a in agendas if a.start_time and a.start_time <= hasta]
    if reuniones:
        return max(reuniones, key=lambda a: (a.start_time, a.id))
    altas = [a for a in agendas if a.created_at and a.created_at <= hasta]
    return max(altas, key=lambda a: (a.created_at, a.id)) if altas else None


def fijar_ventas(ventas):
    """Le pone su agenda a cada venta nueva que no la tiene (sin commit). Renovación y upsell no llevan
    agenda propia: heredan el origen (`origen_de_venta`)."""
    ventas = [v for v in ventas if v.appointment_id is None and v.kind == 'new']
    personas = {v.person_uuid for v in ventas if v.person_uuid}
    clientes = {v.client_id for v in ventas if v.client_id and not v.person_uuid}
    de_persona, de_cliente = {}, {}
    for tanda in _en_tandas(personas):
        for a in Appointment.query.filter(Appointment.person_uuid.in_(tanda), no_es_marcador()):
            de_persona.setdefault(a.person_uuid, []).append(a)
    for tanda in _en_tandas(clientes):
        for a in Appointment.query.filter(Appointment.client_id.in_(tanda), no_es_marcador()):
            de_cliente.setdefault(a.client_id, []).append(a)
    puestas = 0
    for v in ventas:
        agendas = de_persona.get(v.person_uuid, []) if v.person_uuid else de_cliente.get(v.client_id, [])
        agenda = _agenda_para(v, agendas)
        if agenda is not None:
            v.appointment_id = agenda.id
            puestas += 1
    return puestas


def origen_de_agenda(appt):
    """{'tipo': 'setting' | 'workshop' | None, 'atribucion', 'clave', 'conversation_id', 'workshop_event_id',
    'taller'} de la agenda, tal como quedó guardado."""
    if appt is None or not appt.atribucion or appt.atribucion == 'ninguna':
        return {'tipo': None, 'atribucion': appt.atribucion if appt else None, 'clave': None,
                'conversation_id': appt.conversation_id if appt else None, 'workshop_event_id': None, 'taller': None}
    taller = db.session.get(WorkshopEvent, appt.workshop_event_id) if appt.workshop_event_id else None
    return {'tipo': 'workshop' if appt.atribucion == 'workshop' else 'setting', 'atribucion': appt.atribucion,
            'clave': appt.keyword if appt.atribucion in CON_CLAVE else None,
            'conversation_id': appt.conversation_id, 'workshop_event_id': appt.workshop_event_id,
            'taller': taller.name if taller else None}


def venta_de_origen(sale):
    """La venta de la que sale el origen: ella misma si es nueva; si es renovación o upsell, la primera
    venta nueva de la persona (o del cliente) que tenga agenda."""
    if sale is None or sale.kind == 'new':
        return sale
    suya = Sale.person_uuid == sale.person_uuid if sale.person_uuid else Sale.client_id == sale.client_id
    if not (sale.person_uuid or sale.client_id):
        return None
    return Sale.query.filter(suya, Sale.kind == 'new', Sale.appointment_id.isnot(None)) \
        .order_by(Sale.sold_at, Sale.id).first()


def origen_de_venta(sale):
    """El origen de la venta (el de `origen_de_agenda`) más `appointment_id` y `venta_origen_id`."""
    origen = venta_de_origen(sale)
    appt = db.session.get(Appointment, origen.appointment_id) if origen and origen.appointment_id else None
    return {**origen_de_agenda(appt), 'appointment_id': appt.id if appt else None,
            'venta_origen_id': origen.id if origen else None}


def clave_guardada(atribucion, keyword, anuncio_id, clave_de_anuncio):
    """La palabra clave guardada de una agenda: la del anuncio elegido si tiene, o la de `keyword`."""
    if atribucion not in CON_CLAVE:
        return None
    return (clave_de_anuncio.get(anuncio_id) if anuncio_id else None) or clave_de_reporte(clave_de_palabra(keyword))


def claves_guardadas(sale_ids, clave_de_anuncio):
    """{sale_id: palabra clave guardada en su agenda} de las ventas nuevas que la tienen."""
    salida = {}
    for tanda in _en_tandas({s for s in sale_ids if s}):
        for sale_id, atribucion, keyword, anuncio_id in db.session.query(
                Sale.id, Appointment.atribucion, Appointment.keyword, Appointment.anuncio_id) \
                .join(Appointment, Appointment.id == Sale.appointment_id) \
                .filter(Sale.id.in_(tanda), Appointment.atribucion.in_(CON_CLAVE)):
            clave = clave_guardada(atribucion, keyword, anuncio_id, clave_de_anuncio)
            if clave:
                salida[sale_id] = clave
    return salida


def fijar_pendientes(dias=DIAS):
    """Lo del scheduler: el origen de las agendas y la agenda de las ventas de los últimos `dias` días."""
    desde = datetime.utcnow() - timedelta(days=dias)
    agendas = Appointment.query.filter(Appointment.created_at >= desde, no_es_marcador(),
                                       or_(Appointment.atribucion.is_(None), Appointment.atribucion == 'ninguna')).all()
    cuenta = fijar_agendas(agendas)
    ventas = Sale.query.filter(Sale.sold_at >= desde, Sale.kind == 'new', Sale.appointment_id.is_(None)).all()
    puestas = fijar_ventas(ventas)
    db.session.commit()
    return {'agendas': cuenta, 'ventas': puestas}
