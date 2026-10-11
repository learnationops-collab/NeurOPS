"""La palabra clave de cada agenda del setter: la bandeja de «Mis agendas».

Pedido de Kerwin (10/10/2026): "estas agendas son las que llegaron con fuente de ese setter, y los
setters deben agregar la palabra clave del anuncio por el que llegó el lead [...] 'Mis agendas'
debe vaciarse para completar el proceso de asignación de palabra clave".

**Qué agendas.** Las del setter (`comercial_service.es_agenda_del_setter`, la misma regla que sus
números) creadas desde `DESDE`, una por persona como en "Agendas generadas"
(`ComercialService.generadas`): es literalmente esa tabla, sin las que ya tienen anuncio.

**Qué es tener palabra clave.** La regla con la que Marketing reparte las agendas entre los
anuncios (`MarketingService`, punto 4, y la bandeja «Sin anuncio» de `/public/marketing`): el
Instagram del lead lleva a su conversación de ManyChat (`ManychatLead`) y ésta a una respuesta con
anuncio (`LeadAnswer.ad_id`) de antes de la reunión. Así la agenda que sale de la bandeja es la que
Marketing ya cuenta para ese anuncio, y la bandeja no puede vaciarse con agendas que Marketing
sigue viendo sin atribuir. `Appointment.keyword` NO alcanza: Marketing no lo lee; se escribe igual
al asignar (lo muestran el mazo y la ficha) y, si ya estaba, sirve de sugerencia.

**Por qué hace falta el Instagram.** Es lo único con lo que Marketing encuentra la conversación de
la agenda (el respaldo por nombre de `MarketingService` compara contra la FUENTE de la agenda, no
contra el lead, así que no encuentra a nadie). Sin Instagram no hay atribución posible: la tarjeta
lo pide solo cuando falta.

**Desde cuándo.** `DESDE` es julio de 2026, cuando ManyChat empezó a guardar el anuncio de cada
conversación (la primera `LeadAnswer` es de ese mes; antes no hay ninguna). Una agenda anterior no
tiene contra qué atribuirse ni un reporte de Marketing que la cuente: pedirla solo haría la bandeja
imposible de vaciar.

**Por mes (11/10/2026).** Kerwin: «Tenés 149 pendientes, es una banda: estaría bueno el filtro de
este mes, que te llenen este mes y luego el mes pasado, y que le vayamos pidiendo de a poquito». El
resumen trae la bandeja partida por el mes en que se CREÓ cada agenda (la fecha con que cuentan las
«Agendas generadas»), del mes actual al primero, y la pantalla muestra un mes por vez.
"""
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta
import uuid

import pytz
from sqlalchemy import func

from app import db
from app.models import Ad, Appointment, LeadEventLog, ManychatLead, LeadAnswer
from app.services.comercial_service import ComercialService, es_agenda_del_setter
from app.services.user_time_service import hoy_del_usuario, limites_dia_utc, zona_del_usuario

DESDE = date(2026, 7, 1)

# El `action_type` del registro que deja cada asignación en el historial del lead. Es también con lo
# que se cuentan las de hoy y la racha: no hay columna nueva.
ACCION = 'palabra_clave'

# El `keyword` de la respuesta que se crea cuando la conversación no tenía ninguna para marcar: la
# misma marca que dejaba la atribución manual de Marketing, para distinguirla de las de ManyChat.
KEYWORD_MANUAL = 'manual_attribution'


class ErrorDePalabraClave(ValueError):
    """La asignación no se puede hacer; `estado` es el código HTTP que corresponde."""

    def __init__(self, mensaje, estado=400):
        super().__init__(mensaje)
        self.estado = estado


def normalizar_ig(valor):
    """El usuario de Instagram sin @, en minúsculas, o None si no hay uno de verdad."""
    if not isinstance(valor, str):
        return None
    limpio = valor.strip().lstrip('@').strip().lower()
    if not limpio or limpio in ('n/a', 'none', 'null', '-'):
        return None
    if '/' in limpio or ' ' in limpio:
        return None
    return limpio


def _instante(iso):
    return datetime.fromisoformat(iso) if iso else None


