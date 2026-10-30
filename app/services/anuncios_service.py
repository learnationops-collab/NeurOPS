"""Los anuncios de Marketing: uno por PALABRA CLAVE de ManyChat, con su embudo y su costo.

Pedido de Kerwin (14/10/2026): ya no se registra cada anuncio a mano (campaña › conjunto › anuncio)
para después configurar su id en ManyChat. ManyChat manda la palabra clave (`keyword`) en cada
webhook del flujo y, si es nueva, el anuncio se crea solo (`anuncio_de_keyword`). El tablero de
Marketing es una tabla al estilo del Administrador de anuncios de Meta, una fila por palabra clave:

  · **Entrantes**: personas que llegaron por esa palabra clave en el período. Una persona cuenta
    una vez por palabra clave, el día de su PRIMERA interacción con ella (sus otros webhooks del
    mismo flujo no suman). Si después vuelve por otro anuncio, cuenta también en ese.
  · **Calificados / Descalificados**: el último valor de `cualificacion` que mandó ManyChat para esa
    persona y esa palabra clave (una persona con dos conversaciones cuenta una vez), con la descalificación posterior del closer (`calificacion_service`).
    El resto está pendiente, en dos partes (Kerwin 16/10/2026: «hay leads
    que se quedan en el inicio»): **En conversación** respondió algún mensaje del flujo (`id_option`,
    el mensaje que contestó, distinto de 0) y **Sin respuesta** nunca contestó la apertura.
  · **Agendas**: las agendas creadas en el período (sin el marcador «Cualificado» del setter), una por
    persona y palabra clave. Se atribuyen como en «Mis agendas» del setter: el Instagram del cliente
    lleva a su conversación de ManyChat y de ahí a la última interacción de antes de la reunión. Si
    por el Instagram no aparece, un Instagram parecido o el nombre (`cruce_conversaciones`).
  · **Ventas**: los pagos completos y split pay completados del período (la misma regla del dashboard
    comercial), atribuidos igual, con la última interacción de antes del pago. **Cobrado** es todo lo
    cobrado de esas personas (también cuotas y señas). Lo cobrado que no llega a ninguna palabra clave
    (workshop, VSL, renovaciones, setting sin conversación) se ve en «De dónde vino lo cobrado», que sale de las
    mismas fuentes que las tarjetas (`fuentes`: Setting, Workshop y Otras; Kerwin, 17/10/2026: «$5.138 me parece
    poco»; el período tenía $17.059). Desde el 29/10 lo reparte el ORIGEN del cliente, como el Cash total.
  · **Gasto**: lo que Meta Ads gastó por día en los anuncios de Meta asociados a la palabra clave
    (`meta_ads_service`), más lo que se cargó a mano en el sistema viejo (`AdPeriodSpend`) los días
    en que Meta no tiene nada para esa palabra clave.

Una interacción sin palabra clave (un webhook que no la mandó) pertenece a la conversación en curso:
toma la palabra clave de la interacción anterior de esa persona o, si es la primera, de la siguiente.
La de un anuncio viejo sin palabra clave toma la del anuncio (`Ad.keyword`).
"""
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta

from app import db
from app.models import Ad, AdPeriodSpend, AdSet, Appointment, Client, FinancialSale, LeadAnswer
from app.models import MetaAnuncio, MetaGastoDiario
from app.models.marketing import clave_de_palabra as clave_de  # noqa: F401  (lo importa meta_ads_service)
from app.services.comercial_service import ComercialService, clientes_de_ventas, no_es_marcador, venta_completada
from app.services import calificacion_service, fuentes_service, marketing_formulas as formulas
from app.services.cruce_conversaciones import Cruce
from app.services.identity_service import normalize_ig
# Partido en módulos (regla de las 500 líneas): se re-exporta todo para que `anuncios_service.X` siga igual.
from app.services.anuncios_claves_service import (  # noqa: F401
    CLAVES_QUE_NO_SON, LARGO_MAXIMO, TANDA, _clave_de_cada_anuncio, _en_tandas, _interacciones, _por_persona,
    _respondio, _vigente, anuncio_de_clave, anuncio_de_keyword, claves_conocidas, es_keyword_valida,
)
from app.services.anuncios_agrupacion_service import (  # noqa: F401
    SIN_CONJUNTO, _agrupacion, _anuncios_de, _como_se_escribe, _conjuntos, _grupos_de_meta,
    _opciones_de_agrupacion, agrupar, archivar,
)


