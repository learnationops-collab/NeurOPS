"""El cierre de mes de la verificación (ADR-W088): el CSV de la pasarela confirma o desmiente los pagos.

Corre al subir un CSV en Finanzas › Diferencias, sobre el rango de fechas que trae el archivo, con el
mismo emparejamiento de la pestaña (`conciliacion_service.conciliar`):

  · coincide       → el pago queda verificado (si no lo estaba) y su neto pasa a ser el de la pasarela:
                     es el neto real, el que manda para comisiones;
  · monto_distinto → no cuadra: la pasarela cobró otro monto;
  · sin_ingreso    → no cuadra: el pago no aparece en el CSV. Solo para pagos a más de `VENTANA` de los
                     bordes del archivo (un pago del último día puede entrar en el CSV siguiente).

Es la única forma en que una verificación de Learnito se cae sola: así se notan las incongruencias.
"""
from datetime import datetime, time

from app import db
from app.models import FinancialSale
from app.services import comision_plataforma_service as comisiones
from app.services import conciliacion_service as cs

NOMBRES = {'stripe': 'Stripe', 'hotmart': 'Hotmart'}


def _marcar(venta, estado, motivo, **extra):
    raw = dict(venta.raw_data or {})
    raw['verificacion'] = {'estado': estado, 'motivo': motivo, 'notas': [], 'por': 'conciliacion',
                           'cuando': datetime.utcnow().isoformat(timespec='seconds'), **extra}
    venta.raw_data = raw
    venta.transaction_status = estado


def aplicar(desde, hasta, carga_id=None):
    """Aplica la conciliación de [desde, hasta] (`date`) a los pagos. Devuelve {verificados, no_cuadran}."""
    datos = cs.conciliar(desde, hasta)
    borde_ini = datetime.combine(desde, time.min) + cs.VENTANA
    borde_fin = datetime.combine(hasta, time.max) - cs.VENTANA
    cuenta = {'verificados': 0, 'netos': 0, 'no_cuadran': 0}
    for fila in datos['filas']:
        if not fila['venta']:
            continue
        venta = db.session.get(FinancialSale, fila['venta']['id'])
        if not venta:
            continue
        pasarela = NOMBRES.get(fila['pasarela'], fila['pasarela'])
        if fila['estado'] == 'coincide':
            if fila['neto'] is not None:
                venta.transaction_amount = round(float(fila['neto']), 2)
                cuenta['netos'] += 1
            if venta.transaction_status != 'verified':
                _marcar(venta, 'verified', None, carga=carga_id)
                cuenta['verificados'] += 1
            mov = fila['movimientos'][0] if fila['movimientos'] else None
            venta.transaction_source = venta.transaction_source or fila['pasarela']
            if mov and not venta.transaction_date:
                venta.transaction_date = datetime.fromisoformat(mov['fecha'][:19])
        elif fila['estado'] == 'monto_distinto':
            _marcar(venta, 'unverified', f"{pasarela} cobró US$ {fila['ingresado']:,.2f} y el pago declarado es "
                                         f"de US$ {fila['reportado']:,.2f}.", carga=carga_id)
            venta.transaction_amount = None
            cuenta['no_cuadran'] += 1
        elif fila['estado'] == 'sin_ingreso' and venta.date and borde_ini <= venta.date <= borde_fin:
            _marcar(venta, 'unverified', f'No aparece en el CSV de {pasarela} ({desde:%d/%m}–{hasta:%d/%m}).',
                    carga=carga_id)
            venta.transaction_amount = None
            cuenta['no_cuadran'] += 1
    db.session.commit()
    comisiones.limpiar()
    return cuenta


def aplicar_carga(leido, resumen):
    """Tras guardar un CSV: aplica la conciliación en el rango de fechas del archivo."""
    fechas = [f['fecha'] for f in leido.get('filas') or [] if f.get('fecha')]
    if not fechas:
        return None
    return aplicar(min(fechas).date(), max(fechas).date(), carga_id=resumen.get('carga'))