# --- Lectura ------------------------------------------------------------------------------------

def _agendas(setter):
    """Las agendas del setter desde `DESDE`, una por persona: las filas de "Agendas generadas"."""
    # Hasta mañana: el `created_at` está en UTC y el día del servidor puede ir detrás del de la base.
    return ComercialService.generadas(DESDE, date.today() + timedelta(days=1), setter_id=setter.id)


def _anuncio_de_cada_una(filas):
    """{id de la agenda: id del anuncio} para las que ya tienen uno, con la regla de Marketing.

    En tres consultas para toda la bandeja (conversaciones, respuestas con anuncio) en vez de dos
    por agenda: la lista de un setter son cientos de filas.
    """
    igs = {normalizar_ig(f['ig']) for f in filas} - {None}
    if not igs:
        return {}
    ig_columna = func.lower(func.replace(ManychatLead.ig, '@', ''))
    leads = db.session.query(ManychatLead.id, ig_columna).filter(ig_columna.in_(igs)).all()
    leads_por_ig = defaultdict(list)
    for lead_id, ig in leads:
        leads_por_ig[(ig or '').strip()].append(lead_id)
    respuestas = defaultdict(list)
    if leads:
        for lead_id, ad_id, creada in db.session.query(
                LeadAnswer.lead_id, LeadAnswer.ad_id, LeadAnswer.created_at).filter(
                LeadAnswer.lead_id.in_([lid for lid, _ in leads]), LeadAnswer.ad_id.isnot(None)):
            respuestas[lead_id].append((creada, ad_id))

    anuncio = {}
    for f in filas:
        reunion = _instante(f['fecha'])
        candidatas = [(creada, ad_id)
                      for lead_id in leads_por_ig.get(normalizar_ig(f['ig']) or '', [])
                      for creada, ad_id in respuestas[lead_id]
                      if creada and (reunion is None or creada <= reunion)]
        if candidatas:
            # La más cercana a la reunión, como Marketing: es el anuncio por el que llegó esa vez.
            anuncio[f['id']] = max(candidatas)[1]
    return anuncio


def mes_de(fila):
    """'2026-10': el mes en que se creó la agenda, en la misma fecha (UTC) con que la cuentan las
    «Agendas generadas». None si no se sabe."""
    return (fila.get('creada') or '')[:7] or None


def _siguiente_mes_atras(anio, mes):
    return (anio - 1, 12) if mes == 1 else (anio, mes - 1)


def por_mes(setter, pend, filas):
    """La bandeja por mes de creación, del más nuevo al más viejo: `[{mes, pendientes, total}]`.

    Arranca en el mes actual del setter aunque no tenga ninguna (el mes en curso siempre está, es
    donde abre la pantalla) y llega hasta `DESDE`. `total` son todas sus agendas de ese mes, con o
    sin anuncio: un mes con `pendientes` en 0 está completo.
    """
    total = Counter(m for m in map(mes_de, filas) if m)
    faltan = Counter(m for m in map(mes_de, pend) if m)
    hoy = hoy_del_usuario(setter)
    anio, mes = max([(hoy.year, hoy.month)] + [(int(m[:4]), int(m[5:7])) for m in total])
    salida = []
    while (anio, mes) >= (DESDE.year, DESDE.month):
        clave = f'{anio:04d}-{mes:02d}'
        salida.append({'mes': clave, 'pendientes': faltan.get(clave, 0), 'total': total.get(clave, 0)})
        anio, mes = _siguiente_mes_atras(anio, mes)
    return salida


def _estado(fila):
    """El chip de la agenda: su post call si la llamada ya tiene resultado, si no el pre call."""
    post = fila.get('post_call') or {}
    return post if post.get('key') not in (None, 'pendiente') else (fila.get('pre_call') or post)


def _bandeja(setter):
    """(pendientes, filas, anuncio por agenda): lo que lee todo lo de abajo de una sola pasada."""
    filas = _agendas(setter)
    anuncio = _anuncio_de_cada_una(filas)
    pendientes = [f for f in filas if f['id'] not in anuncio]
    return pendientes, filas, anuncio


