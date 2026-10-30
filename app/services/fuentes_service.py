"""Marketing por FUENTE: Setting vs Workshop, con ROAS doble (Kerwin, 23/10/2026).

Cada fuente trae las mismas cifras para poder compararlas: leads entrantes, importe gastado, agendas,
show up, ventas, cuotas cobradas, cash y los costos.

**De dónde sale cada cifra**

  · **Origen del cobro** (a qué fuente se le suma la plata): el mismo del dashboard comercial y de
    Finanzas («Ingresos por fuente», `procedencia_ingresos_service`), pero por ORIGEN DEL CLIENTE y no
    por tipo de pago: una cuota, un upsell o una renovación de alguien que llegó por Setting suman a
    Setting (la procedencia común los manda a «Fulfillment»; acá `por_origen=True`). Si el cobro se
    atribuye a una palabra clave de ManyChat es de Setting; si no, manda la agenda que originó el
    pago (workshop vivo o grabación → Workshop; un setter → Setting). Lo demás (VSL, Fulfillment,
    sin procedencia) no es de ninguna de las dos y queda en `otras`.
  · **Base**: cash BRUTO, como el «Cash collected» del dashboard comercial y la tabla de Marketing.
  · **Agendas y show up**: por fecha de ALTA o de REUNIÓN, a elección (`conteo_agendas_service`: ahí está
    la definición de cada una y de las tres fuentes, Setting, Workshop y Otras). Show up: asistieron ÷ citas
    con resultado (asistieron + no show), igual que Workshop. Los costos van siempre por fecha de alta.
  · **Leads entrantes**: Setting, las personas que escribieron una palabra clave (la tabla de abajo);
    Workshop, los clics al grupo de WhatsApp desde las landings de sus anuncios.
  · **Importe gastado**: el gasto de Meta de los anuncios del embudo (`meta_ads_service.gasto_por_embudo`).

**ROAS doble**

    ROAS New Cash = new_cash   / importe gastado
    ROAS Total    = cash_total / importe gastado

  · `new_cash`: lo cobrado del período en pagos de VENTA NUEVA —pago completo o split (`REAL_SALE_TIPOS`),
    PIF + splits—, la misma regla de «Nuevas Ventas (New Cash)» y de las Ventas de la tabla.
  · `cash_total`: TODO lo cobrado del período de los clientes que trajo la fuente: venta nueva, cuotas,
    señas, upsells y renovaciones, aunque la venta sea de meses anteriores.
  Siempre `cash_total >= new_cash`. Sin gasto no hay ROAS (None, «—»): un 0 diría que no rindió.
  · `cash_anterior`: la parte del `cash_total` que viene de ventas de períodos anteriores (cuotas, upsells y
    renovaciones de clientes que no compraron nada nuevo en el período). Es lo que separa el ROAS Total del ROAS
    New Cash: se muestra para que el 6x de un mes no se lea como si fuera todo de ese mes (Leadership 850).

**Upsells** (Kerwin, 23/10/2026: «quién upsellea más»): un cobro cuyo tipo de pago es `upsell`
(`SheetsService.parse_tipo_pago`), por origen del cliente igual que el resto. Se muestran la cantidad y el
monto, y el % de clientes que compran un upsell = clientes con algún upsell cobrado en el período ÷
clientes con algún cobro en el período de esa fuente. (Definición propia, a confirmar con Kerwin.)

**Sin campaña** (24/10/2026): `sin_campana` avisa de las palabras clave con gasto, y anuncios activos en Meta
o entrantes, que no están en una campaña vigente del Inbox; al apagar ManyChat sus leads dejan de contarse.

Costos: costo por lead, por agenda y por venta = importe gastado ÷ (leads | agendas | ventas); sin
denominador o sin gasto, None. «Ventas» cuenta pagos de venta nueva (como el close rate), no el ticket
agrupado de `ticket_service`.
"""
from app import db
from app.services import conteo_agendas_service
from app.services.marketing_formulas import aplicar, dividir  # noqa: F401  (`dividir` lo importan otros módulos desde acá)
from app.services.fuente_service import FUENTE_SETTING, es_workshop_landing, es_workshop_vivo, normalizar
from app.services.procedencia_ingresos_service import (
    PROCEDENCIAS,
    agendas_para_atribuir,
    procedencia_por_venta,
)

