"""La palabra clave de cada agenda del setter: la bandeja de «Mis agendas».

Pedido de Kerwin (10/10/2026): "estas agendas son las que llegaron con fuente de ese setter, y los
setters deben agregar la palabra clave del anuncio por el que llegó el lead [...] 'Mis agendas'
debe vaciarse para completar el proceso de asignación de palabra clave".

**Qué agendas.** Las del setter (`comercial_service.es_agenda_del_setter`, la misma regla que sus
números) creadas desde `DESDE`, una por persona como en "Agendas generadas"
(`ComercialService.generadas`): es literalmente esa tabla, sin las que ya tienen anuncio.

**Qué es tener palabra clave.** La regla con la que Marketing reparte las agendas entre los
anuncios (la tabla de anuncios, `anuncios_service`, y la bandeja «Sin anuncio» de
`/public/marketing`): el Instagram del lead lleva a su conversación de ManyChat (`ManychatLead`) y
ésta a una respuesta con anuncio (`LeadAnswer.ad_id`) de antes de la reunión. Así la agenda que
sale de la bandeja es la que Marketing ya cuenta para ese anuncio, y la bandeja no puede vaciarse
con agendas que Marketing sigue viendo sin atribuir. `Appointment.keyword` NO alcanza: Marketing no
lo lee; se escribe igual al asignar (lo muestran el mazo y la ficha) y, si ya estaba, sirve de
sugerencia.

**Por qué hace falta el Instagram.** Es con lo que Marketing encuentra la conversación de la agenda.
Desde el 15/10/2026, si por el Instagram no aparece, también por el nombre completo exacto cuando una
sola conversación de ManyChat lo tiene (Kerwin: «deberían conectarse solas»; 30 de 175 pendientes
en staging eran un Instagram mal escrito o el nombre puesto en su lugar). Sin ninguna de las dos no
hay atribución posible: la tarjeta pide el Instagram cuando falta.

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
from app.models.marketing import clave_de_palabra
from app.services.comercial_service import ComercialService, es_agenda_del_setter
from app.services.user_time_service import hoy_del_usuario, limites_dia_utc, zona_del_usuario

DESDE = date(2026, 7, 1)

# El `action_type` del registro que deja cada asignación en el historial del lead. Es también con lo
# que se cuentan las de hoy y la racha: no hay columna nueva.
ACCION = 'palabra_clave'

# El `keyword` de la respuesta que se crea cuando la conversación no tenía ninguna para marcar: la
# misma marca que dejaba la atribución manual de Marketing, para distinguirla de las de ManyChat.
KEYWORD_MANUAL = 'manual_attribution'

# Palabras clave nuevas (15/10/2026). «Los setters no ven todas las palabras claves que llegan desde
# ManyChat: permití que puedan agregar una que no esté en los registros». El buscador ofrece también
# las palabras clave que llegaron por ManyChat y no tienen anuncio (`nueva: True`, sin id) y lo que
# el setter escriba; al asignar se crea el anuncio con la misma regla que el webhook
# (`anuncios_service.anuncio_de_keyword`: uno por palabra clave, sin campaña ni conjunto).


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
    # Un correo en el campo del Instagram («alexss_10@hotmail.com») no es un usuario: la consulta
    # de las conversaciones le saca todas las @ y no lo encontraba nunca, así que la agenda no
    # salía de la bandeja aunque se le asignara el anuncio. Sin usuario, la tarjeta lo pide.
    if '@' in limpio:
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
    from app.services.anuncios_service import clave_de_nombre, leads_por_nombre

    igs = {normalizar_ig(f['ig']) for f in filas} - {None}
    leads_por_ig = defaultdict(list)
    if igs:
        ig_columna = func.lower(func.replace(ManychatLead.ig, '@', ''))
        for lead_id, ig in db.session.query(ManychatLead.id, ig_columna).filter(ig_columna.in_(igs)):
            leads_por_ig[(ig or '').strip()].append(lead_id)
    # Si el Instagram no lleva a ninguna, el nombre completo exacto, como Marketing
    # (`anuncios_service._Atribuidor`): el setter lo escribe mal o pone el nombre en su lugar.
    por_nombre = leads_por_nombre({clave_de_nombre(f['cliente']) for f in filas})
    lead_ids = {lid for ids in leads_por_ig.values() for lid in ids} | set(por_nombre.values())
    respuestas = defaultdict(list)
    if lead_ids:
        for lead_id, ad_id, creada in db.session.query(
                LeadAnswer.lead_id, LeadAnswer.ad_id, LeadAnswer.created_at).filter(
                LeadAnswer.lead_id.in_(lead_ids), LeadAnswer.ad_id.isnot(None)):
            respuestas[lead_id].append((creada, ad_id))

    def ultima(ids, reunion):
        candidatas = [(creada, ad_id) for lead_id in ids for creada, ad_id in respuestas[lead_id]
                      if creada and (reunion is None or creada <= reunion)]
        # La más cercana a la reunión, como Marketing: es el anuncio por el que llegó esa vez.
        return max(candidatas)[1] if candidatas else None

    anuncio = {}
    for f in filas:
        reunion = _instante(f['fecha'])
        por_ig = ultima(leads_por_ig.get(normalizar_ig(f['ig']) or '', []), reunion)
        lead = por_nombre.get(clave_de_nombre(f['cliente']))
        elegido = por_ig or (ultima([lead], reunion) if lead else None)
        if elegido:
            anuncio[f['id']] = elegido
    return anuncio


def completar_palabra_clave(filas):
    """Las filas de «Agendas generadas» de un setter sin `palabra_clave` que Marketing ya atribuye
    a un anuncio (llegaron por ManyChat y nadie tuvo que asignarlas) toman la palabra clave de ese
    anuncio. Así «Sin palabra clave» en su Revisar es lo mismo que pendiente en «Mis agendas»: antes
    Revisar decía 14 sin palabra clave en octubre con la bandeja de octubre vacía (copia local).
    Cambia las filas en el lugar y las devuelve."""
    faltan = [f for f in filas if not f.get('palabra_clave')]
    anuncio = _anuncio_de_cada_una(faltan)
    if not anuncio:
        return filas
    ads = {a.id: a for a in Ad.query.filter(Ad.id.in_(set(anuncio.values()))).all()}
    for f in faltan:
        ad = ads.get(anuncio.get(f['id']))
        if ad and (ad.keyword or ad.name):
            f['palabra_clave'] = (ad.keyword or ad.name).strip()
    return filas


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


def completadas(setter, filas, anuncio):
    """Las agendas del setter que YA tienen anuncio, las más nuevas primero: la pestaña
    «Completadas» de «Mis agendas».

    Pedido del dueño (15/10/2026): «quisiera saber los que ya pusieron, quiero saber si están
    avanzando o no en esto: pendientes por un lado y [...] el tab de completados por otro». Son las
    mismas filas que la bandeja (`_bandeja`) del lado de las que Marketing ya atribuye, con la misma
    forma que las pendientes y además:

      · `palabra_clave`: la del anuncio que Marketing les atribuye (el de `_anuncio_de_cada_una`);
      · `asignada`: cuándo la asignó el setter (el primer registro `palabra_clave` de esa persona),
        o None si nadie la asignó;
      · `por`: 'setter' si hay ese registro, 'manychat' si Marketing la atribuyó sola (llegó por
        ManyChat con su anuncio y nunca estuvo en la bandeja).

    El registro se busca por la agenda y, si no, por la persona: la fila es una por persona (la de
    la reunión más reciente, o la venta) y el setter pudo haberla asignado desde otra de sus agendas.
    Solo cuentan los registros de este setter (los deja `asignar`, también simulando).
    """
    hechas = [f for f in filas if f['id'] in anuncio]
    if not hechas:
        return []
    ads = {a.id: a for a in Ad.query.filter(Ad.id.in_(set(anuncio[f['id']] for f in hechas))).all()}
    ids = [f['id'] for f in hechas]
    clientes = [f['client_id'] for f in hechas if f.get('client_id')]
    por_agenda, por_cliente = {}, {}
    condicion = Appointment.id.in_(ids)
    if clientes:
        condicion = condicion | Appointment.client_id.in_(clientes)
    for appt_id, client_id, cuando in db.session.query(
            LeadEventLog.appointment_id, Appointment.client_id, LeadEventLog.created_at) \
            .join(Appointment, Appointment.id == LeadEventLog.appointment_id) \
            .filter(LeadEventLog.action_type == ACCION, LeadEventLog.user_id == setter.id, condicion):
        if cuando is None:
            continue
        if appt_id not in por_agenda or cuando < por_agenda[appt_id]:
            por_agenda[appt_id] = cuando
        if client_id and (client_id not in por_cliente or cuando < por_cliente[client_id]):
            por_cliente[client_id] = cuando

    salida = _serializar(hechas)
    for fila in salida:
        ad = ads.get(anuncio[fila['id']])
        cuando = por_agenda.get(fila['id']) or por_cliente.get(fila['client_id'])
        fila['palabra_clave'] = ((ad.keyword or ad.name) or '').strip() if ad else None
        fila['asignada'] = cuando.isoformat() if cuando else None
        fila['por'] = 'setter' if cuando else 'manychat'
    return salida


def _anuncios_por_keyword(keywords):
    """{palabra clave de la cita: id del anuncio}, comparando sin tildes ni mayúsculas (`Ad.clave`)."""
    from app.services.anuncios_service import _vigente

    claves = {k: clave_de_palabra(k) for k in keywords if clave_de_palabra(k)}
    if not claves:
        return {}
    por_clave = defaultdict(list)
    for a in Ad.query.filter(Ad.clave.in_(set(claves.values()))).all():
        por_clave[a.clave].append(a)
    return {k: _vigente(por_clave[c]).id for k, c in claves.items() if por_clave.get(c)}


def _canal(cita):
    """Por dónde reservó el lead, cuando se sabe: el link de Agendas 2.0 o una carga a mano."""
    if not cita:
        return None
    payload = cita.agenda_payload or {}
    # Una llamada que el equipo cargó desde NeurOPS (agendas_v2/manual.py) también lleva payload.
    a_mano = bool(payload.get('manual')) and not payload.get('evento_id')
    if payload and not a_mano:
        return payload.get('funnel_nombre') or payload.get('funnel') or 'Link de agendas'
    origen = (cita.origin or '').strip().lower()
    if a_mano or origen.startswith('manual'):
        return 'Cargada a mano'
    if origen.startswith('manychat'):
        return 'ManyChat'
    return None


def anuncio_de_palabra(texto):
    """El anuncio de esa palabra clave (comparando sin tildes ni mayúsculas, `Ad.clave`); si no hay,
    lo crea como el webhook de ManyChat. No hace commit: lo hace `asignar`."""
    from app.services import anuncios_service

    if not anuncios_service.es_keyword_valida(texto):
        raise ErrorDePalabraClave('Esa palabra clave no sirve: escribila como llega de ManyChat.')
    return anuncios_service.anuncio_de_keyword(texto, crear=True)


def _palabras_sin_anuncio(conocidas):
    """Las palabras clave que llegaron por ManyChat y no tienen anuncio, las más usadas primero: una
    por palabra (sin tildes ni mayúsculas), escrita como llegó más veces. En develop el webhook y la
    migración e5b8d2f4a1c7 ya crean el anuncio de cada palabra que llega, así que suele quedar vacía."""
    from app.services import anuncios_service

    cuantas, como = Counter(), defaultdict(Counter)
    for keyword, n in db.session.query(LeadAnswer.keyword, func.count(LeadAnswer.id)) \
            .filter(LeadAnswer.keyword.isnot(None)).group_by(LeadAnswer.keyword):
        if not anuncios_service.es_keyword_valida(keyword):
            continue
        clave = clave_de_palabra(keyword)
        if clave in conocidas:
            continue
        cuantas[clave] += n
        como[clave][keyword.strip()] += n
    return [como[clave].most_common(1)[0][0] for clave, _n in cuantas.most_common()]


def anuncios(setter, filas=None, anuncio=None):
    """Los anuncios para el buscador, en un orden que sirva: los activos primero; entre ellos, los
    que este setter más usó (sus agendas atribuidas a cada uno) y después los más nuevos.

    **Uno por palabra clave** (15/10/2026). Desde el 14/10 cada palabra clave que llega de ManyChat
    es un anuncio (lo crea el webhook, y la migración e5b8d2f4a1c7 creó los de las que ya habían
    llegado sin uno registrado: «Obtener Guia», las guías por país…). Los anuncios viejos cargados a
    mano repetían palabras clave («DOCUMENTO» dos veces, «GUÍA» y «GUIA», «LECCIÓN» y «leccion»): se
    ofrece una sola opción por palabra clave, la del anuncio vigente, con los usos de todos.

    Al final, las palabras clave que llegaron por ManyChat y todavía no tienen anuncio (sin `id`,
    `nueva: True`): elegir una crea su anuncio al asignar (ver `anuncio_de_palabra`).
    """
    from app.services.anuncios_service import _vigente

    if filas is None:
        _pend, filas, anuncio = _bandeja(setter)
    usos_por_id = Counter((anuncio or {}).values())
    grupos = defaultdict(list)
    for a in Ad.query.all():
        if a.keyword or a.name:
            grupos[a.clave or f'#{a.id}'].append(a)
    opciones = []
    for suyos in grupos.values():
        a = _vigente(suyos)
        opciones.append((a, sum(usos_por_id.get(x.id, 0) for x in suyos)))
    opciones.sort(key=lambda o: ((o[0].status or '').lower() != 'active', -o[1],
                                 -(o[0].created_at.timestamp() if o[0].created_at else 0), o[0].id))
    conocidas = {c for a, _u in opciones for c in (a.clave, clave_de_palabra(a.keyword), clave_de_palabra(a.name)) if c}
    return [{'id': a.id, 'keyword': a.keyword or a.name, 'nombre': a.name or a.keyword,
             'activo': (a.status or '').lower() == 'active', 'usos': usos}
            for a, usos in opciones] + [{'id': None, 'keyword': k, 'nombre': k, 'activo': True, 'usos': 0,
                                         'nueva': True} for k in _palabras_sin_anuncio(conocidas)]


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
    """Todo lo que la pantalla necesita en un pedido: las pendientes, las completadas (ver
    `completadas`), los anuncios y el resumen. Las completadas de un mes son su `total` menos sus
    `pendientes` en `resumen.meses`: salen de las mismas filas."""
    datos = _bandeja(setter)
    pend, filas, anuncio = datos
    return {'pendientes': _serializar(pend), 'completadas': completadas(setter, filas, anuncio),
            'anuncios': anuncios(setter, filas, anuncio), 'resumen': resumen(setter, datos)}


# --- Escritura ----------------------------------------------------------------------------------

def asignar(setter, appointment_id, ad_id, instagram=None, palabra=None):
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

    **Si el cliente y el Tablero tienen Instagram distintos** (`Dafne.aj` y `Dafne_aj`: 7 de las 25
    de octubre de Elias en la copia local), el anuncio va a la conversación de los dos. Marketing
    atribuye con el del Tablero y la bandeja mira el del cliente (las filas de «Agendas generadas»):
    con solo el del Tablero, la agenda quedaba atribuida para Marketing y volvía a la bandeja en la
    próxima carga, que así no se podía vaciar.
    """
    from app.services.ficha_agendas_service import espejo_en_el_tablero

    cita = Appointment.query.filter(Appointment.id == appointment_id, es_agenda_del_setter(setter.id)).first()
    if not cita:
        raise ErrorDePalabraClave('Esta agenda no es tuya.', 403)
    if ad_id:
        anuncio = db.session.get(Ad, ad_id)
        if not anuncio:
            raise ErrorDePalabraClave('Ese anuncio no existe: elegilo de la lista.', 404)
    elif palabra is not None:
        # Una palabra clave que no está en la lista (o que llegó por ManyChat sin anuncio): se busca
        # sin tildes ni mayúsculas y, si no hay, se crea su anuncio (15/10/2026).
        anuncio = anuncio_de_palabra(palabra)
    else:
        raise ErrorDePalabraClave('Elegí el anuncio de la lista o escribí la palabra clave.')

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

    igs = [ig]
    del_cliente = normalizar_ig(cliente.instagram) if cliente else None
    if del_cliente and del_cliente != ig:
        igs.append(del_cliente)
    for usuario in igs:
        _responder_con_anuncio(usuario, cita, cliente, anuncio, tope, antes_de_todo)

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


def _responder_con_anuncio(ig, cita, cliente, anuncio, tope, antes_de_todo):
    """La conversación de ese Instagram (la crea si no está) con una respuesta con el anuncio de
    antes de la reunión: la que ya había sin anuncio o una nueva antes de la primera agenda."""
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
