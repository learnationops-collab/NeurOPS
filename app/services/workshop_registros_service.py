"""Los registros detrás de las cifras de Workshop › Resumen (Kerwin, 28/10/2026: toda cifra se abre en su lista).

Cada lista sale del MISMO código que la cifra del taller (`workshop_metrics_service.calcular_prefill`): las
mismas personas por embudo (vivo y grabación) y las mismas ventas. La suma de la lista es el número del taller
cuando éste está al día; si el taller guarda otro (se calculó antes), la pantalla lo avisa.

  · show_up / reportadas   las personas que asistieron / las que tienen resultado (base del show up de citas).
  · ventas                 las personas compradoras (pago completo o split pay; la seña no).
  · new_cash               los pagos de venta nueva (completo o split pay) más la primera cuota de cada venta si llega
    a menos de un mes (la base del ticket, `cash_ventas`, 19/10/2026): su suma es el New Cash.
  · cash_total             los pagos de venta nueva más las señas: su suma es el Cash collected (`cash_collected`),
    la base del ROAS Total. Las cuotas, renovaciones y upsells NO suman acá (`_es_venta_valida`), así que New Cash
    puede superar a Cash total; el Cash total de Marketing, que sí las cuenta, está en Marketing › Rendimiento.

Las agendas se abren con `workshop_agendas_service` (la lista de Revisar), que ya existía.
"""
from datetime import datetime

from app.services import workshop_metrics_service as m
from app.services.ticket_service import SENA, VENTA, claves_de_venta, cuotas_que_suman
from app.services.workshop_estados import bucket_de_persona

METRICAS = ('show_up', 'reportadas', 'ventas', 'new_cash', 'cash_total')

_PERSONAS = [
    {'key': 'persona', 'header': 'Persona', 'tipo': 'texto', 'ancho': 'minmax(170px,1.6fr)'},
    {'key': 'taller', 'header': 'Taller', 'tipo': 'texto', 'ancho': 'minmax(130px,1fr)'},
    {'key': 'embudo', 'header': 'Entró por', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'cita', 'header': 'Cita', 'tipo': 'fecha', 'ancho': '140px'},
    {'key': 'closer', 'header': 'Closer', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)'},
    {'key': 'estado', 'header': 'Estado', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'comprador', 'header': 'Compró', 'tipo': 'si_no', 'ancho': '90px'},
    {'key': 'instagram', 'header': 'Instagram', 'tipo': 'texto', 'ancho': 'minmax(120px,1fr)', 'oculta': True},
]

_COBROS = [
    {'key': 'fecha', 'header': 'Fecha', 'tipo': 'fecha', 'ancho': '120px'},
    {'key': 'cliente', 'header': 'Cliente', 'tipo': 'texto', 'ancho': 'minmax(170px,1.6fr)'},
    {'key': 'monto', 'header': 'Monto', 'tipo': 'dinero', 'ancho': '110px'},
    {'key': 'tipo', 'header': 'Cuenta como', 'tipo': 'texto', 'ancho': '120px'},
    {'key': 'taller', 'header': 'Taller', 'tipo': 'texto', 'ancho': 'minmax(130px,1fr)'},
    {'key': 'embudo', 'header': 'Entró por', 'tipo': 'texto', 'ancho': '110px'},
    {'key': 'medio', 'header': 'Medio', 'tipo': 'texto', 'ancho': 'minmax(110px,1fr)', 'oculta': True},
]

_EMBUDO = {'vivo': 'Clase en vivo', 'landing': 'Grabación'}


def _grupos(taller, tz_nombre):
    """{embudo: (personas, compradores, ventas)} del taller y su ventana, igual que `calcular_prefill`."""
    tz = m._tz(tz_nombre)
    desde, hasta, _siguiente = m.ventana_evento(taller.date, tz)
    por_embudo = m._agendas_por_embudo(desde, hasta, tz)
    vistas = set()
    personas_vivo = m._agrupar_por_persona(por_embudo['vivo'], vistas)
    personas_landing = m._agrupar_por_persona(por_embudo['landing'], vistas)
    compradores_vivo, ventas_vivo = m._ventas_de(por_embudo['vivo'], set())
    compradores_landing, ventas_landing = m._ventas_de(por_embudo['landing'], compradores_vivo)
    return {'vivo': (personas_vivo, compradores_vivo, ventas_vivo),
            'landing': (personas_landing, compradores_landing, ventas_landing - ventas_vivo)}