FUENTES = (
    {'key': 'setting', 'label': 'Setting'},
    {'key': 'workshop', 'label': 'Workshop'},
)

# Lo que hay en `FinancialAgenda.nombre` y no es una fuente de lead (mismas exclusiones que `fuente_de`).
_NO_ES_FUENTE = ('s/f', 'n/a', '')
_NO_ES_FUENTE_SI_CONTIENE = ('entrevista', 'diagnostica', 'diagnóstica')


def metricas_de_fuente(base):
    """Completa las cifras de una fuente con los costos, el ticket y el ROAS doble (`marketing_formulas`): las
    mismas cuentas que las filas de palabras clave. Sin gasto, los costos y los dos ROAS son None; sin
    denominador, el costo correspondiente."""
    # None cuando no se sabe (un segmento elegido: ahí la cifra sale de otra cuenta).
    anterior = base.get('cash_anterior')
    redondeada = {
        **base,
        'gasto': round(base.get('gasto', 0.0), 2),
        'new_cash': round(base.get('new_cash', 0.0), 2),
        'cash_total': round(base.get('cash_total', 0.0), 2),
        'cash_anterior': None if anterior is None else round(anterior, 2),
    }
    return {**redondeada, **aplicar(redondeada)}


def fuente_de_cobro(por_clave, balde):
    """'setting', 'workshop' o None (otras) para un cobro: una palabra clave de ManyChat lo hace de
    Setting; si no, el balde de origen de `procedencia_por_venta(por_origen=True)`."""
    if por_clave or balde == 'setting':
        return 'setting'
    return 'workshop' if balde == 'workshop' else None


def clientes_nuevos(filas):
    """Los clientes que compraron algo nuevo en el período: sus cuotas y upsells son «de esta venta». Las de los
    demás son cobros de ventas de antes. Una sola regla para la cifra (`cash_anterior`) y para su lista."""
    return {f['cliente'] for f in filas if f['es_venta']}


def sumar_cobros(cobros):
    """{fuente: {new_cash, cash_total, cash_anterior, ventas, clientes_nuevos (personas), cuotas, cuotas_monto, upsells, upsells_monto,
    clientes, clientes_upsell}} y el resto en `otras` (cash_total, cobros y su `detalle` por procedencia).

    `cobros`: dicts `{monto, es_venta, es_cuota, es_upsell, cliente, por_clave, balde}`. Un reembolso (monto
    negativo) resta, como en el Cash collected."""
    fuentes = {f['key']: {'new_cash': 0.0, 'cash_total': 0.0, 'cash_anterior': 0.0, 'ventas': 0, 'cuotas': 0,
                          'cuotas_monto': 0.0, 'upsells': 0, 'upsells_monto': 0.0}
               for f in FUENTES}
    clientes = {f['key']: set() for f in FUENTES}
    compran_upsell = {f['key']: set() for f in FUENTES}
    otras = {'cash_total': 0.0, 'cobros': 0, 'new_cash': 0.0, 'ventas': 0}
    por_procedencia = {}
    # Lo cobrado sin venta nueva, por cliente: es «anterior» si el cliente no compró nada en el período.
    sin_venta = {f['key']: {} for f in FUENTES}
    for c in cobros:
        monto = float(c['monto'] or 0)
        destino = fuente_de_cobro(c['por_clave'], c['balde'])
        if destino is None:
            otras['cash_total'] += monto
            otras['cobros'] += 1
            parcial = por_procedencia.setdefault(c['balde'], {'cobros': 0, 'monto': 0.0})
            parcial['cobros'] += 1
            parcial['monto'] += monto
            if c['es_venta']:
                otras['new_cash'] += monto
                otras['ventas'] += 1
            continue
        fila = fuentes[destino]
        fila['cash_total'] += monto
        clientes[destino].add(c['cliente'])
        if c['es_upsell']:
            fila['upsells'] += 1
            fila['upsells_monto'] += monto
            compran_upsell[destino].add(c['cliente'])
        if c['es_venta']:
            fila['new_cash'] += monto
            fila['ventas'] += 1
        else:
            sin_venta[destino][c['cliente']] = sin_venta[destino].get(c['cliente'], 0.0) + monto
            if c['es_cuota']:
                fila['cuotas'] += 1
                fila['cuotas_monto'] += monto
    for k, fila in fuentes.items():
        fila['clientes'], fila['clientes_upsell'] = len(clientes[k]), len(compran_upsell[k])
        nuevos = clientes_nuevos(c for c in cobros if fuente_de_cobro(c['por_clave'], c['balde']) == k)
        fila['clientes_nuevos'] = len(nuevos)
        fila['cash_anterior'] = sum(m for cliente, m in sin_venta[k].items() if cliente not in nuevos)
    etiquetas = {p['key']: p['label'] for p in PROCEDENCIAS}
    otras['detalle'] = [{'key': b, 'label': etiquetas.get(b, b), 'cobros': v['cobros'], 'monto': round(v['monto'], 2)}
                        for b, v in sorted(por_procedencia.items(), key=lambda x: -x[1]['monto'])]
    return fuentes, otras