def pendientes(setter):
    """La bandeja: las agendas del setter que todavía no tienen anuncio, las más nuevas primero."""
    pend, _filas, _anuncio = _bandeja(setter)
    return _serializar(pend)


def _serializar(filas):
    ids = [f['id'] for f in filas]
    citas = {a.id: a for a in Appointment.query.filter(Appointment.id.in_(ids)).all()} if ids else {}
    sugerido = _anuncios_por_keyword({(c.keyword or '').strip() for c in citas.values()} - {''})
    salida = []
    for f in sorted(filas, key=lambda x: (x['creada'] or '', x['id']), reverse=True):
        cita = citas.get(f['id'])
        salida.append({
            'id': f['id'],
            'client_id': f['client_id'],
            'cliente': f['cliente'],
            'instagram': normalizar_ig(f['ig']),
            'telefono': f['telefono'] or '',
            'reunion': f['fecha'],
            'creada': f['creada'],
            'mes': mes_de(f),
            'closer': f['closer'],
            'canal': _canal(cita),
            'estado': _estado(f),
            # El anuncio que ya decía la cita (`keyword`) pero que Marketing no ve: la tarjeta lo
            # ofrece primero.
            'sugerido': sugerido.get((cita.keyword or '').strip()) if cita else None,
        })
    return salida


def _anuncios_por_keyword(keywords):
    if not keywords:
        return {}
    return {a.keyword: a.id for a in Ad.query.filter(Ad.keyword.in_(keywords)).all()}


def _canal(cita):
    """Por dónde reservó el lead, cuando se sabe: el link de Agendas 2.0 o una carga a mano."""
    if not cita:
        return None
    if cita.agenda_payload:
        payload = cita.agenda_payload or {}
        return payload.get('funnel_nombre') or payload.get('funnel') or 'Link de agendas'
    origen = (cita.origin or '').strip().lower()
    if origen.startswith('manual'):
        return 'Cargada a mano'
    if origen.startswith('manychat'):
        return 'ManyChat'
    return None


def anuncios(setter, filas=None, anuncio=None):
    """Los anuncios para el buscador, en un orden que sirva: los activos primero; entre ellos, los
    que este setter más usó (sus agendas atribuidas a cada uno) y después los más nuevos."""
    if filas is None:
        _pend, filas, anuncio = _bandeja(setter)
    usos = Counter((anuncio or {}).values())
    todos = [a for a in Ad.query.all() if (a.keyword or a.name)]
    todos.sort(key=lambda a: ((a.status or '').lower() != 'active', -usos.get(a.id, 0),
                              -(a.created_at.timestamp() if a.created_at else 0), a.id))
    return [{'id': a.id, 'keyword': a.keyword or a.name, 'nombre': a.name or a.keyword,
             'activo': (a.status or '').lower() == 'active', 'usos': usos.get(a.id, 0)}
            for a in todos]


# --- El juego: hoy y la racha -------------------------------------------------------------------

def _dia_local(instante, tz):
    return pytz.UTC.localize(instante).astimezone(tz).date()


