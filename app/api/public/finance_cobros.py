"""Finanzas › Cobros (04/11/2026): cada cobro del período con su neto en el sistema y su neto en los CSV.

Pedido de Mario: una tabla con el cliente, el tipo de pago, el procesador, el bruto (lo que reporta el
closer) y el neto, con filtro por closer, para cotejar el cash con lo que entró de verdad. Son los mismos
cobros y el mismo neto de Revisar › Ventas (`ventas_del_periodo`, `_fila_venta`).

El cotejo (04/11/2026, segunda vuelta): cada cobro por Stripe o Hotmart se cruza con los CSV subidos
(`conciliacion_service.conciliar`, la misma regla de Diferencias) y suma el neto que llegó según la
pasarela y la diferencia contra el neto del sistema. Estados de la fila:

  · coincide       — el neto del sistema es el del CSV, al centavo;
  · neto_distinto  — está en el CSV, pero el neto del sistema es otro (suele ser el estimado);
  · otra_pasarela  — no está en el CSV de su pasarela, y sí en el de la otra, de la misma persona;
  · sin_csv        — no está en los CSV subidos (o falta subir el de su pasarela: `falta_csv`);
  · transferencia  — no pasa por una pasarela: se aprueba a mano (`ConciliacionRevision` con clave
                     `v<id>`, la misma tabla de las revisadas de Diferencias);
  · otro_medio     — cualquier otro medio (PayPal, efectivo…): no hay CSV con qué compararlo.

Además van los cobros de los CSV sin venta en el sistema (`sin_reportar`).
"""
from flask import jsonify
from flask_login import login_required

from app.models import ConciliacionRevision, FinancialSale
from app.services import conciliacion_service as conciliacion
from app.services.closer_name_service import resolver_nombre_closer
from app.services.comision_plataforma_service import tiene_comision_real
from app.services.commission_service import cash_neto

from . import bp
from .finance import _periodo_a_dict, _periodo_de_la_consulta, finance_admin_required

CENTAVO = 0.005


def _es_transferencia(metodo):
    return (metodo or '').strip().lower().startswith('transfer')


def _movs(fila):
    return [{'id': m['id'], 'fecha': m['fecha'], 'nombre': m['nombre'], 'email': m['email'],
             'neto': m['neto'] if m['neto'] is not None else m['bruto'], 'pasarela': m['pasarela']}
            for m in fila['movimientos']]


def _cotejo(v, fila, pasarelas, aprobadas):
    """{estado, neto_csv, pasarela_csv, diferencia, movimientos, ...} del cobro `v`."""
    neto = round(cash_neto(v), 2)
    if _es_transferencia(v.metodo_pago):
        aprobada = aprobadas.get(f'v{v.id}')
        return {'estado': 'transferencia', 'clave': f'v{v.id}', 'aprobada': bool(aprobada),
                'aprobada_por': aprobada.revisada_por.username if aprobada and aprobada.revisada_por else None}
    pasarela = conciliacion.pasarela_de(v.metodo_pago)
    if not pasarela:
        return {'estado': 'otro_medio'}
    if not pasarelas[pasarela]['con_csv']:
        return {'estado': 'sin_csv', 'falta_csv': conciliacion.PASARELAS[pasarela]}
    if fila and fila['movimientos']:
        neto_csv = fila['neto']
        diferencia = round(neto - neto_csv, 2)
        return {'estado': 'coincide' if abs(diferencia) < CENTAVO else 'neto_distinto', 'neto_csv': neto_csv,
                'pasarela_csv': conciliacion.PASARELAS[fila['pasarela']], 'diferencia': diferencia,
                'movimientos': _movs(fila)}
    otra = next((c for c in (fila or {}).get('candidatos', []) if c['motivo'] == 'otra_pasarela'
                 and c['tipo'] == 'movimiento' and c['identidad'] in conciliacion.RANGO), None)
    if otra:
        return {'estado': 'otra_pasarela', 'pasarela_csv': conciliacion.PASARELAS[otra['pasarela']],
                'movimientos': [{'id': otra['id'], 'fecha': otra['fecha'], 'nombre': otra['nombre'],
                                 'email': otra['email'], 'neto': None, 'pasarela': otra['pasarela']}],
                'bruto_csv': otra['monto']}
    return {'estado': 'sin_csv'}


@bp.route('/public/finance/cobros', methods=['GET'])
@login_required
@finance_admin_required
def cobros_del_periodo():
    """Los cobros completados del período de Finanzas (`month`, o `start_date`/`end_date`), del más
    reciente al más viejo, cada uno con su cotejo contra los CSV, y los cobros de los CSV sin reportar."""
    from app.services.comercial_service import ComercialService

    periodo, error = _periodo_de_la_consulta()
    if error:
        return error
    ventas = ComercialService.ventas_del_periodo(periodo['desde'], periodo['hasta'])
    contactos = FinancialSale.contactos(ventas)
    cruce = conciliacion.conciliar(periodo['desde'], periodo['hasta'])
    por_venta = {f['venta']['id']: f for f in cruce['filas'] if f['venta']}
    claves = [f'v{v.id}' for v in ventas if _es_transferencia(v.metodo_pago)]
    aprobadas = ({r.clave: r for r in ConciliacionRevision.query.filter(ConciliacionRevision.clave.in_(claves))}
                 if claves else {})

    from app.services.procedencia_ingresos_service import procedencia_por_venta
    # De dónde vino cada cobro (07/11/2026, el Dashboard de Finanzas): el balde de Procedencia.
    origenes = procedencia_por_venta(ventas)
    filas = []
    for v in ventas:
        fila = ComercialService._fila_venta(v, resolver_nombre_closer(v.email_vendedor), None, contactos.get(v.id))
        filas.append({
            'id': fila['id'], 'fecha': fila['fecha'], 'cliente': fila['cliente'], 'ig': fila['ig'],
            'email': fila['email'], 'programa': fila['programa'], 'tipo_pago': fila['tipo_pago']['label'],
            'procesador': fila['metodo'], 'bruto': fila['monto'], 'neto': fila['monto_neto'],
            'verificado': tiene_comision_real(v), 'closer': fila['closer'] or 'Sin closer',
            'origen': origenes.get(v.id, ('sin_procedencia', None, None))[0],
            'origen_detalle': origenes.get(v.id, (None, None, None))[2],
            **_cotejo(v, por_venta.get(v.id), cruce['pasarelas'], aprobadas),
        })
    sin_reportar = [{'clave': f['clave'], 'pasarela': conciliacion.PASARELAS[f['pasarela']], 'fecha': f['fecha'],
                     'neto': f['neto'], 'bruto': f['ingresado'], 'movimientos': _movs(f),
                     'revisada': bool(f['revisada'])}
                    for f in cruce['filas'] if f['estado'] == 'sin_reportar'
                    and any(m['en_periodo'] for m in f['movimientos'])]
    csv = {conciliacion.PASARELAS[p]: d for p, d in cruce['pasarelas'].items()}
    return jsonify({'filas': filas, 'sin_reportar': sin_reportar, 'csv': csv,
                    'periodo': _periodo_a_dict(periodo)}), 200