def _cobros_para_sumar(cobros, claves):
    """Los cobros del período como los espera `sumar_cobros`, con el balde por ORIGEN del cliente."""
    from app.services.comercial_service import ComercialService, clientes_de_ventas

    cliente_de = clientes_de_ventas(cobros)
    baldes = procedencia_por_venta(cobros, contexto=cobros, agendas=agendas_para_atribuir(), por_origen=True)
    filas = []
    for cobro in cobros:
        _programa, tipo, es_venta = ComercialService.clasificar_venta(cobro)
        filas.append({'monto': round(float(cobro.monto or 0), 2), 'es_venta': es_venta, 'es_cuota': tipo == 'cuota',
                      'es_upsell': tipo == 'upsell', 'cliente': cliente_de.get(cobro.id) or f'cobro-{cobro.id}',
                      'por_clave': bool(claves.get(cobro.id)), 'balde': baldes[cobro.id][0],
                      # El rótulo del detalle de su procedencia (el setter, En vivo, Grabación…): el «origen» de Segmentos.
                      'detalle': baldes[cobro.id][2]})
    return filas


def fuente_de_agenda(nombre, setters):
    """'setting', 'workshop' o None para el `nombre` (la fuente) de una agenda."""
    bajo = (nombre or '').strip().lower()
    if bajo in _NO_ES_FUENTE or any(p in bajo for p in _NO_ES_FUENTE_SI_CONTIENE):
        return None
    if es_workshop_landing(nombre) or es_workshop_vivo(nombre):
        return 'workshop'
    normal = normalizar(nombre)
    return 'setting' if normal in setters or normal == FUENTE_SETTING else None


def _leads_de_workshop(desde, hasta):
    """Clics al grupo de WhatsApp desde las landings de los anuncios de Workshop (cómo entra un lead)."""
    from app.services import workshop_meta_service
    return workshop_meta_service.desglose_periodo(desde, hasta)['totales']['clics_whatsapp']


def claves_con_campana():
    """Las palabras clave que hoy están en alguna campaña vigente del Inbox (de cualquier embudo)."""
    from app.automatizaciones.modelos import AutCampana, AutCampanaPalabra, ahora

    momento = ahora()
    filas = db.session.query(AutCampanaPalabra.clave).join(AutCampana, AutCampana.id == AutCampanaPalabra.campana_id) \
        .filter(AutCampana.desde <= momento, db.or_(AutCampana.hasta.is_(None), AutCampana.hasta > momento))
    return {clave for (clave,) in filas}