def _meta_ads():
    from app.services import meta_ads_service  # se importan entre los dos
    return meta_ads_service



def _limites(desde, hasta):
    return datetime.combine(desde, time.min), datetime.combine(hasta, time.max)


class _Atribuidor:
    """Le busca a una agenda o a una venta la palabra clave por la que llegó la persona: la de su
    última interacción de ManyChat hasta `tope` (la reunión o el pago).

    La conversación se busca con `cruce_conversaciones.Cruce`: primero la de la misma persona
    (`person_uuid`, plan_personas), después el Instagram exacto, el parecido y el nombre (Kerwin, 15/10/2026: el setter escribe mal el Instagram —«julio_garca» por «juliocgarca»—
    o pone el nombre en su lugar; 30 de 175 agendas pendientes en staging se resolvían así)."""

    def __init__(self, igs, clave_de_anuncio, nombres=(), personas=()):
        self.cruce = Cruce(igs, nombres, personas)
        self.interacciones = _interacciones(self.cruce.lead_ids(), clave_de_anuncio)

    def _ultima(self, lead_ids, tope):
        mejor = None
        for lead_id in lead_ids:
            for creada, clave, *_ in self.interacciones.get(lead_id, ()):
                if clave and (tope is None or creada <= tope) and (mejor is None or creada > mejor[0]):
                    mejor = (creada, clave)
        return mejor[1] if mejor else None

    def clave(self, ig, tope, nombre=None, persona=None):
        for lead_ids in self.cruce.candidatos(ig, nombre, persona):
            clave = self._ultima(lead_ids, tope)
            if clave:
                return clave
        return None


# --- El tablero --------------------------------------------------------------------------------

def entradas_del_periodo(desde_dt, hasta_dt, clave_de_anuncio):
    """Cada persona que entró por una palabra clave en el período, una vez por palabra clave:
    `{'lead_id', 'clave', 'cuando', 'calificacion' ('true' | 'false' | None), 'respondio'}`.

    Es lo que cuenta `_entrantes` y lo que lista «Leads» al abrir la cifra (`fuentes_registros_service`):
    las dos salen de acá, así que la lista suma la cifra."""
    lead_ids = {lid for (lid,) in db.session.query(LeadAnswer.conversation_id).filter(
        LeadAnswer.created_at >= desde_dt, LeadAnswer.created_at <= hasta_dt).distinct()}
    descalificados = calificacion_service.descalificados()
    for grupo in _por_persona(lead_ids, clave_de_anuncio).values():
        filas = grupo['filas']
        tope = max((descalificados[lid] for lid in grupo['leads'] if lid in descalificados), default=None)
        primera, calificacion, respondio = {}, {}, set()
        for creada, clave, valor, contesto in filas:
            primera.setdefault(clave, creada)
            if valor in ('true', 'false'):
                calificacion[clave] = valor
            if contesto:
                respondio.add(clave)
        for clave, cuando in primera.items():
            if not (desde_dt <= cuando <= hasta_dt):
                continue
            yield {'lead_id': grupo['leads'][0], 'clave': clave, 'cuando': cuando, 'respondio': clave in respondio,
                   'calificacion': calificacion_service.efectiva(calificacion.get(clave), cuando, tope)}


def _entrantes(desde_dt, hasta_dt, clave_de_anuncio):
    """{clave: {'entrantes', 'calificados', 'descalificados', 'en_conversacion',
    'dias': {fecha: [entrantes, calificados, descalificados, en conversación]}}}
    y la cantidad de personas cuya conversación no tiene ninguna palabra clave (clave None)."""
    por_clave = defaultdict(lambda: {'entrantes': 0, 'calificados': 0, 'descalificados': 0,
                                     'en_conversacion': 0, 'dias': defaultdict(lambda: [0, 0, 0, 0])})
    for e in entradas_del_periodo(desde_dt, hasta_dt, clave_de_anuncio):
        fila = por_clave[e['clave']]
        dia = fila['dias'][e['cuando'].date().isoformat()]
        fila['entrantes'] += 1
        dia[0] += 1
        if e['calificacion'] == 'true':
            fila['calificados'] += 1
            dia[1] += 1
        elif e['calificacion'] == 'false':
            fila['descalificados'] += 1
            dia[2] += 1
        elif e['respondio']:
            fila['en_conversacion'] += 1
            dia[3] += 1
    return por_clave


