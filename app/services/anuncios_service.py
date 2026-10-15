"""Los anuncios de Marketing: uno por PALABRA CLAVE de ManyChat, con su embudo y su costo.

Pedido de Kerwin (14/10/2026): ya no se registra cada anuncio a mano (campaña › conjunto › anuncio)
para después configurar su id en ManyChat. ManyChat manda la palabra clave (`keyword`) en cada
webhook del flujo y, si es nueva, el anuncio se crea solo (`anuncio_de_keyword`). El tablero de
Marketing es una tabla al estilo del Administrador de anuncios de Meta, una fila por palabra clave:

  · **Entrantes**: personas que llegaron por esa palabra clave en el período. Una persona cuenta
    una vez por palabra clave, el día de su PRIMERA interacción con ella (sus otros webhooks del
    mismo flujo no suman). Si después vuelve por otro anuncio, cuenta también en ese.
  · **Calificados / No calificados**: el último valor de `cualificacion` que mandó ManyChat para esa
    persona y esa palabra clave. «No calificados» son el resto de los entrantes: los que ManyChat
    marcó que no y los que todavía no tienen respuesta.
  · **Agendas**: las agendas creadas en el período (sin el marcador «Cualificado» del setter), una por
    persona y palabra clave. Se atribuyen como en «Mis agendas» del setter: el Instagram del cliente
    lleva a su conversación de ManyChat y de ahí a la última interacción de antes de la reunión.
  · **Ventas**: los pagos completos y split pay completados del período (la misma regla del dashboard
    comercial), atribuidos igual, con la última interacción de antes del pago.
  · **Gasto**: lo que Meta Ads gastó por día en los anuncios de Meta asociados a la palabra clave
    (`meta_ads_service`), más lo que se cargó a mano en el sistema viejo (`AdPeriodSpend`) los días
    en que Meta no tiene nada para esa palabra clave.

Una interacción sin palabra clave (un webhook que no la mandó) pertenece a la conversación en curso:
toma la palabra clave de la interacción anterior de esa persona o, si es la primera, de la siguiente.
La de un anuncio viejo sin palabra clave toma la del anuncio (`Ad.keyword`).
"""
from collections import Counter, defaultdict
from datetime import datetime, time, timedelta

from sqlalchemy import func

from app import db
from app.models import Ad, AdPeriodSpend, AdSet, Appointment, Client, FinancialSale, LeadAnswer, ManychatLead
from app.models import MetaAnuncio, MetaGastoDiario
from app.models.marketing import clave_de_palabra as clave_de
from app.services.comercial_service import ComercialService, clientes_de_ventas, no_es_marcador, venta_completada
from app.services.identity_service import normalize_ig

# Lo que llega en `keyword` y no es una palabra clave: la marca de la atribución manual (la deja la
# bandeja del setter, ver `palabra_clave_service.KEYWORD_MANUAL`) y los vacíos de ManyChat.
CLAVES_QUE_NO_SON = frozenset({'MANUAL ATTRIBUTION', 'NULL', 'NONE', 'UNDEFINED', 'INDETERMINADO', 'N A'})
LARGO_MAXIMO = 100
# Para no armar consultas IN con miles de parámetros (SQLite corta en 999 en versiones viejas).
TANDA = 500


def es_keyword_valida(valor):
    """¿Es una palabra clave de verdad? Descarta variables sin reemplazar de ManyChat (`{{keyword}}`,
    `cuf_…`), los vacíos y la marca de la atribución manual."""
    if not isinstance(valor, str):
        return False
    texto = valor.strip()
    if not texto or len(texto) > LARGO_MAXIMO or '{{' in texto or '}}' in texto or 'cuf_' in texto.lower():
        return False
    clave = clave_de(texto)
    return bool(clave) and clave not in CLAVES_QUE_NO_SON


