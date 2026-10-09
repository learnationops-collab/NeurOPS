"""Finanzas › Diferencias (09/10/2026): los CSV de Stripe y Hotmart contra lo reportado en el sistema.

Pedido de Kerwin: «agregá una pestaña de Diferencias, para agregar CSVs [...] para revisar las
diferencias entre lo reportado y lo ingresado realmente, con KPIs que muestren lo reportado y lo
ingresado, y que me permita hacer correcciones rápidas en lo reportado».

Todo es de quien ve Finanzas (`finance_admin_required`: admin o dirección comercial con «ver
finanzas»), también las correcciones: cambian ventas reales, las mismas que suman el Resumen, la
nómina y las comisiones. La lectura, el cruce y los KPIs viven en `conciliacion_service`; la
corrección de una venta es la de la ficha (`ficha_pagos_service.corregir_venta`).
"""
from flask import current_app, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.models import FinancialSale
from app.services import conciliacion_csv as lector
from app.services import conciliacion_service as conciliacion

from . import bp
from .finance import _periodo_de_la_consulta, finance_admin_required


@bp.route('/public/finance/conciliacion', methods=['GET'])
@login_required
@finance_admin_required
def conciliacion_del_periodo():
    """Las filas, los KPIs y las cargas del período de Finanzas (`month`, o `start_date`/`end_date`),
    con las opciones para cambiar el medio de una venta (las de la ficha)."""
    from app.services.ficha_vocabulario import MEDIOS_PAGO_VENTA
    from app.services.transferencias_service import opciones

    periodo, error = _periodo_de_la_consulta()
    if error:
        return error
    datos = conciliacion.conciliar(periodo['desde'], periodo['hasta'])
    return jsonify({**datos, 'mes': periodo['mes'],
                    'opciones': {'medios': list(MEDIOS_PAGO_VENTA), 'transferido_a': opciones()}}), 200


@bp.route('/public/finance/conciliacion/cargas', methods=['POST'])
@login_required
@finance_admin_required
def subir_csv():
    """Sube UN CSV (`archivo`, multipart) y, si hace falta, su `pasarela` ('stripe' | 'hotmart').

    201 con el resumen (filas, nuevas, repetidas, omitidas). 400 si no se puede leer; con
    `codigo: 'pasarela'` es que no se reconoce de cuál es y hay que elegirla (y vuelven los
    encabezados que trajo, para mostrarlos)."""
    archivo = request.files.get('archivo')
    if archivo is None or not archivo.filename:
        return jsonify({'error': 'Elegí un archivo CSV.'}), 400
    pasarela = (request.form.get('pasarela') or '').strip().lower() or None
    contenido = archivo.read(lector.MAX_BYTES + 1)
    try:
        leido = lector.leer(contenido, archivo.filename, pasarela=pasarela)
    except lector.CsvInvalido as e:
        return jsonify({'error': str(e), 'codigo': e.codigo, 'columnas': e.columnas[:40],
                        'archivo': archivo.filename}), 400
    resumen = conciliacion.guardar_carga(leido, archivo.filename, current_user)
    return jsonify(resumen), 201


@bp.route('/public/finance/conciliacion/cargas/<int:carga_id>', methods=['DELETE'])
@login_required
@finance_admin_required
def borrar_csv(carga_id):
    """Borra una carga y los cobros que entraron con ella."""
    if not conciliacion.borrar_carga(carga_id):
        return jsonify({'error': 'Esa carga no existe.'}), 404
    return jsonify({'borrada': carga_id}), 200


def _fila_de_hoja(venta):
    """Lo que la hoja de ventas guarda de una venta (como la edición de Operaciones y la atribución)."""
    return {
        'email_vendedor': venta.email_vendedor, 'nombre_cliente': venta.nombre_cliente,
        'telefono': venta.telefono, 'mail_cliente': venta.mail_cliente, 'tipo_pago': venta.tipo_pago,
        'monto': venta.monto, 'segundo_pago': venta.segundo_pago, 'metodo_pago': venta.metodo_pago,
        'examen': venta.examen, 'instagram': venta.instagram, 'setter': venta.setter, 'estado': venta.estado,
    }


@bp.route('/public/finance/conciliacion/ventas/<int:sale_id>', methods=['PUT'])
@login_required
@finance_admin_required
def corregir_venta_reportada(sale_id):
    """Corrige lo reportado de una venta: {monto?, fecha? (AAAA-MM-DD), metodo_pago?, transferido_a?}.

    Es la corrección de un pago de la ficha (`corregir_venta`): las mismas validaciones, el espejo en
    la deuda y la bitácora del lead si la venta tiene uno, y `transferido_a` que se pide si el pago
    pasa a ser transferencia y se limpia si deja de serlo. Después, la hoja de ventas se pone al día
    en segundo plano, como con la atribución de Payroll."""
    from app.api.public.financial_sales import _propagar_lote_a_sheets
    from app.services.ficha_acciones_service import ErrorDeAccion
    from app.services.ficha_pagos_service import corregir_venta

    venta = db.session.get(FinancialSale, sale_id)
    if not venta:
        return jsonify({'error': 'Venta no encontrada'}), 404
    datos = request.get_json(silent=True)
    datos = {k: v for k, v in (datos if isinstance(datos, dict) else {}).items()
             if k in ('monto', 'fecha', 'metodo_pago', 'transferido_a')}
    try:
        resultado = corregir_venta(venta, datos, current_user)
    except ErrorDeAccion as e:
        db.session.rollback()
        return jsonify({'error': str(e), 'campo': e.campo}), 400

    hoja = bool(resultado.get('cambios')) and bool(venta.marca_temporal)
    if hoja:
        _propagar_lote_a_sheets(current_app._get_current_object(), [(venta.marca_temporal, _fila_de_hoja(venta))])
    return jsonify({**resultado, 'hoja': hoja,
                    'venta': {'id': venta.id, 'monto': venta.monto, 'metodo_pago': venta.metodo_pago,
                              'fecha': venta.date.isoformat() if venta.date else None}}), 200


@bp.route('/public/finance/conciliacion/revisiones', methods=['POST'])
@login_required
@finance_admin_required
def revisar_diferencia():
    """Marca una diferencia como revisada (o la vuelve a pendientes con `revisada: false`):
    {clave, revisada, estado?, nota?}. Queda quién y cuándo."""
    datos = request.get_json(silent=True)
    datos = datos if isinstance(datos, dict) else {}
    try:
        revision = conciliacion.marcar_revisada(
            datos.get('clave'), current_user, revisada=datos.get('revisada', True) is not False,
            estado=datos.get('estado'), nota=datos.get('nota') if isinstance(datos.get('nota'), str) else None)
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    return jsonify({'clave': datos.get('clave'), 'revisada': revision is not None}), 200