def sin_campana(filas, gasto_setting):
    """Palabras clave con gasto en el período, y anuncios activos en Meta o entrantes en el período, que NO
    están en una campaña vigente del Inbox (Kerwin, 24/10/2026). Cuando se apague
    ManyChat sus leads dejan de contarse: el CPL de Setting se ve más alto y el ROAS, más bajo. Se corta
    sola al crear la campaña. {palabras: [{clave, nombre, gasto, entrantes}], gasto, pct_gasto}, por gasto."""
    candidatas = [f for f in filas if f['clave'] and f['gasto'] > 0 and not f['archivado']
                  and ((f.get('meta') or {}).get('activos') or f['entrantes'] > 0)]
    cubiertas = claves_con_campana() if candidatas else set()
    palabras = sorted(({'clave': f['clave'], 'nombre': f['nombre'], 'gasto': round(f['gasto'], 2),
                        'entrantes': f['entrantes']} for f in candidatas if f['clave'] not in cubiertas),
                      key=lambda p: -p['gasto'])
    gasto = round(sum(p['gasto'] for p in palabras), 2)
    return {'palabras': palabras, 'gasto': gasto, 'pct_gasto': dividir(gasto * 100, gasto_setting, 1)}


def resumen(desde, hasta, filas, cobros, claves, embudos, base=conteo_agendas_service.BASE_POR_DEFECTO):
    """Las dos fuentes con todas sus cifras, para el hub de Marketing.

    `filas` son las del tablero (leads de Setting), `cobros` y `claves` los del período con su palabra
    clave (`anuncios_service.claves_de_cobros`) y `embudos` el gasto de Meta por embudo. `base`: por qué
    fecha se cuentan las agendas (`conteo_agendas_service`); los costos van siempre por fecha de alta."""
    base = conteo_agendas_service.base_de(base)
    cobros_fuente, otras = sumar_cobros(_cobros_para_sumar(cobros, claves))
    agendas = conteo_agendas_service.por_fuente(desde, hasta, base)
    agendas_alta = agendas if base == 'alta' else conteo_agendas_service.por_fuente(desde, hasta, 'alta')
    gasto_de = {e['embudo']: e for e in embudos}
    leads = {
        'setting': sum(f['entrantes'] for f in filas if not f['archivado']),
        'workshop': _leads_de_workshop(desde, hasta),
    }
    salida = []
    for f in FUENTES:
        k = f['key']
        meta = gasto_de.get(k) or {'gasto': 0.0, 'anuncios': 0}
        salida.append(metricas_de_fuente({
            **f, **cobros_fuente[k],
            'leads': leads[k], 'leads_meta': meta.get('leads', 0), 'gasto': meta['gasto'], 'anuncios': meta['anuncios'],
            'agendas': agendas[k]['agendas'], 'show_up': agendas[k]['show_up'],
            'reportadas': agendas[k]['reportadas'], 'agendas_alta': agendas_alta[k]['agendas'],
            'agendas_dias': agendas[k]['dias'],
        }))
    otras_agendas = agendas['otras']
    return {'base': base, 'fuentes': salida,
            'otras': {'agendas': otras_agendas['agendas'], 'show_up': otras_agendas['show_up'],
                      'reportadas': otras_agendas['reportadas'], 'agendas_dias': otras_agendas['dias'],
                      'agendas_alta': agendas_alta['otras']['agendas'],
                      'pct_show_up': dividir(otras_agendas['show_up'] * 100, otras_agendas['reportadas'], 1),
                      # De dónde viene cada agenda de Otras (VSL, Momentum, Referido, Setter genérico…); cada grupo abre su lista.
                      'origenes': [{'origen': o, **v, 'pct_show_up': dividir(v['show_up'] * 100, v['reportadas'], 1),
                                    'pct_agendas': dividir(v['agendas'] * 100, otras_agendas['agendas'], 1)}
                                   for o, v in sorted(otras_agendas['origenes'].items(), key=lambda x: (-x[1]['agendas'], x[0]))],
                      'cash_total': round(otras['cash_total'], 2), 'new_cash': round(otras['new_cash'], 2),
                      'ventas': otras['ventas'], 'cobros': otras['cobros'], 'detalle': otras['detalle']},
            # Lo que suman las tres, en la base elegida: es el total de Closing, Analizar y Revisar en reunión.
            'agendas_total': sum(a['agendas'] for a in agendas.values()),
            'sin_campana': sin_campana(filas, (gasto_de.get('setting') or {}).get('gasto', 0.0))}
