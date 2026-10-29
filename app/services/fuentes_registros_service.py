"""Los registros detrás de cada cifra de una fuente (Setting o Workshop) en Marketing.

Pedido de Kerwin (28/10/2026): cualquier cifra se abre en la lista de lo que la suma, para poder verificarla.
Cada lista sale del MISMO código que la cifra (`conteo_agendas_service.personas` y `_cobros_para_sumar`),
no de una consulta parecida: la suma de la lista es la cifra. Las agendas se cuentan por fecha de alta o de
reunión (`base`); Otras es lo que no es de Setting ni de Workshop (solo agendas y cobros: no tiene leads ni gasto).

  · agendas   las agendas del período en la base elegida (con «Asistió» y «Con resultado»).
  · agendas_alta   las mismas por fecha de alta, siempre: el denominador de los costos y del ROAS.
  · reportadas las que tienen resultado: la base del % de show up.
  · show_up   las que asistieron.
  · ventas / new_cash   los pagos de venta nueva del período (su suma es el New Cash).
  · cash_total   todos los cobros de la fuente, y de cuáles son de una venta anterior.
  · leads   Setting: las personas que entraron por una palabra clave (con su calificación); Workshop: los clics al
    grupo de WhatsApp, por campaña.
  · gasto   el gasto de Meta de los anuncios del embudo de la fuente, anuncio por anuncio.
"""
from collections import defaultdict

from app import db
from app.models import Ad, Conversation, MetaAnuncio, MetaGastoDiario
from app.services import anuncios_service, conteo_agendas_service, fuentes_service, workshop_meta_service
from app.services.comercial_service import ComercialService

METRICAS = ('agendas', 'agendas_alta', 'reportadas', 'show_up', 'ventas', 'new_cash', 'cash_total', 'leads', 'gasto')

TIPOS = {'cuota': 'Cuota', 'sena': 'Seña', 'seña': 'Seña', 'renovacion': 'Renovación', 'upsell': 'Upsell'}

_COLUMNAS_AGENDAS = [
    {'key': 'persona', 'header': 'Persona', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'alta', 'header': 'Alta', 'tipo': 'fecha', 'ancho': '110px'},
    {'key': 'cita', 'header': 'Cita', 'tipo': 'fecha', 'ancho': '150px'},
    {'key': 'origen', 'header': 'Fuente', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)', 'oculta': True},
    {'key': 'closer', 'header': 'Closer', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)'},
    {'key': 'estado', 'header': 'Estado', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)'},
    {'key': 'asistio', 'header': 'Asistió', 'tipo': 'si_no', 'ancho': '90px'},
    {'key': 'con_resultado', 'header': 'Con resultado', 'tipo': 'si_no', 'ancho': '120px', 'oculta': True},
]

_COLUMNAS_COBROS = [
    {'key': 'fecha', 'header': 'Fecha', 'tipo': 'fecha', 'ancho': '120px'},
    {'key': 'cliente', 'header': 'Cliente', 'tipo': 'texto', 'ancho': 'minmax(160px,1.6fr)'},
    {'key': 'monto', 'header': 'Monto', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'tipo', 'header': 'Tipo', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'origen', 'header': 'De dónde viene', 'tipo': 'texto', 'ancho': 'minmax(210px,1.4fr)'},
    {'key': 'medio', 'header': 'Medio', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)', 'oculta': True},
    {'key': 'clave', 'header': 'Palabra clave', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)'},
]


_COLUMNAS_LEADS_SETTING = [
    {'key': 'persona', 'header': 'Persona', 'tipo': 'texto', 'ancho': 'minmax(160px,1.5fr)'},
    {'key': 'instagram', 'header': 'Instagram', 'tipo': 'texto', 'ancho': 'minmax(130px,1fr)', 'oculta': True},
    {'key': 'clave', 'header': 'Palabra clave', 'tipo': 'texto', 'ancho': 'minmax(130px,1fr)'},
    {'key': 'fecha', 'header': 'Entró', 'tipo': 'fecha', 'ancho': '150px'},
    {'key': 'estado', 'header': 'Estado', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)'},
    {'key': 'setter', 'header': 'Setter', 'tipo': 'texto', 'ancho': 'minmax(100px,1fr)', 'oculta': True},
]