def _personas(talleres, metrica, tz_nombre):
    ahora = datetime.utcnow()
    filas = []
    for taller in talleres:
        for embudo, (personas, compradores, _ventas) in _grupos(taller, tz_nombre).items():
            for agendas in personas:
                bucket, _sin = bucket_de_persona(agendas, m._estado_post_call, ahora)
                compro = m._clave_identidad(agendas[0]) in compradores
                if (metrica == 'show_up' and bucket != 'Show Up') or \
                        (metrica == 'reportadas' and bucket not in ('Show Up', 'No Show')) or \
                        (metrica == 'ventas' and not compro):
                    continue
                ultima = max(agendas, key=lambda a: (a.date is not None, a.date))
                contacto = ultima.contacto()
                filas.append({
                    'id': f'{taller.id}-{ultima.id}', 'persona': contacto['lead'] or contacto['mail'] or 'Sin nombre',
                    'taller': taller.name, 'embudo': _EMBUDO[embudo], 'cita': ultima.date.isoformat() if ultima.date else '',
                    'closer': (ultima.closer or '').strip() or '—', 'estado': bucket,
                    'comprador': 'Sí' if compro else 'No', 'instagram': contacto['instagram'] or '—',
                })
    filas.sort(key=lambda f: f['cita'], reverse=True)
    asistieron = sum(1 for f in filas if f['estado'] == 'Show Up')
    resumen = {'show_up': f'{len(filas)} personas que asistieron a su cita',
               'reportadas': f'{len(filas)} con resultado · {asistieron} asistieron',
               'ventas': f'{len(filas)} personas compradoras (completo o split pay)'}[metrica]
    return _PERSONAS, filas, resumen


def _cobros(talleres, metrica, tz_nombre):
    """new_cash: las ventas nuevas y las primeras cuotas que suman al ticket (`cash_ventas`);
    cash_total: las ventas nuevas y las señas (`cash_collected`). Por embudo, como las suma `_resumen`."""
    filas, suma = [], 0.0

    def agregar(taller, embudo, venta, monto, fecha, cliente, tipo, medio):
        nonlocal suma
        monto = round(float(monto or 0), 2)
        suma += monto
        filas.append({'id': f'{taller.id}-{embudo}-{len(filas)}', 'fecha': fecha.isoformat() if fecha else '',
                      'cliente': cliente or 'Sin nombre', 'monto': monto, 'tipo': tipo, 'taller': taller.name,
                      'embudo': _EMBUDO[embudo], 'medio': medio or '—'})

    for taller in talleres:
        for embudo, (_personas_, _compradores, ventas) in _grupos(taller, tz_nombre).items():
            pagos = [(claves_de_venta(v), v.date, v.monto, VENTA if m._es_cierre(v) else SENA) for v in ventas]
            for venta, pago in zip(ventas, pagos):
                nueva = pago[3] == VENTA
                if metrica == 'new_cash' and not nueva:
                    continue
                agregar(taller, embudo, venta, venta.monto, venta.date, venta.nombre_cliente,
                        'Venta nueva' if nueva else 'Seña', venta.metodo_pago)
            if metrica == 'new_cash':
                for claves, fecha, monto, _clase in cuotas_que_suman(pagos):
                    dueno = next((v for v, p in zip(ventas, pagos) if set(p[0]) & set(claves or ())), None)
                    agregar(taller, embudo, None, monto, fecha, dueno.nombre_cliente if dueno else None,
                            'Primera cuota', None)
    filas.sort(key=lambda f: f['fecha'], reverse=True)
    senas = round(sum(f['monto'] for f in filas if f['tipo'] == 'Seña'), 2)
    cuotas = round(sum(f['monto'] for f in filas if f['tipo'] == 'Primera cuota'), 2)
    resumen = f"{len(filas)} cobros · ${suma:,.2f}"
    if senas:
        resumen += f" · ${senas:,.2f} de señas (todavía no son una venta)"
    if cuotas:
        resumen += f" · ${cuotas:,.2f} de primeras cuotas (suman al ticket)"
    return _COBROS, filas, resumen


def registros(talleres, metrica, tz_nombre):
    """{columnas, filas, resumen, total} de lo que suma `metrica` en los talleres (WorkshopEvent) pedidos."""
    if metrica not in METRICAS:
        raise ValueError('Esa cifra todavía no tiene lista.')
    hacer = _cobros if metrica in ('new_cash', 'cash_total') else _personas
    columnas, filas, resumen = hacer(talleres, metrica, tz_nombre)
    total = round(sum(f['monto'] for f in filas), 2) if hacer is _cobros else len(filas)
    return {'metrica': metrica, 'columnas': columnas, 'filas': filas, 'resumen': resumen, 'total': total}
