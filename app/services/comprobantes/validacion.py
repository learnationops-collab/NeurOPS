"""Compara lo que leyó Learnito con el pago declarado y deja el pago verificado o no (ver `__init__`).

Qué hace que NO cuadre (`unverified`, con el motivo a la vista del closer):
  · el archivo no es un comprobante, o el pago figura rechazado o pendiente;
  · el monto es otro (tolerancia: US$ 1 o 1 %). Si el comprobante muestra que lo cargado es el NETO, se
    dice: el closer carga siempre el bruto;
  · la fecha del comprobante es más de `DESPUES` posterior al pago declarado, o más de `ANTES` anterior
    (un comprobante viejo, de otro pago). Cargar el pago días después del cobro es normal y no resta;
  · el número de operación ya respalda otro pago, o el mismo archivo ya respalda otro pago y no es un
    extracto (un extracto sí respalda varios).

Lo que no resta, pero se anota: otra moneda (no hay tipo de cambio: el monto no se compara), otro nombre
de pagador (paga un familiar), observaciones de Learnito.

Con varios comprobantes en un pago, alcanza con uno que cuadre. La lectura queda guardada en cada
entrada de `transaction_evidence`: al corregir el pago se vuelve a evaluar sin llamar a Claude.
"""
import logging
from datetime import date, datetime, timedelta

from sqlalchemy import String, cast

from app import db
from app.models import FinancialSale
from app.services import comision_plataforma_service as comisiones
from app.services.commission_service import cash_neto_de
from app.services.comprobantes import almacen, lector

logger = logging.getLogger(__name__)

DESPUES = timedelta(days=3)
ANTES = timedelta(days=30)
MONEDA = 'USD'
TRANSFERENCIAS = ('transferencia', 'transferencia bancaria', 'binance / usdt', 'efectivo')


def _tolerancia(monto):
    return max(1.0, abs(monto) * 0.01)


def _fecha(texto):
    try:
        return date.fromisoformat(str(texto or '')[:10])
    except ValueError:
        return None


def _plata(valor):
    return f'US$ {valor:,.2f}'


def _movimiento_del_pago(lectura, monto):
    """En un extracto, el movimiento por el monto declarado (o None)."""
    for mov in lectura.get('movimientos') or []:
        if mov.get('monto') is not None and abs(float(mov['monto']) - monto) <= _tolerancia(monto):
            if (mov.get('moneda') or MONEDA).upper() == MONEDA:
                return mov
    return None


def _reusado(venta, entrada, lectura):
    """El otro pago que ya respalda este comprobante, o None."""
    otros = FinancialSale.query.filter(FinancialSale.id != venta.id)
    numero = (lectura.get('numero_operacion') or '').strip()
    if numero:
        otro = otros.filter(FinancialSale.transaction_id == numero[:120]).first()
        if otro:
            return otro
    es_extracto = lectura.get('origen') == 'extracto' or len(lectura.get('movimientos') or []) > 1
    if not es_extracto and entrada.get('id'):
        return otros.filter(cast(FinancialSale.transaction_evidence, String).like(f"%{entrada['id']}%")).first()
    return None


def evaluar_entrada(venta, entrada):
    """{estado, motivo, notas, neto, fecha} de UN comprobante contra el pago, sin escribir nada."""
    lectura = entrada.get('lectura') or {}
    monto = float(venta.monto or 0)
    notas = [lectura['observaciones']] if lectura.get('observaciones') else []

    def no(motivo):
        return {'estado': 'unverified', 'motivo': motivo, 'notas': notas, 'neto': None, 'fecha': None}

    if not lectura.get('es_comprobante'):
        return no('Learnito no encontró un pago en el archivo.')
    if lectura.get('estado') in ('rechazado', 'pendiente'):
        return no(f"El comprobante muestra el pago {lectura['estado']}.")
    otro = _reusado(venta, entrada, lectura)
    if otro:
        return no(f'Ese comprobante ya respalda el pago #{otro.id} ({otro.nombre_cliente or "otro cliente"}).')

    mov = _movimiento_del_pago(lectura, monto) if lectura.get('movimientos') else None
    leido = float(mov['monto']) if mov else lectura.get('monto')
    moneda = ((mov or lectura).get('moneda') or MONEDA).upper()
    fecha = _fecha((mov or lectura).get('fecha'))

    if leido is None:
        return no('Learnito no pudo leer el monto del comprobante.')
    leido = float(leido)
    if moneda != MONEDA:
        notas.append(f'El comprobante está en {moneda} ({leido:,.2f}): el monto no se compara.')
    elif abs(leido - monto) > _tolerancia(monto):
        neto = lectura.get('neto')
        if neto is not None and abs(float(neto) - monto) <= _tolerancia(monto):
            return no(f'Cargaste el neto ({_plata(monto)}): el bruto que pagó el cliente es {_plata(leido)}. '
                      'Corregí el monto del pago.')
        return no(f'El comprobante es por {_plata(leido)} y el pago declarado, por {_plata(monto)}.')

    if fecha and venta.date:
        declarado = venta.date.date()
        if fecha > declarado + DESPUES:
            return no(f'El comprobante es del {fecha:%d/%m/%Y}, posterior al pago declarado ({declarado:%d/%m/%Y}).')
        if fecha < declarado - ANTES:
            return no(f'El comprobante es del {fecha:%d/%m/%Y}: {(declarado - fecha).days} días antes del pago '
                      'declarado. Parece de otro pago.')

    pagador = (lectura.get('pagador_nombre') or '').strip()
    if pagador and not _mismo_nombre(pagador, venta.nombre_cliente):
        notas.append(f'Lo pagó {pagador}.')

    neto = None
    if moneda == MONEDA:
        if lectura.get('neto') is not None and not mov:
            neto = float(lectura['neto'])
        elif comisiones.metodo_de(venta) in TRANSFERENCIAS:
            neto = leido
    return {'estado': 'verified', 'motivo': None, 'notas': notas, 'neto': neto, 'fecha': fecha}