_COLUMNAS_LEADS_WORKSHOP = [
    {'key': 'campana', 'header': 'Campaña', 'tipo': 'texto', 'ancho': 'minmax(220px,2fr)'},
    {'key': 'visitas', 'header': 'Visitas a la landing', 'tipo': 'numero', 'ancho': '150px'},
    {'key': 'clics', 'header': 'Clics al grupo', 'tipo': 'numero', 'ancho': '130px'},
    {'key': 'gasto', 'header': 'Gastado', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'por_clic', 'header': 'Por clic al grupo', 'tipo': 'dinero', 'ancho': '140px'},
]

_COLUMNAS_GASTO = [
    {'key': 'anuncio', 'header': 'Anuncio', 'tipo': 'texto', 'ancho': 'minmax(200px,2fr)'},
    {'key': 'campana', 'header': 'Campaña', 'tipo': 'texto', 'ancho': 'minmax(160px,1.4fr)'},
    {'key': 'clave', 'header': 'Palabra clave', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)'},
    {'key': 'gasto', 'header': 'Gastado', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'dias', 'header': 'Días con gasto', 'tipo': 'numero', 'ancho': '130px'},
    {'key': 'estado', 'header': 'Estado en Meta', 'tipo': 'texto', 'ancho': '130px', 'oculta': True},
]

ESTADO_ENTRANTE = {'true': 'Calificado', 'false': 'Descalificado'}


def _si_no(valor):
    return 'Sí' if valor else 'No'


def _agendas(fuente, metrica, desde, hasta, base, origen=None):
    base = 'alta' if metrica == 'agendas_alta' else conteo_agendas_service.base_de(base)
    todas = conteo_agendas_service.personas(desde, hasta, base)
    # En reunión el show up cuenta leads, una fila por lead y en una sola fuente (`por_lead`).
    personas = [p for p in (conteo_agendas_service.por_lead(todas) if base == 'reunion' and metrica in ('show_up', 'reportadas')
                            else todas) if p['fuente'] == fuente]
    if origen:  # solo las de un grupo de origen (`conteo_agendas_service.categoria_de_origen`)
        personas = [p for p in personas if conteo_agendas_service.categoria_de_origen(p['origen']) == origen]
    if metrica == 'show_up':
        personas = [p for p in personas if p['asistio']]
    elif metrica == 'reportadas':
        personas = [p for p in personas if p['con_resultado']]
    filas = [{
        'id': f"{p['agenda_id']}", 'persona': p['persona'] or 'Sin nombre', 'alta': p['alta'],
        'cita': p['cita'], 'origen': p['origen'] or '—', 'closer': p['closer'] or '—',
        'estado': p['estado'] or '—', 'asistio': _si_no(p['asistio']), 'con_resultado': _si_no(p['con_resultado']),
        '_dia': p['dia'],
    } for p in personas]
    filas.sort(key=lambda f: f['_dia'], reverse=True)
    for f in filas:
        del f['_dia']
    asistieron = sum(1 for f in filas if f['asistio'] == 'Sí')
    unidad = 'leads' if base == 'reunion' and metrica in ('show_up', 'reportadas') else 'personas'
    por = conteo_agendas_service.ETIQUETA_BASE[base]
    if metrica in ('agendas', 'agendas_alta'):
        resumen = f"{len(filas)} agendas por {por}"
    elif metrica == 'reportadas':
        resumen = f"{len(filas)} {unidad} con resultado · {asistieron} asistieron"
    else:
        resumen = f"{len(filas)} {unidad} asistieron"
    if origen:
        resumen += f" · {origen}"
    # En Otras el origen es lo que se quiere ver: la columna va a la vista (en Setting y Workshop es siempre la misma).
    columnas = [{**c, 'header': 'Origen', 'oculta': False} if c['key'] == 'origen' else c for c in _COLUMNAS_AGENDAS] \
        if fuente == 'otras' else _COLUMNAS_AGENDAS
    return columnas, filas, resumen