def _agendas(desde_dt, hasta_dt, clave_de_anuncio):
    """({clave: {'agendas', 'dias'}}, sin_atribuir): una agenda por persona y palabra clave.

    El anuncio que eligió el setter en «Mis agendas» (`Appointment.anuncio_id`, 18/10/2026) manda sobre
    ManyChat: así se corrige una palabra clave equivocada."""
    filas = db.session.query(Appointment.id, Appointment.client_id, Appointment.start_time,
                             Appointment.created_at, Client.instagram, Client.full_name,
                             Appointment.anuncio_id, Appointment.person_uuid) \
        .outerjoin(Client, Client.id == Appointment.client_id) \
        .filter(Appointment.created_at >= desde_dt, Appointment.created_at <= hasta_dt, no_es_marcador()).all()
    atribuidor = _Atribuidor({normalize_ig(f.instagram) for f in filas}, clave_de_anuncio,
                             {f.full_name for f in filas}, {f.person_uuid for f in filas})

    por_clave = defaultdict(lambda: {'agendas': 0, 'dias': Counter()})
    vistas, sin_atribuir = set(), 0
    for f in sorted(filas, key=lambda f: (f.created_at, f.id)):
        clave = clave_de_anuncio.get(f.anuncio_id) if f.anuncio_id else None
        clave = clave or atribuidor.clave(normalize_ig(f.instagram), f.start_time, f.full_name, f.person_uuid)
        if not clave:
            sin_atribuir += 1
            continue
        persona = (f.client_id or f'agenda-{f.id}', clave)
        if persona in vistas:
            continue
        vistas.add(persona)
        por_clave[clave]['agendas'] += 1
        por_clave[clave]['dias'][f.created_at.date().isoformat()] += 1
    return por_clave, sin_atribuir


def claves_de_cobros(cobros, clave_de_anuncio=None, cliente_de=None):
    """{id de cada cobro: su palabra clave o None}: la de la última interacción de ManyChat de esa
    persona hasta el pago. La usan el tablero y la bandeja de ventas del setter (17/10/2026), así que
    una venta que el setter ve pendiente es una que Marketing no cuenta para ningún anuncio.

    Se prueba el Instagram escrito en la venta y, si no lleva a nada, el de su cliente: el de la
    venta lo tipea el closer y a veces no es el mismo.

    Si el setter eligió el anuncio de las ventas de ese cliente (`Client.anuncio_ventas_id`, 18/10/2026),
    ése manda sobre ManyChat para todos sus pagos: es como se corrige una palabra clave equivocada."""
    clave_de_anuncio = _clave_de_cada_anuncio() if clave_de_anuncio is None else clave_de_anuncio
    cliente_de = clientes_de_ventas(cobros) if cliente_de is None else cliente_de
    ig_de_cliente, nombre_de_cliente, elegida = {}, {}, {}
    ids = {cid for cid in cliente_de.values() if cid}
    for tanda in _en_tandas(ids):
        for cid, ig, nombre, ad_id in db.session.query(
                Client.id, Client.instagram, Client.full_name, Client.anuncio_ventas_id).filter(Client.id.in_(tanda)):
            ig_de_cliente[cid] = normalize_ig(ig)
            nombre_de_cliente[cid] = nombre
            if ad_id and clave_de_anuncio.get(ad_id):
                elegida[cid] = clave_de_anuncio[ad_id]

    def igs_de(cobro):
        return [ig for ig in (normalize_ig(cobro.instagram), ig_de_cliente.get(cliente_de.get(cobro.id))) if ig]

    def nombre_de(cobro):
        return nombre_de_cliente.get(cliente_de.get(cobro.id))

    sueltos = [c for c in cobros if cliente_de.get(c.id) not in elegida]
    atribuidor = _Atribuidor({ig for c in sueltos for ig in igs_de(c)}, clave_de_anuncio,
                             {nombre_de(c) for c in sueltos}, {c.person_uuid for c in sueltos})
    return {cobro.id: elegida.get(cliente_de.get(cobro.id)) or next(
                (c for ig in igs_de(cobro) or [None] if (c := atribuidor.clave(ig, cobro.date, nombre_de(cobro), cobro.person_uuid))), None)
            for cobro in cobros}