def resumen(setter, bandeja=None):
    """Lo que se festeja: cuántas quedan, cuántas asignó hoy y la racha de días con la bandeja vacía.
    Y la bandeja por mes (`meses`, ver `por_mes`) con el mes actual del setter (`mes_actual`): de ahí
    sale el mes que se trabaja y la marca del dock.

    La racha no se guarda: se reconstruye con lo que ya hay. Una agenda estuvo pendiente desde el
    día en que se creó hasta el día de su asignación (el registro `palabra_clave` de su historial);
    las que Marketing atribuyó solas nunca estuvieron. Un día cuenta si terminó sin ninguna
    pendiente, y la cuenta va hacia atrás desde hoy (o desde ayer si hoy todavía quedan: el día
    sigue en juego) y no pasa del primer día en que el setter asignó una: antes la bandeja no
    existía, y contar esos días sería inventar.
    """
    pend, filas, anuncio = bandeja or _bandeja(setter)
    tz = zona_del_usuario(setter)
    hoy = hoy_del_usuario(setter)
    inicio, fin = limites_dia_utc(setter, hoy)

    mias = LeadEventLog.query.filter(LeadEventLog.user_id == setter.id, LeadEventLog.action_type == ACCION)
    hoy_hechas = mias.filter(LeadEventLog.created_at.between(inicio, fin)).count()
    primera = mias.order_by(LeadEventLog.created_at.asc()).first()

    racha = 0
    if primera:
        ids = [f['id'] for f in filas]
        asignada = {}
        if ids:
            for appt_id, cuando in db.session.query(LeadEventLog.appointment_id, func.min(LeadEventLog.created_at)) \
                    .filter(LeadEventLog.action_type == ACCION, LeadEventLog.appointment_id.in_(ids)) \
                    .group_by(LeadEventLog.appointment_id):
                asignada[appt_id] = _dia_local(cuando, tz)
        pendientes_ids = {f['id'] for f in pend}
        # (desde, hasta): los días en que cada agenda estuvo pendiente al cerrar el día.
        tramos = []
        for f in filas:
            creada = _instante(f['creada'])
            if not creada:
                continue
            desde = _dia_local(creada, tz)
            if f['id'] in pendientes_ids:
                tramos.append((desde, None))
            elif f['id'] in asignada:
                tramos.append((desde, asignada[f['id']] - timedelta(days=1)))
            # Atribuida por ManyChat sin que nadie la tocara: nunca estuvo en la bandeja.

        def vacia(dia):
            return not any(desde <= dia and (hasta is None or dia <= hasta) for desde, hasta in tramos)

        dia = hoy if not pend else hoy - timedelta(days=1)
        tope = _dia_local(primera.created_at, tz)
        while dia >= tope and vacia(dia):
            racha += 1
            dia -= timedelta(days=1)

    return {'pendientes': len(pend), 'hoy': hoy_hechas, 'racha': racha,
            'mes_actual': f'{hoy.year:04d}-{hoy.month:02d}', 'meses': por_mes(setter, pend, filas)}


def bandeja(setter):
    """Todo lo que la pantalla necesita en un pedido: la lista, los anuncios y el resumen."""
    datos = _bandeja(setter)
    pend, filas, anuncio = datos
    return {'pendientes': _serializar(pend), 'anuncios': anuncios(setter, filas, anuncio),
            'resumen': resumen(setter, datos)}


# --- Escritura ----------------------------------------------------------------------------------