def _cobros(fuente, metrica, desde, hasta):
    desde_dt, hasta_dt = anuncios_service._limites(desde, hasta)
    _por_clave, _sin, cobros, _sin_clave, claves = anuncios_service._ventas(
        desde_dt, hasta_dt, anuncios_service._clave_de_cada_anuncio())
    de_cobro = fuentes_service._cobros_para_sumar(cobros, claves)
    destino = None if fuente == 'otras' else fuente  # Otras: los cobros que no son de Setting ni de Workshop
    pares = [(c, f) for c, f in zip(cobros, de_cobro)
             if fuentes_service.fuente_de_cobro(f['por_clave'], f['balde']) == destino]
    # Clientes que compraron algo nuevo en el período: sus cuotas y upsells son «de esta venta». Las otras
    # son cobros de ventas de antes (lo que separa el ROAS Total del ROAS New Cash).
    nuevos = {f['cliente'] for _, f in pares if f['es_venta']}
    filas, suma = [], 0.0
    for cobro, f in pares:
        if metrica in ('ventas', 'new_cash') and not f['es_venta']:
            continue
        _programa, tipo, es_venta = ComercialService.clasificar_venta(cobro)
        if es_venta:
            origen = 'Venta nueva del período'
        elif f['cliente'] in nuevos:
            origen = f"{TIPOS.get(tipo, 'Cobro')} de una venta nueva de este período"
        else:
            origen = f"{TIPOS.get(tipo, 'Cobro')} de una venta anterior"
        monto = round(float(cobro.monto or 0), 2)
        suma += monto
        filas.append({
            'id': str(cobro.id), 'fecha': cobro.date.isoformat() if cobro.date else '',
            'cliente': cobro.nombre_cliente or 'Sin nombre', 'monto': monto,
            'tipo': 'Venta nueva' if es_venta else TIPOS.get(tipo, 'Otro'), 'origen': origen,
            'medio': cobro.metodo_pago or '—', 'clave': claves.get(cobro.id) or '—',
        })
    filas.sort(key=lambda r: r['fecha'], reverse=True)
    anteriores = round(sum(r['monto'] for r in filas if 'anterior' in r['origen']), 2)
    resumen = f"{len(filas)} cobros · ${suma:,.2f}"
    if metrica == 'cash_total' and anteriores:
        resumen += f" · ${anteriores:,.2f} de ventas anteriores"
    return _COLUMNAS_COBROS, filas, resumen


def _claves_archivadas():
    """Las palabras clave cuyos anuncios están todos archivados: la tabla de Marketing no las suma."""
    estados = defaultdict(list)
    for clave, estado in db.session.query(Ad.clave, Ad.status).filter(Ad.clave.isnot(None)):
        estados[clave].append((estado or '').lower() == 'archived')
    return {clave for clave, archivados in estados.items() if all(archivados)}