def _ventas(desde_dt, hasta_dt, clave_de_anuncio):
    """({clave: {'ventas', 'cobrado', 'new_cash', 'personas'}}, sin_atribuir, cobros, sin_clave, claves): ventas nuevas (completo o
    split) y todo lo cobrado (también cuotas y señas) de las personas que llegaron por esa palabra
    clave; además todos los cobros del período, los que no llegaron a ninguna y
    la palabra clave de cada cobro (para `fuentes_service`)."""
    cobros = [v for v in FinancialSale.query.filter(FinancialSale.date >= desde_dt,
                                                    FinancialSale.date <= hasta_dt).all()
              if venta_completada(v)]
    cliente_de = clientes_de_ventas(cobros)
    claves = claves_de_cobros(cobros, clave_de_anuncio, cliente_de)
    por_clave = defaultdict(lambda: {'ventas': 0, 'cobrado': 0.0, 'new_cash': 0.0, 'personas': set()})
    sin_atribuir, sin_clave = 0, []
    for cobro in cobros:
        es_venta = ComercialService.clasificar_venta(cobro)[2]
        clave = claves[cobro.id]
        if not clave:
            sin_atribuir += 1 if es_venta else 0
            sin_clave.append(cobro)
            continue
        por_clave[clave]['cobrado'] += float(cobro.monto or 0)
        if es_venta:
            por_clave[clave]['ventas'] += 1
            por_clave[clave]['new_cash'] += float(cobro.monto or 0)
            por_clave[clave]['personas'].add(cliente_de.get(cobro.id) or f'cobro-{cobro.id}')
    return por_clave, sin_atribuir, cobros, sin_clave, claves


def _gasto(desde, hasta, clave_de_anuncio):
    """({clave: {fecha: gasto}}, gasto de Meta que no es de una palabra clave de Setting, moneda).

    Solo cuenta lo gastado en anuncios del embudo Setting: es el mismo gasto de la tarjeta de Setting y de Todos
    (`meta_ads_service.gasto_por_embudo`). Un anuncio de otro embudo (Workshop, Contratación) que lleve una palabra clave
    en el nombre va a `sin_clave`, no a la fila de esa palabra (868: eran $23,69 de más en la tabla)."""
    por_clave = defaultdict(lambda: defaultdict(float))
    sin_clave, monedas = 0.0, Counter()
    for gasto, fecha, moneda, clave, embudo in db.session.query(
            MetaGastoDiario.gasto, MetaGastoDiario.fecha, MetaGastoDiario.moneda, MetaAnuncio.clave, MetaAnuncio.embudo) \
            .outerjoin(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id) \
            .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta):
        monedas[moneda] += 1
        if clave and embudo == 'setting':
            por_clave[clave][fecha.isoformat()] += float(gasto or 0)
        else:
            sin_clave += float(gasto or 0)

    # Lo cargado a mano en el sistema viejo (hasta julio de 2026): un rango por anuncio, por conjunto o
    # por campaña, repartido por día y, el de un conjunto o una campaña, en partes iguales entre sus
    # anuncios (como lo repartía el tablero viejo). Solo cuenta los días en que Meta no trajo nada para
    # esa palabra clave: así no se suma dos veces.
    dias_de_meta = {clave: set(dias) for clave, dias in por_clave.items()}
    anuncios_del_conjunto, conjuntos_de_campana = defaultdict(list), defaultdict(list)
    for ad_id, conjunto_id in db.session.query(Ad.id, Ad.ad_set_id).filter(Ad.ad_set_id.isnot(None)):
        anuncios_del_conjunto[conjunto_id].append(ad_id)
    for conjunto_id, campana_id in db.session.query(AdSet.id, AdSet.campaign_id):
        conjuntos_de_campana[campana_id].append(conjunto_id)

    for registro in AdPeriodSpend.query.filter(AdPeriodSpend.start_date <= hasta,
                                               AdPeriodSpend.end_date >= desde).all():
        if registro.ad_id:
            destinos = [registro.ad_id]
        elif registro.ad_set_id:
            destinos = anuncios_del_conjunto.get(registro.ad_set_id, [])
        else:
            destinos = [a for c in conjuntos_de_campana.get(registro.campaign_id, [])
                        for a in anuncios_del_conjunto.get(c, [])]
        claves = [clave_de_anuncio.get(a) for a in destinos]
        dias = (registro.end_date - registro.start_date).days + 1
        if not destinos or not registro.spend or dias <= 0:
            continue
        por_dia = float(registro.spend) / dias / len(destinos)
        dia = max(registro.start_date, desde)
        while dia <= min(registro.end_date, hasta):
            for clave in claves:
                if clave and dia.isoformat() not in dias_de_meta.get(clave, ()):
                    por_clave[clave][dia.isoformat()] += por_dia
            dia += timedelta(days=1)
    moneda = monedas.most_common(1)[0][0] if monedas else None
    return por_clave, sin_clave, moneda