def _vigente(anuncios):
    """De varios anuncios con la misma clave, el que manda: el más nuevo sin archivar (o el más nuevo)."""
    if not anuncios:
        return None
    return max(anuncios, key=lambda a: ((a.status or '').lower() != 'archived', a.id))


def anuncio_de_clave(clave):
    if not clave:
        return None
    return _vigente(Ad.query.filter(Ad.clave == clave).all())


def anuncio_de_keyword(keyword, crear=True):
    """El anuncio de esa palabra clave; si no existe y `crear`, lo crea (sin campaña ni conjunto).

    No hace commit: lo hace quien lo llama (el webhook guarda el anuncio con la interacción). Un anuncio
    nuevo le avisa a la asociación con Meta, por si ya había un anuncio de Meta que la nombraba.
    """
    if not es_keyword_valida(keyword):
        return None
    clave = clave_de(keyword)
    anuncio = anuncio_de_clave(clave)
    if anuncio or not crear:
        return anuncio
    texto = keyword.strip()[:LARGO_MAXIMO]
    anuncio = Ad(name=texto, keyword=texto, clave=clave, status='active')
    db.session.add(anuncio)
    db.session.flush()
    from app.services import meta_ads_service
    meta_ads_service.mapear_automatico()
    return anuncio


def claves_conocidas():
    """Todas las palabras clave que el sistema conoce: las de los anuncios y las que llegaron en algún
    webhook (las anteriores a este cambio no tienen anuncio)."""
    claves = {a.clave for a in Ad.query.filter(Ad.clave.isnot(None)).all()}
    for (keyword,) in db.session.query(LeadAnswer.keyword).filter(LeadAnswer.keyword.isnot(None)).distinct():
        if es_keyword_valida(keyword):
            claves.add(clave_de(keyword))
    return claves - {None}


# --- Lectura: de cada interacción, su palabra clave ---------------------------------------------

def _clave_de_cada_anuncio():
    return {a.id: (a.clave or clave_de(a.keyword) or clave_de(a.name)) for a in Ad.query.all()}


def _en_tandas(valores):
    valores = list(valores)
    for i in range(0, len(valores), TANDA):
        yield valores[i:i + TANDA]


def _interacciones(lead_ids, clave_de_anuncio):
    """{lead_id: [(instante, clave, calificacion), ...]} ordenadas, con la palabra clave ya resuelta
    (ver el docstring del módulo: la interacción sin palabra clave toma la de la conversación)."""
    crudas = defaultdict(list)
    for tanda in _en_tandas(lead_ids):
        for lead_id, ad_id, keyword, calificacion, creada in db.session.query(
                LeadAnswer.lead_id, LeadAnswer.ad_id, LeadAnswer.keyword, LeadAnswer.qualification,
                LeadAnswer.created_at).filter(LeadAnswer.lead_id.in_(tanda)):
            if creada is None:
                continue
            clave = clave_de(keyword) if es_keyword_valida(keyword) else None
            # El anuncio manda sobre el texto: la bandeja del setter le pone el anuncio a una
            # interacción que ya existía, y ése es el anuncio que eligió.
            if ad_id and clave_de_anuncio.get(ad_id):
                clave = clave_de_anuncio[ad_id]
            crudas[lead_id].append((creada, clave, calificacion))

    resultado = {}
    for lead_id, filas in crudas.items():
        filas.sort(key=lambda f: f[0])
        primera = next((clave for _, clave, _ in filas if clave), None)
        actual, resueltas = primera, []
        for creada, clave, calificacion in filas:
            if clave:
                actual = clave
            resueltas.append((creada, actual, calificacion))
        resultado[lead_id] = resueltas
    return resultado


def _limites(desde, hasta):
    return datetime.combine(desde, time.min), datetime.combine(hasta, time.max)


