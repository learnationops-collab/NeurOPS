"""La comisión de cada plataforma de pago (Stripe, Hotmart...), calculada con las comisiones reales (02/11/2026).

Decisión de Kerwin: no se fija un % a mano. La comisión de una venta es la suya cuando se conoce (el pago
está verificado y trae lo que entró de verdad, `FinancialSale.transaction_amount`); cuando no, la PROMEDIO de
su plataforma, que sale de las comisiones reales ya cargadas. Este módulo es el único lugar que la calcula;
`commission_service.cash_neto` y `cash_neto_de` la usan, y de ahí salen Finanzas, Payroll y Marketing.

El promedio de una plataforma, en orden de preferencia:
  1. `ventas verificadas`: los pagos suyos con comisión real. Ponderado (comisión total ÷ bruto total), que es
     lo que hace que el neto estimado de un conjunto de ventas sume lo mismo que cobraron de verdad. Solo
     entran los que tienen una comisión plausible (de 0 a `TASA_MAXIMA`): un neto mayor que el bruto es un
     redondeo y uno que se lleva más de un tercio es un dato mal cargado, no una comisión.
  2. `conciliación`: los cobros de los CSV de Finanzas › Diferencias (`ConciliacionMovimiento`), si hay pocos pagos
     verificados de esa plataforma.
  3. `fija`: `commission_service.COMISION_PASARELA`, el valor que había antes del cálculo, como último recurso.
Una plataforma sin ninguna de las tres (transferencia, PayPal, 'otro') no descuenta nada: no se sabe cuánto cobra.
"""
import time

from flask import current_app, has_app_context
from sqlalchemy import func, or_

from app import db

MUESTRA_MINIMA = 10      # pagos (o cobros) que hacen falta para fiarse del promedio de una plataforma
TASA_MAXIMA = 0.30       # una comisión mayor no es una comisión: es un dato mal cargado
VIGENCIA = 600           # segundos que se guarda el cálculo: no consulta la base en cada cuenta

ORIGEN_REAL, ORIGEN_PROMEDIO, ORIGEN_NINGUNA = 'real', 'promedio', 'sin comisión'
_ESTADOS_QUE_SUMAN = ('', 'completada', 'confirmada')


def metodo_de(venta_o_metodo):
    """El método de pago normalizado (minúsculas, sin espacios) de una venta o de un texto."""
    metodo = getattr(venta_o_metodo, 'metodo_pago', venta_o_metodo)
    return (metodo or '').strip().lower()


def _de_ventas():
    from app.models import FinancialSale as V
    bruto, neto = V.monto, V.transaction_amount
    estado_ok = or_(V.estado.is_(None), func.lower(func.trim(V.estado)).in_(_ESTADOS_QUE_SUMAN))
    filas = db.session.query(
        func.lower(func.trim(V.metodo_pago)), func.count(V.id), func.sum(bruto), func.sum(bruto - neto)
    ).filter(V.transaction_status == 'verified', neto.isnot(None), bruto > 0, estado_ok,
             bruto - neto >= 0, bruto - neto <= bruto * TASA_MAXIMA, V.metodo_pago.isnot(None)
             ).group_by(func.lower(func.trim(V.metodo_pago))).all()
    return {metodo: {'ventas': int(n), 'bruto': float(b), 'comision': float(c)} for metodo, n, b, c in filas if metodo}


def _de_conciliacion():
    from app.models import ConciliacionMovimiento as M
    filas = db.session.query(M.pasarela, func.count(M.id), func.sum(M.bruto), func.sum(M.comision)) \
        .filter(M.comision.isnot(None), M.bruto > 0, M.bruto_desconocido.is_(False)).group_by(M.pasarela).all()
    return {(p or '').strip().lower(): {'ventas': int(n), 'bruto': float(b), 'comision': float(c)}
            for p, n, b, c in filas}


def _calcular():
    """{método: {tasa, ventas, bruto, comision, origen}} de cada plataforma que se sabe cuánto cobra."""
    from app.services.commission_service import COMISION_PASARELA

    verificadas, conciliadas = _de_ventas(), _de_conciliacion()
    promedios = {}
    for metodo in set(verificadas) | set(conciliadas) | set(COMISION_PASARELA):
        for origen, fuente in (('ventas verificadas', verificadas), ('conciliación', conciliadas)):
            dato = fuente.get(metodo)
            if dato and dato['ventas'] >= MUESTRA_MINIMA and dato['bruto'] > 0:
                promedios[metodo] = {**dato, 'tasa': dato['comision'] / dato['bruto'], 'origen': origen}
                break
        else:
            if metodo in COMISION_PASARELA:
                promedios[metodo] = {'tasa': COMISION_PASARELA[metodo], 'ventas': 0, 'bruto': 0.0, 'comision': 0.0,
                                     'origen': 'fija'}
    return promedios


def _fija():
    from app.services.commission_service import COMISION_PASARELA
    return {m: {'tasa': t, 'ventas': 0, 'bruto': 0.0, 'comision': 0.0, 'origen': 'fija'}
            for m, t in COMISION_PASARELA.items()}


def promedios():
    """El promedio de cada plataforma. Se calcula una vez cada `VIGENCIA` segundos por aplicación. Fuera de una
    aplicación (un script suelto) no hay base a la que preguntar: queda el valor fijo."""
    if not has_app_context():
        return _fija()
    guardado = current_app.extensions.get('comision_plataforma')
    if guardado and time.monotonic() - guardado[0] < VIGENCIA:
        return guardado[1]
    try:
        calculado = _calcular()
    except Exception as e:
        # La cuenta no puede tumbar a Finanzas: sin la base, vale el valor fijo.
        current_app.logger.error(f"comision_plataforma: {e}")
        db.session.rollback()
        calculado = _fija()
    current_app.extensions['comision_plataforma'] = (time.monotonic(), calculado)
    return calculado


def limpiar():
    """Olvida el cálculo guardado (después de cargar o verificar pagos en bloque)."""
    if has_app_context():
        current_app.extensions.pop('comision_plataforma', None)


def tasa_promedio(metodo):
    """La comisión promedio (fracción del bruto) de esa plataforma; 0 si no se sabe cuánto cobra."""
    return promedios().get(metodo_de(metodo), {}).get('tasa', 0.0)


def tiene_comision_real(venta):
    """Si el pago trae lo que entró de verdad (verificado contra el banco o la pasarela)."""
    return venta.transaction_status == 'verified' and venta.transaction_amount is not None


def comision_de(venta):
    """{tasa, origen, plataforma} de ese pago: su comisión real o, si falta, el promedio de su plataforma.
    `origen` es 'real', 'promedio' (la tasa es la de la plataforma) o 'sin comisión' (no se sabe cuánto cobra)."""
    plataforma = metodo_de(venta)
    monto = float(venta.monto or 0.0)
    if tiene_comision_real(venta) and monto > 0:
        return {'tasa': (monto - float(venta.transaction_amount)) / monto, 'origen': ORIGEN_REAL,
                'plataforma': plataforma}
    tasa = tasa_promedio(plataforma)
    return {'tasa': tasa, 'origen': ORIGEN_PROMEDIO if plataforma in promedios() else ORIGEN_NINGUNA,
            'plataforma': plataforma}


def fees_por_metodo():
    """{método: factor que queda del bruto} de cada plataforma con comisión promedio (para cuentas en SQL)."""
    return {m: round(1 - d['tasa'], 6) for m, d in promedios().items()}
