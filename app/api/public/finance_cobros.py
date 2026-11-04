"""Finanzas › Cobros (04/11/2026): cada cobro del período con su bruto y su neto.

Pedido de Mario: una tabla con el cliente, el tipo de pago, el procesador, lo cobrado (bruto, lo que
reporta el closer) y lo que queda después de la pasarela (neto, `cash_neto`), con filtro por closer,
para cotejarla después con las transferencias reales. Son los mismos cobros y el mismo neto de
Revisar › Ventas (`ventas_del_periodo`, `_fila_venta`): las dos vistas cierran entre sí.
"""
from flask import jsonify
from flask_login import login_required

from app.models import FinancialSale
from app.services.closer_name_service import resolver_nombre_closer
from app.services.comision_plataforma_service import tiene_comision_real

from . import bp
from .finance import _periodo_a_dict, _periodo_de_la_consulta, finance_admin_required


@bp.route('/public/finance/cobros', methods=['GET'])
@login_required
@finance_admin_required
def cobros_del_periodo():
    """Los cobros completados del período de Finanzas (`month`, o `start_date`/`end_date`), del más
    reciente al más viejo. `verificado`: el neto es el del extracto y no el estimado con el promedio."""
    from app.services.comercial_service import ComercialService

    periodo, error = _periodo_de_la_consulta()
    if error:
        return error
    ventas = ComercialService.ventas_del_periodo(periodo['desde'], periodo['hasta'])
    contactos = FinancialSale.contactos(ventas)
    filas = []
    for v in ventas:
        fila = ComercialService._fila_venta(v, resolver_nombre_closer(v.email_vendedor), None, contactos.get(v.id))
        filas.append({
            'id': fila['id'],
            'fecha': fila['fecha'],
            'cliente': fila['cliente'],
            'ig': fila['ig'],
            'email': fila['email'],
            'programa': fila['programa'],
            'tipo_pago': fila['tipo_pago']['label'],
            'procesador': fila['metodo'],
            'bruto': fila['monto'],
            'neto': fila['monto_neto'],
            'verificado': tiene_comision_real(v),
            'closer': fila['closer'] or 'Sin closer',
        })
    return jsonify({'filas': filas, 'periodo': _periodo_a_dict(periodo)}), 200