def metricas(base):
    """Completa una fila (o los totales) con los porcentajes, los costos, el ticket y el ROAS: las cuentas son
    las de `marketing_formulas` (las mismas de las fuentes y de la pantalla). Un costo sin denominador (o sin
    gasto) es None: la pantalla muestra «—», no un 0 que parezca gratis."""
    entrantes, calificados = base['entrantes'], base['calificados']
    descalificados, en_conversacion = base.get('descalificados', 0), base.get('en_conversacion', 0)
    sin_respuesta = entrantes - calificados - descalificados - en_conversacion
    derivadas = {
        'gasto': round(base['gasto'], 2),
        'cobrado': round(base['cobrado'], 2),
        'new_cash': round(base.get('new_cash', 0.0), 2),
        'no_calificados': entrantes - calificados,
        'sin_respuesta': sin_respuesta,
        'pendientes': en_conversacion + sin_respuesta,
    }
    return {**base, **derivadas, **formulas.aplicar({**base, **derivadas})}


SUMABLES = ('entrantes', 'calificados', 'descalificados', 'en_conversacion', 'agendas', 'ventas', 'clientes_nuevos', 'gasto',
            'cobrado', 'new_cash')


def tablero(desde, hasta, base=None, segmento=None):
    """La tabla de Marketing para el período [desde, hasta] (fechas, ambos incluidos).

    Devuelve una fila por palabra clave con movimiento en el período (entrantes, agendas, ventas o
    gasto), los totales, la serie por día de cada fila (para el gráfico de las filas elegidas) y lo
    que no se pudo atribuir. Los totales los recalcula también la pantalla sobre las filas visibles.

    `base` (`conteo_agendas_service`): por qué fecha cuentan las agendas de las tarjetas de fuente (Setting,
    Workshop y Otras). La tabla de palabras clave cuenta siempre por fecha de alta: es la de los costos.
    `segmento` (A, B, C, D, sin; coma): las cifras de las fuentes (no la tabla de palabras clave ni el gasto) acotadas a esos
    segmentos, por fecha de alta (`segmentos_marketing_service.acotar_fuentes`).
    """
    desde_dt, hasta_dt = _limites(desde, hasta)
    clave_de_anuncio = _clave_de_cada_anuncio()

    entrantes = _entrantes(desde_dt, hasta_dt, clave_de_anuncio)
    agendas, agendas_sin_atribuir = _agendas(desde_dt, hasta_dt, clave_de_anuncio)
    ventas, ventas_sin_atribuir, cobros, _sin_clave, claves_de_cobro = _ventas(
        desde_dt, hasta_dt, clave_de_anuncio)
    gasto, gasto_sin_clave, moneda = _gasto(desde, hasta, clave_de_anuncio)

    anuncios_por_clave = defaultdict(list)
    for anuncio in Ad.query.filter(Ad.clave.isnot(None)).all():
        anuncios_por_clave[anuncio.clave].append(anuncio)
    meta_por_clave = defaultdict(list)
    for meta in MetaAnuncio.query.filter(MetaAnuncio.clave.isnot(None)).all():
        meta_por_clave[meta.clave].append(meta)
    grupos_de_meta = _grupos_de_meta(desde, hasta, meta_por_clave)
    conjuntos = _conjuntos()
    con_movimiento = set(entrantes) | set(agendas) | set(ventas) | set(gasto)
    escrituras = _como_se_escribe(con_movimiento - set(anuncios_por_clave) - {None})

    filas = []
    for clave in con_movimiento:
        e, a, v = entrantes.get(clave), agendas.get(clave), ventas.get(clave)
        g = gasto.get(clave, {})
        suyos = anuncios_por_clave.get(clave, [])
        vigente = _vigente(suyos)
        de_meta = meta_por_clave.get(clave, [])
        # [entrantes, calificados, gasto, agendas, descalificados, en conversación]: los dos últimos se
        # sumaron al final (16/10/2026) para no correr los índices que ya lee la pantalla.
        dias = defaultdict(lambda: [0, 0, 0.0, 0, 0, 0])
        for fecha, (n, calif, descalif, conversando) in (e['dias'].items() if e else ()):
            dias[fecha][0], dias[fecha][1], dias[fecha][4], dias[fecha][5] = n, calif, descalif, conversando
        for fecha, monto in g.items():
            dias[fecha][2] = round(monto, 2)
        for fecha, n in (a['dias'].items() if a else ()):
            dias[fecha][3] = n
        gasto_total = sum(g.values())
        campana, conjunto, origen, reparto = _agrupacion(vigente, grupos_de_meta.get(clave), conjuntos, gasto_total)
        filas.append(metricas({
            'clave': clave,
            'nombre': ((vigente.keyword or vigente.name) if vigente else escrituras.get(clave, clave))
            if clave else 'Sin palabra clave',
            'ad_id': vigente.id if vigente else None,
            'archivado': bool(suyos) and all((x.status or '').lower() == 'archived' for x in suyos),
            'meta': {
                'anuncios': len(de_meta),
                'activos': sum(1 for m in de_meta if m.estado == 'ACTIVE'),
                'nombres': sorted({m.nombre for m in de_meta if m.nombre})[:6],
            },
            'entrantes': e['entrantes'] if e else 0,
            'calificados': e['calificados'] if e else 0,
            'descalificados': e['descalificados'] if e else 0,
            'en_conversacion': e['en_conversacion'] if e else 0,
            'agendas': a['agendas'] if a else 0,
            'ventas': v['ventas'] if v else 0,
            'clientes_nuevos': len(v['personas']) if v else 0,
            'new_cash': v['new_cash'] if v else 0.0,
            'cobrado': v['cobrado'] if v else 0.0,
            'gasto': gasto_total,
            'campana': campana,
            'conjunto': conjunto,
            'agrupacion': origen,
            'gasto_por_grupo': reparto,
            'dias': {fecha: valores for fecha, valores in sorted(dias.items())},
        }))
    filas.sort(key=lambda f: (f['clave'] is None, -f['entrantes'], -f['gasto'], f['nombre']))

    totales = metricas({k: sum(f[k] for f in filas) for k in SUMABLES})
    embudos = _meta_ads().gasto_por_embudo(desde, hasta)
    fuentes = fuentes_service.resumen(desde, hasta, filas, cobros, claves_de_cobro, embudos, base)
    if segmento:
        from app.services import segmentos_marketing_service
        fuentes = segmentos_marketing_service.acotar_fuentes(fuentes, desde, hasta, segmento)
    return {
        'desde': desde.isoformat(),
        'hasta': hasta.isoformat(),
        'moneda': moneda or 'USD',
        'filas': filas,
        'totales': totales,
        'sin_atribuir': {
            'agendas': agendas_sin_atribuir,
            'ventas': ventas_sin_atribuir,
            'gasto_meta': round(gasto_sin_clave, 2),
        },
        # Todo lo cobrado del período (el Cash collected del dashboard comercial): lo que suman Setting, Workshop y Otras.
        'cobrado_periodo': round(sum(float(c.monto or 0) for c in cobros), 2),
        'agrupaciones': _opciones_de_agrupacion(filas, conjuntos),
        # El gasto de Meta por embudo (setting, workshop…): el selector de Rendimiento (15/10/2026).
        'embudos': embudos,
        # Setting vs Workshop con ROAS New Cash y Total (23/10/2026): ver `fuentes_service`.
        'fuentes': fuentes,
        # Las cuentas y qué es un lead, un gasto y una venta: las mismas del backend, para la pantalla (`marketing_formulas`).
        'formulas': formulas.FORMULAS,
        'definiciones': formulas.DEFINICIONES,
    }