def _leads_por_ig(igs):
    """{ig normalizado: [lead_id, ...]} de las conversaciones de ManyChat con esos Instagram."""
    ig_columna = func.lower(func.replace(ManychatLead.ig, '@', ''))
    por_ig = defaultdict(list)
    for tanda in _en_tandas(igs):
        for lead_id, ig in db.session.query(ManychatLead.id, ig_columna).filter(ig_columna.in_(tanda)):
            ig_n = normalize_ig(ig)
            if ig_n:
                por_ig[ig_n].append(lead_id)
    return por_ig


class _Atribuidor:
    """Le busca a una agenda o a una venta la palabra clave por la que llegó la persona: la de su
    última interacción de ManyChat hasta `tope` (la reunión o el pago)."""

    def __init__(self, igs, clave_de_anuncio):
        self.por_ig = _leads_por_ig({ig for ig in igs if ig})
        lead_ids = {lid for ids in self.por_ig.values() for lid in ids}
        self.interacciones = _interacciones(lead_ids, clave_de_anuncio)

    def clave(self, ig, tope):
        mejor = None
        for lead_id in self.por_ig.get(ig, ()):
            for creada, clave, _ in self.interacciones.get(lead_id, ()):
                if clave and (tope is None or creada <= tope) and (mejor is None or creada > mejor[0]):
                    mejor = (creada, clave)
        return mejor[1] if mejor else None


# --- El tablero --------------------------------------------------------------------------------

def _entrantes(desde_dt, hasta_dt, clave_de_anuncio):
    """{clave: {'entrantes', 'calificados', 'descalificados', 'dias': {fecha: [entrantes, calificados]}}}
    y la cantidad de personas cuya conversación no tiene ninguna palabra clave (clave None)."""
    lead_ids = {lid for (lid,) in db.session.query(LeadAnswer.lead_id).filter(
        LeadAnswer.created_at >= desde_dt, LeadAnswer.created_at <= hasta_dt).distinct()}
    por_clave = defaultdict(lambda: {'entrantes': 0, 'calificados': 0, 'descalificados': 0,
                                     'dias': defaultdict(lambda: [0, 0])})
    for lead_id, filas in _interacciones(lead_ids, clave_de_anuncio).items():
        primera, calificacion = {}, {}
        for creada, clave, valor in filas:
            primera.setdefault(clave, creada)
            if valor in ('true', 'false'):
                calificacion[clave] = valor
        for clave, cuando in primera.items():
            if not (desde_dt <= cuando <= hasta_dt):
                continue
            fila = por_clave[clave]
            dia = fila['dias'][cuando.date().isoformat()]
            fila['entrantes'] += 1
            dia[0] += 1
            if calificacion.get(clave) == 'true':
                fila['calificados'] += 1
                dia[1] += 1
            elif calificacion.get(clave) == 'false':
                fila['descalificados'] += 1
    return por_clave


def _agendas(desde_dt, hasta_dt, clave_de_anuncio):
    """({clave: {'agendas', 'dias'}}, sin_atribuir): una agenda por persona y palabra clave."""
    filas = db.session.query(Appointment.id, Appointment.client_id, Appointment.start_time,
                             Appointment.created_at, Client.instagram) \
        .outerjoin(Client, Client.id == Appointment.client_id) \
        .filter(Appointment.created_at >= desde_dt, Appointment.created_at <= hasta_dt, no_es_marcador()).all()
    atribuidor = _Atribuidor({normalize_ig(f.instagram) for f in filas}, clave_de_anuncio)

    por_clave = defaultdict(lambda: {'agendas': 0, 'dias': Counter()})
    vistas, sin_atribuir = set(), 0
    for f in sorted(filas, key=lambda f: (f.created_at, f.id)):
        clave = atribuidor.clave(normalize_ig(f.instagram), f.start_time)
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