def asignar(setter, appointment_id, ad_id, instagram=None):
    """Le pone a la agenda el anuncio por el que llegó el lead, de forma que Marketing la cuente.

    Deja lo mismo que la atribución manual de siempre (`/public/marketing/manual-attribution-agenda`),
    con tres correcciones:

      · la respuesta con anuncio queda ANTES de la primera agenda de esa persona con este setter, no
        un minuto antes de la reunión de la que se tocó: si no, una persona que reagendó quedaba con
        la agenda nueva atribuida y la vieja sin anuncio;
      · si la conversación ya tenía una respuesta sin anuncio de antes de la reunión (llegó por
        ManyChat y no se supo de qué anuncio), se le pone el anuncio a esa, que es la de verdad, en
        vez de pisarle la fecha a la primera que hubiera;
      · la conversación que se crea lleva el nombre del lead, no el de la fuente (el setter).

    El Instagram es obligatorio porque es con lo que Marketing encuentra la conversación (ver el
    docstring del módulo): si viene uno nuevo, se corrige en el cliente y en la fila del Tablero.
    Deja un registro `palabra_clave` en el historial del lead. Hace commit.
    """
    from app.services.ficha_agendas_service import espejo_en_el_tablero

    cita = Appointment.query.filter(Appointment.id == appointment_id, es_agenda_del_setter(setter.id)).first()
    if not cita:
        raise ErrorDePalabraClave('Esta agenda no es tuya.', 403)
    anuncio = db.session.get(Ad, ad_id) if ad_id else None
    if not anuncio:
        raise ErrorDePalabraClave('Ese anuncio no existe: elegilo de la lista.', 404)

    cliente = cita.client
    espejo = espejo_en_el_tablero(cita)
    nuevo = normalizar_ig(instagram) if instagram is not None else None
    if instagram is not None and (instagram or '').strip() and not nuevo:
        raise ErrorDePalabraClave('Ese Instagram no parece un usuario: escribilo sin espacios ni links.')
    # Marketing lee el de la fila del Tablero: ése manda sobre el del cliente.
    ig = nuevo or normalizar_ig(espejo.instagram if espejo else None) \
        or normalizar_ig(cliente.instagram if cliente else None)
    if not ig:
        raise ErrorDePalabraClave('Falta el Instagram del lead: es con lo que Marketing encuentra su conversación.')
    # El que se usó queda donde falte (o donde se corrigió): una fila del Tablero sin Instagram es
    # una agenda que Marketing no puede atribuir aunque la conversación tenga el anuncio.
    if cliente and (nuevo or not normalizar_ig(cliente.instagram)) and normalizar_ig(cliente.instagram) != ig:
        cliente.instagram = ig
    if espejo and (nuevo or not normalizar_ig(espejo.instagram)) and normalizar_ig(espejo.instagram) != ig:
        espejo.instagram = f'@{ig}'

    # Todas las agendas de esta persona con este setter: la respuesta va antes de la primera.
    suyas = Appointment.query.filter(es_agenda_del_setter(setter.id),
                                     Appointment.client_id == cita.client_id).all() if cita.client_id else [cita]
    momentos = [m for a in suyas for m in (a.start_time, a.created_at) if m]
    antes_de_todo = min(momentos) - timedelta(minutes=1) if momentos else datetime.utcnow()
    tope = min((a.start_time for a in suyas if a.start_time), default=None)

    conversacion = ManychatLead.query.filter(
        func.lower(func.replace(ManychatLead.ig, '@', '')) == ig).first()
    if not conversacion:
        conversacion = ManychatLead(manychat_id=f'manual_agenda_{cita.id}_{uuid.uuid4().hex[:6]}',
                                    name=(cliente.full_name if cliente else None) or 'Sin nombre',
                                    ig=f'@{ig}', follower=False)
        db.session.add(conversacion)
        db.session.flush()

    sin_anuncio = LeadAnswer.query.filter(LeadAnswer.lead_id == conversacion.id, LeadAnswer.ad_id.is_(None))
    if tope:
        sin_anuncio = sin_anuncio.filter(LeadAnswer.created_at <= tope)
    respuesta = sin_anuncio.order_by(LeadAnswer.created_at.desc()).first()
    if respuesta:
        respuesta.ad_id = anuncio.id
    else:
        db.session.add(LeadAnswer(lead_id=conversacion.id, ad_id=anuncio.id, keyword=KEYWORD_MANUAL,
                                  qualification='true', created_at=antes_de_todo, updated_at=antes_de_todo))

    for a in suyas:
        a.keyword = anuncio.keyword or anuncio.name

    db.session.add(LeadEventLog(appointment_id=cita.id, user_id=setter.id, action_type=ACCION,
                                description=_texto_del_registro(anuncio, setter),
                                created_at=datetime.utcnow()))
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise ErrorDePalabraClave('No se pudo guardar: probá de nuevo.', 500) from None
    return {'appointment_id': cita.id, 'instagram': ig,
            'anuncio': {'id': anuncio.id, 'keyword': anuncio.keyword or anuncio.name}}


def _texto_del_registro(anuncio, setter):
    """Lo que dice el historial del lead. Simulando, quién lo hizo de verdad: el mismo sufijo que
    `BookingService.log_lead_event`, que no se usa porque hace su propio commit (este registro va en
    la misma transacción que la atribución) y deja la hora al default de la columna."""
    from flask import has_request_context
    from app.models import User, get_impersonation_state

    texto = f'Palabra clave del anuncio: {anuncio.keyword or anuncio.name}'
    simulando, original_id, _ = get_impersonation_state() if has_request_context() else (False, None, None)
    if simulando:
        original = db.session.get(User, original_id)
        quien = original.username if original else f'Usuario {original_id}'
        texto += f' (Acción ejecutada por {quien} actuando en nombre de {setter.username})'
    return texto