def _mismo_nombre(a, b):
    import unicodedata

    def palabras(t):
        plano = unicodedata.normalize('NFKD', t or '').encode('ascii', 'ignore').decode().lower()
        return {p for p in plano.replace(',', ' ').split() if len(p) > 2}
    return bool(palabras(a) & palabras(b))


def evaluar(venta):
    """Evalúa todos los comprobantes del pago y escribe el resultado en él (sin commit)."""
    entradas = venta.transaction_evidence or []
    de_conciliacion = ((venta.raw_data or {}).get('verificacion') or {}).get('por') == 'conciliacion'
    # Lo que decidió el CSV de la pasarela (cierre de mes) no lo cambia un comprobante.
    if de_conciliacion:
        return None
    if not entradas:
        venta.transaction_status = 'pending'
        _guardar_verificacion(venta, None)
        return None
    resultados = [(e, evaluar_entrada(venta, e)) for e in entradas]
    entrada, res = next(((e, r) for e, r in resultados if r['estado'] == 'verified'), resultados[-1])
    lectura = entrada.get('lectura') or {}
    venta.transaction_status = res['estado']
    if res['estado'] == 'verified':
        venta.transaction_amount = res['neto']
        venta.transaction_date = datetime.combine(res['fecha'], datetime.min.time()) if res['fecha'] else None
        venta.transaction_id = (lectura.get('numero_operacion') or '').strip()[:120] or None
        venta.transaction_source = (lectura.get('origen') or None)
    else:
        venta.transaction_amount = None
    _guardar_verificacion(venta, {**{k: res[k] for k in ('estado', 'motivo', 'notas')},
                                  'comprobante': entrada.get('id'), 'por': 'learnito',
                                  'cuando': datetime.utcnow().isoformat(timespec='seconds')})
    comisiones.limpiar()
    return res


def _guardar_verificacion(venta, verificacion):
    raw = dict(venta.raw_data or {})
    if verificacion is None:
        raw.pop('verificacion', None)
    else:
        raw['verificacion'] = verificacion
    venta.raw_data = raw


def subir(venta, datos, nombre, tipo, usuario):
    """Guarda el comprobante, lo hace leer por Learnito, evalúa el pago y guarda. Devuelve `estado_de`."""
    entrada = almacen.guardar(datos, nombre, tipo, usuario)
    entradas = list(venta.transaction_evidence or [])
    if any(e.get('id') == entrada['id'] for e in entradas):
        raise almacen.ComprobanteError('invalido', 'Ese archivo ya está cargado en este pago.')
    declarado = {'cliente': venta.nombre_cliente, 'monto': venta.monto, 'medio': venta.metodo_pago,
                 'fecha': venta.date.date().isoformat() if venta.date else None}
    entrada['lectura'] = lector.leer(datos, entrada['tipo'], declarado, usuario.id)
    venta.transaction_evidence = entradas + [entrada]
    evaluar(venta)
    db.session.commit()
    return estado_de(venta)


def quitar(venta, comprobante_id):
    """Saca un comprobante del pago (el archivo queda en el volumen) y vuelve a evaluar."""
    entradas = [e for e in (venta.transaction_evidence or []) if e.get('id') != comprobante_id]
    if len(entradas) == len(venta.transaction_evidence or []):
        raise almacen.ComprobanteError('no_existe', 'Ese comprobante no está en este pago.')
    venta.transaction_evidence = entradas
    if not entradas:
        venta.transaction_amount = venta.transaction_date = venta.transaction_id = venta.transaction_source = None
    evaluar(venta)
    db.session.commit()
    return estado_de(venta)


def reevaluar_si_tiene(venta):
    """Tras corregir el pago (monto, fecha, medio): vuelve a comparar con lo ya leído. Sin commit."""
    if venta.transaction_evidence:
        evaluar(venta)


def estado_de(venta):
    """Lo que ve el closer de la verificación de un pago."""
    verif = (venta.raw_data or {}).get('verificacion') or {}
    real = comisiones.tiene_comision_real(venta)
    return {
        'estado': venta.transaction_status or 'pending',
        'motivo': verif.get('motivo'),
        'notas': verif.get('notas') or [],
        'por': verif.get('por'),
        'neto': venta.transaction_amount if real else None,
        'neto_estimado': None if real else round(cash_neto_de(venta.monto, venta.metodo_pago), 2),
        'comprobantes': [{k: e.get(k) for k in ('id', 'nombre', 'tipo', 'subido', 'subido_por')}
                         for e in (venta.transaction_evidence or [])],
    }