def _ventas(desde_dt, hasta_dt, clave_de_anuncio):
    """({clave: {'ventas', 'cobrado'}}, sin_atribuir): ventas nuevas (completo o split) y todo lo
    cobrado (también cuotas y señas) de las personas que llegaron por esa palabra clave."""
    cobros = [v for v in FinancialSale.query.filter(FinancialSale.date >= desde_dt,
                                                    FinancialSale.date <= hasta_dt).all()
              if venta_completada(v)]
    cliente_de = clientes_de_ventas(cobros)
    ig_de_cliente = {}
    ids = {cid for cid in cliente_de.values() if cid}
    for tanda in _en_tandas(ids):
        for cid, ig in db.session.query(Client.id, Client.instagram).filter(Client.id.in_(tanda)):
            ig_de_cliente[cid] = normalize_ig(ig)

    def ig_de(cobro):
        return normalize_ig(cobro.instagram) or ig_de_cliente.get(cliente_de.get(cobro.id))

    atribuidor = _Atribuidor({ig_de(c) for c in cobros}, clave_de_anuncio)
    por_clave = defaultdict(lambda: {'ventas': 0, 'cobrado': 0.0})
    sin_atribuir = 0
    for cobro in cobros:
        es_venta = ComercialService.clasificar_venta(cobro)[2]
        clave = atribuidor.clave(ig_de(cobro), cobro.date)
        if not clave:
            sin_atribuir += 1 if es_venta else 0
            continue
        por_clave[clave]['cobrado'] += float(cobro.monto or 0)
        if es_venta:
            por_clave[clave]['ventas'] += 1
    return por_clave, sin_atribuir


def _gasto(desde, hasta, clave_de_anuncio):
    """({clave: {fecha: gasto}}, gasto de Meta sin palabra clave, moneda)."""
    por_clave = defaultdict(lambda: defaultdict(float))
    sin_clave, monedas = 0.0, Counter()
    for gasto, fecha, moneda, clave in db.session.query(
            MetaGastoDiario.gasto, MetaGastoDiario.fecha, MetaGastoDiario.moneda, MetaAnuncio.clave) \
            .outerjoin(MetaAnuncio, MetaAnuncio.meta_ad_id == MetaGastoDiario.meta_ad_id) \
            .filter(MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta):
        monedas[moneda] += 1
        if clave:
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


def _division(numerador, denominador, decimales=2):
    return round(numerador / denominador, decimales) if denominador else None


def metricas(base):
    """Completa una fila (o los totales) con los porcentajes y los costos. Un costo sin denominador
    (o sin gasto) es None: la pantalla muestra «—», no un 0 que parezca gratis."""
    entrantes, calificados = base['entrantes'], base['calificados']
    gasto = round(base['gasto'], 2)
    con_gasto = gasto > 0
    return {
        **base,
        'gasto': gasto,
        'cobrado': round(base['cobrado'], 2),
        'no_calificados': entrantes - calificados,
        'pct_calificados': _division(calificados * 100, entrantes, 1),
        'pct_no_calificados': _division((entrantes - calificados) * 100, entrantes, 1),
        'cpl': _division(gasto, entrantes) if con_gasto else None,
        'cpl_calificado': _division(gasto, calificados) if con_gasto else None,
        'costo_agenda': _division(gasto, base['agendas']) if con_gasto else None,
        'costo_venta': _division(gasto, base['ventas']) if con_gasto else None,
        'roas': _division(base['cobrado'], gasto) if con_gasto else None,
    }


SUMABLES = ('entrantes', 'calificados', 'descalificados', 'agendas', 'ventas', 'gasto', 'cobrado')