def _leads(fuente, metrica, desde, hasta):
    if fuente == 'workshop':
        campanas = workshop_meta_service.desglose_periodo(desde, hasta)['campanas']
        filas = [{'id': str(c['campana_id']), 'campana': c['nombre'] or 'Sin nombre', 'visitas': c['visitas'],
                  'clics': c['clics_whatsapp'], 'gasto': round(c['gasto'], 2), 'por_clic': c['costo_whatsapp'] or 0}
                 for c in campanas if c['clics_whatsapp'] or c['visitas']]
        total = sum(f['clics'] for f in filas)
        return _COLUMNAS_LEADS_WORKSHOP, filas, f"{total} clics al grupo de WhatsApp en {len(filas)} campañas"
    desde_dt, hasta_dt = anuncios_service._limites(desde, hasta)
    archivadas = _claves_archivadas()
    entradas = [e for e in anuncios_service.entradas_del_periodo(desde_dt, hasta_dt, anuncios_service._clave_de_cada_anuncio())
                if e['clave'] not in archivadas]
    conversaciones = {c.id: c for c in Conversation.query.filter(Conversation.id.in_({e['lead_id'] for e in entradas}))} \
        if entradas else {}
    filas = []
    for e in entradas:
        c = conversaciones.get(e['lead_id'])
        estado = ESTADO_ENTRANTE.get(e['calificacion']) or ('En conversación' if e['respondio'] else 'Sin respuesta')
        filas.append({
            'id': f"{e['lead_id']}-{e['clave'] or 'sin'}", 'persona': (c.name if c and c.name else None) or (f'@{c.ig}' if c and c.ig else 'Sin nombre'),
            'instagram': (c.ig if c else '') or '—', 'clave': e['clave'] or 'Sin palabra clave',
            'fecha': e['cuando'].isoformat(), 'estado': estado, 'setter': (c.setter if c else '') or '—',
        })
    filas.sort(key=lambda f: f['fecha'], reverse=True)
    cuenta = defaultdict(int)
    for f in filas:
        cuenta[f['estado']] += 1
    detalle = ' · '.join(f'{n:,} {k.lower()}' for k, n in sorted(cuenta.items(), key=lambda kv: -kv[1]))
    return _COLUMNAS_LEADS_SETTING, filas, f"{len(filas):,} entradas por palabra clave · {detalle}"


def _gasto(fuente, metrica, desde, hasta):
    filas_db = db.session.query(
        MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.campana, MetaAnuncio.clave, MetaAnuncio.estado,
        db.func.sum(MetaGastoDiario.gasto), db.func.count(MetaGastoDiario.fecha),
    ).join(MetaGastoDiario, MetaGastoDiario.meta_ad_id == MetaAnuncio.meta_ad_id) \
        .filter(MetaAnuncio.embudo == fuente, MetaGastoDiario.fecha >= desde, MetaGastoDiario.fecha <= hasta,
                MetaGastoDiario.gasto > 0) \
        .group_by(MetaAnuncio.meta_ad_id, MetaAnuncio.nombre, MetaAnuncio.campana, MetaAnuncio.clave, MetaAnuncio.estado).all()
    filas = [{'id': str(ad_id), 'anuncio': nombre or 'Sin nombre', 'campana': campana or '—', 'clave': clave or '—',
              'gasto': round(float(gasto or 0), 2), 'dias': dias, 'estado': estado or '—'}
             for ad_id, nombre, campana, clave, estado, gasto, dias in filas_db]
    filas.sort(key=lambda f: -f['gasto'])
    return _COLUMNAS_GASTO, filas, f"{len(filas)} anuncios · ${sum(f['gasto'] for f in filas):,.2f} de Meta"


def registros(fuente, metrica, desde, hasta, base=None, origen=None):
    """{columnas, filas, resumen} de lo que suma `metrica` en `fuente` ('setting', 'workshop' u 'otras').
    `origen`: solo las agendas de ese grupo de origen (para Otras: VSL, Momentum, Referido…)."""
    if fuente not in conteo_agendas_service.FUENTES:
        raise ValueError('Fuente desconocida.')
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    if fuente == 'otras' and metrica in ('leads', 'gasto'):
        raise ValueError('Otras no tiene leads ni gasto: no viene de anuncios.')
    if metrica in ('agendas', 'agendas_alta', 'reportadas', 'show_up'):
        columnas, filas, resumen = _agendas(fuente, metrica, desde, hasta, base, origen)
    else:
        hacer = _leads if metrica == 'leads' else _gasto if metrica == 'gasto' else _cobros
        columnas, filas, resumen = hacer(fuente, metrica, desde, hasta)
    return {'fuente': fuente, 'metrica': metrica, 'columnas': columnas, 'filas': filas, 'resumen': resumen}
