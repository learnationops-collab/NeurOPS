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
  · **Agendas y show up**: las `FinancialAgenda` (el libro de agendas) creadas en el período, una por
    persona, con la fuente que dice su `nombre`. Show up: la persona asistió a alguna de sus agendas.
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
from collections import Counter
from datetime import datetime, time

from app import db
from app.models import FinancialAgenda
from app.services.fuente_service import FUENTE_SETTING, es_workshop_landing, es_workshop_vivo, normalizar
from app.services.procedencia_ingresos_service import (
    agendas_para_atribuir,
    procedencia_por_venta,
    setters_conocidos,
)

FUENTES = (
    {'key': 'setting', 'label': 'Setting'},
    {'key': 'workshop', 'label': 'Workshop'},
)

# Lo que hay en `FinancialAgenda.nombre` y no es una fuente de lead (mismas exclusiones que `fuente_de`).
_NO_ES_FUENTE = ('s/f', 'n/a', '')
_NO_ES_FUENTE_SI_CONTIENE = ('entrevista', 'diagnostica', 'diagnóstica')
_ASISTIO = ('show up', 'asistio')


def dividir(numerador, denominador, decimales=2):
    """Cociente redondeado, o None si no hay denominador (nunca un 0 que parezca dato)."""
    return round(numerador / denominador, decimales) if denominador else None


def metricas_de_fuente(base):
    """Completa las cifras de una fuente con los costos y el ROAS doble. Sin gasto, los costos y los
    dos ROAS son None; sin denominador, el costo correspondiente."""
    gasto = round(base.get('gasto', 0.0), 2)
    con_gasto = gasto > 0
    new_cash, cash_total = round(base.get('new_cash', 0.0), 2), round(base.get('cash_total', 0.0), 2)
    return {
        **base,
        'gasto': gasto,
        'new_cash': new_cash,
        'cash_total': cash_total,
        'pct_show_up': dividir(base.get('show_up', 0) * 100, base.get('agendas', 0), 1),
        'pct_upsell': dividir(base.get('clientes_upsell', 0) * 100, base.get('clientes', 0), 1),
        'cpl': dividir(gasto, base.get('leads', 0)) if con_gasto else None,
        'costo_agenda': dividir(gasto, base.get('agendas', 0)) if con_gasto else None,
        'costo_venta': dividir(gasto, base.get('ventas', 0)) if con_gasto else None,
        'roas_new_cash': dividir(new_cash, gasto) if con_gasto else None,
        'roas_total': dividir(cash_total, gasto) if con_gasto else None,
    }


def fuente_de_cobro(por_clave, balde):
    """'setting', 'workshop' o None (otras) para un cobro: una palabra clave de ManyChat lo hace de
    Setting; si no, el balde de origen de `procedencia_por_venta(por_origen=True)`."""
    if por_clave or balde == 'setting':
        return 'setting'
    return 'workshop' if balde == 'workshop' else None


def sumar_cobros(cobros):
    """{fuente: {new_cash, cash_total, ventas, cuotas, cuotas_monto, upsells, upsells_monto, clientes,
    clientes_upsell}} y el resto en `otras` (cash_total).

    `cobros`: dicts `{monto, es_venta, es_cuota, es_upsell, cliente, por_clave, balde}`. Un reembolso (monto
    negativo) resta, como en el Cash collected."""
    fuentes = {f['key']: {'new_cash': 0.0, 'cash_total': 0.0, 'ventas': 0, 'cuotas': 0, 'cuotas_monto': 0.0,
                          'upsells': 0, 'upsells_monto': 0.0}
               for f in FUENTES}
    clientes = {f['key']: set() for f in FUENTES}
    compran_upsell = {f['key']: set() for f in FUENTES}
    otras = {'cash_total': 0.0, 'cobros': 0}
    for c in cobros:
        monto = float(c['monto'] or 0)
        destino = fuente_de_cobro(c['por_clave'], c['balde'])
        if destino is None:
            otras['cash_total'] += monto
            otras['cobros'] += 1
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
        elif c['es_cuota']:
            fila['cuotas'] += 1
            fila['cuotas_monto'] += monto
    for k, fila in fuentes.items():
        fila['clientes'], fila['clientes_upsell'] = len(clientes[k]), len(compran_upsell[k])
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
                      'por_clave': bool(claves.get(cobro.id)), 'balde': baldes[cobro.id][0]})
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


def agendas_por_fuente(desde, hasta):
    """{fuente: {agendas, show_up, dias: {fecha: agendas}}}: las agendas creadas en el período, una por
    persona (las repetidas de una reprogramación no suman) y show up si asistió a alguna."""
    inicio, fin = datetime.combine(desde, time.min), datetime.combine(hasta, time.max)
    setters = setters_conocidos()
    filas = db.session.query(
        FinancialAgenda.id, FinancialAgenda.nombre, FinancialAgenda.estado, FinancialAgenda.created_at,
        FinancialAgenda.person_uuid,
    ).filter(FinancialAgenda.created_at >= inicio, FinancialAgenda.created_at <= fin,
             FinancialAgenda.duplicada_de_id.is_(None), FinancialAgenda.descartada_at.is_(None)) \
        .order_by(FinancialAgenda.created_at, FinancialAgenda.id).all()

    por_persona = {}
    for f in filas:
        fuente = fuente_de_agenda(f.nombre, setters)
        if not fuente:
            continue
        persona = por_persona.setdefault((fuente, f.person_uuid or f'agenda-{f.id}'),
                                         {'dia': f.created_at.date().isoformat(), 'asistio': False})
        persona['asistio'] = persona['asistio'] or normalizar(f.estado) in _ASISTIO

    salida = {f['key']: {'agendas': 0, 'show_up': 0, 'dias': Counter()} for f in FUENTES}
    for (fuente, _), p in por_persona.items():
        salida[fuente]['agendas'] += 1
        salida[fuente]['show_up'] += 1 if p['asistio'] else 0
        salida[fuente]['dias'][p['dia']] += 1
    return salida


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


def resumen(desde, hasta, filas, cobros, claves, embudos):
    """Las dos fuentes con todas sus cifras, para el hub de Marketing.

    `filas` son las del tablero (leads de Setting), `cobros` y `claves` los del período con su palabra
    clave (`anuncios_service.claves_de_cobros`) y `embudos` el gasto de Meta por embudo."""
    cobros_fuente, otras = sumar_cobros(_cobros_para_sumar(cobros, claves))
    agendas = agendas_por_fuente(desde, hasta)
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
            'leads': leads[k], 'gasto': meta['gasto'], 'anuncios': meta['anuncios'],
            'agendas': agendas[k]['agendas'], 'show_up': agendas[k]['show_up'],
            'agendas_dias': dict(sorted(agendas[k]['dias'].items())),
        }))
    return {'fuentes': salida, 'otras': {'cash_total': round(otras['cash_total'], 2), 'cobros': otras['cobros']},
            'sin_campana': sin_campana(filas, (gasto_de.get('setting') or {}).get('gasto', 0.0))}