def tablero(desde, hasta):
    """La tabla de Marketing para el período [desde, hasta] (fechas, ambos incluidos).

    Devuelve una fila por palabra clave con movimiento en el período (entrantes, agendas, ventas o
    gasto), los totales, la serie por día de cada fila (para el gráfico de las filas elegidas) y lo
    que no se pudo atribuir. Los totales los recalcula también la pantalla sobre las filas visibles.
    """
    desde_dt, hasta_dt = _limites(desde, hasta)
    clave_de_anuncio = _clave_de_cada_anuncio()

    entrantes = _entrantes(desde_dt, hasta_dt, clave_de_anuncio)
    agendas, agendas_sin_atribuir = _agendas(desde_dt, hasta_dt, clave_de_anuncio)
    ventas, ventas_sin_atribuir = _ventas(desde_dt, hasta_dt, clave_de_anuncio)
    gasto, gasto_sin_clave, moneda = _gasto(desde, hasta, clave_de_anuncio)

    anuncios_por_clave = defaultdict(list)
    for anuncio in Ad.query.filter(Ad.clave.isnot(None)).all():
        anuncios_por_clave[anuncio.clave].append(anuncio)
    meta_por_clave = defaultdict(list)
    for meta in MetaAnuncio.query.filter(MetaAnuncio.clave.isnot(None)).all():
        meta_por_clave[meta.clave].append(meta)
    con_movimiento = set(entrantes) | set(agendas) | set(ventas) | set(gasto)
    escrituras = _como_se_escribe(con_movimiento - set(anuncios_por_clave) - {None})

    filas = []
    for clave in con_movimiento:
        e, a, v = entrantes.get(clave), agendas.get(clave), ventas.get(clave)
        g = gasto.get(clave, {})
        suyos = anuncios_por_clave.get(clave, [])
        vigente = _vigente(suyos)
        de_meta = meta_por_clave.get(clave, [])
        dias = defaultdict(lambda: [0, 0, 0.0, 0])
        for fecha, (n, calif) in (e['dias'].items() if e else ()):
            dias[fecha][0], dias[fecha][1] = n, calif
        for fecha, monto in g.items():
            dias[fecha][2] = round(monto, 2)
        for fecha, n in (a['dias'].items() if a else ()):
            dias[fecha][3] = n
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
            'agendas': a['agendas'] if a else 0,
            'ventas': v['ventas'] if v else 0,
            'cobrado': v['cobrado'] if v else 0.0,
            'gasto': sum(g.values()),
            'dias': {fecha: valores for fecha, valores in sorted(dias.items())},
        }))
    filas.sort(key=lambda f: (f['clave'] is None, -f['entrantes'], -f['gasto'], f['nombre']))

    totales = metricas({k: sum(f[k] for f in filas) for k in SUMABLES})
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
    }


def _como_se_escribe(claves):
    """{clave: la escritura más usada en los webhooks}: el nombre de una palabra clave que llegó antes
    de que existiera el anuncio (no tiene uno de donde sacarlo)."""
    if not claves:
        return {}
    conteo = defaultdict(Counter)
    for keyword, n in db.session.query(LeadAnswer.keyword, func.count(LeadAnswer.id)) \
            .filter(LeadAnswer.keyword.isnot(None)).group_by(LeadAnswer.keyword):
        clave = clave_de(keyword) if es_keyword_valida(keyword) else None
        if clave in claves:
            conteo[clave][keyword.strip()] += n
    return {clave: c.most_common(1)[0][0] for clave, c in conteo.items()}


# --- Escritura -----------------------------------------------------------------------------------

def archivar(clave, archivado):
    """Esconde (o vuelve a mostrar) una palabra clave en el tablero. Si llegó antes de que existiera su
    anuncio, se lo crea para poder guardar la marca. Hace commit."""
    if not clave:
        raise ValueError('Falta la palabra clave.')
    anuncios = Ad.query.filter(Ad.clave == clave).all()
    if not anuncios:
        escritura = _como_se_escribe({clave}).get(clave, clave)
        anuncio = anuncio_de_keyword(escritura)
        if not anuncio:
            raise ValueError('Esa palabra clave no existe.')
        anuncios = [anuncio]
    for anuncio in anuncios:
        anuncio.status = 'archived' if archivado else 'active'
    db.session.commit()
    return {'clave': clave, 'archivado': bool(archivado)}
