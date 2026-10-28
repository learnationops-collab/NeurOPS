"""Los registros detrás de cada cifra de una fuente (Setting o Workshop) en Marketing.

Pedido de Kerwin (28/10/2026): cualquier cifra se abre en la lista de lo que la suma, para poder verificarla.
Cada lista sale del MISMO código que la cifra (`fuentes_service.personas_por_fuente` y `_cobros_para_sumar`),
no de una consulta parecida: la suma de la lista es la cifra.

  · agendas   las personas con agenda creada en el período (con «Asistió» y «Con resultado»).
  · reportadas las que tienen resultado: la base del % de show up.
  · show_up   las que asistieron.
  · ventas / new_cash   los pagos de venta nueva del período (su suma es el New Cash).
  · cash_total   todos los cobros de la fuente, y de cuáles son de una venta anterior.
"""
from app.services import anuncios_service, fuentes_service
from app.services.comercial_service import ComercialService

METRICAS = ('agendas', 'reportadas', 'show_up', 'ventas', 'new_cash', 'cash_total')

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


def _si_no(valor):
    return 'Sí' if valor else 'No'


def _agendas(fuente, metrica, desde, hasta):
    personas = [p for p in fuentes_service.personas_por_fuente(desde, hasta) if p['fuente'] == fuente]
    if metrica == 'show_up':
        personas = [p for p in personas if p['asistio']]
    elif metrica == 'reportadas':
        personas = [p for p in personas if fuentes_service.con_resultado(p)]
    filas = [{
        'id': f"{p['agenda_id']}", 'persona': p['persona'] or 'Sin nombre', 'alta': p['dia'],
        'cita': p['cita'].isoformat() if p['cita'] else '', 'origen': p['origen'] or '—', 'closer': p['closer'] or '—',
        'estado': p['estado'] or '—', 'asistio': _si_no(p['asistio']), 'con_resultado': _si_no(fuentes_service.con_resultado(p)),
    } for p in personas]
    filas.sort(key=lambda f: f['alta'], reverse=True)
    asistieron = sum(1 for f in filas if f['asistio'] == 'Sí')
    resumen = f"{len(filas)} personas · {asistieron} asistieron" if metrica != 'agendas' else f"{len(filas)} agendas"
    if metrica == 'reportadas':
        resumen = f"{len(filas)} con resultado · {asistieron} asistieron"
    return _COLUMNAS_AGENDAS, filas, resumen


def _cobros(fuente, metrica, desde, hasta):
    desde_dt, hasta_dt = anuncios_service._limites(desde, hasta)
    _por_clave, _sin, cobros, _sin_clave, claves = anuncios_service._ventas(
        desde_dt, hasta_dt, anuncios_service._clave_de_cada_anuncio())
    de_cobro = fuentes_service._cobros_para_sumar(cobros, claves)
    pares = [(c, f) for c, f in zip(cobros, de_cobro)
             if fuentes_service.fuente_de_cobro(f['por_clave'], f['balde']) == fuente]
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


def registros(fuente, metrica, desde, hasta):
    """{columnas, filas, resumen} de lo que suma `metrica` en `fuente` ('setting' o 'workshop')."""
    if fuente not in {f['key'] for f in fuentes_service.FUENTES}:
        raise ValueError('Fuente desconocida.')
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    columnas, filas, resumen = (_agendas if metrica in ('agendas', 'reportadas', 'show_up') else _cobros)(
        fuente, metrica, desde, hasta)
    return {'fuente': fuente, 'metrica': metrica, 'columnas': columnas, 'filas': filas, 'resumen': resumen}
