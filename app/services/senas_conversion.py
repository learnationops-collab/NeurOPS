"""Con qué pago se convirtió cada seña (19/10/2026).

Una seña se convierte con un pago posterior del mismo contacto: un completo o un parcial, como
siempre, o una CUOTA. Los closers suelen cargar el resto de la seña como «RR - Cuota» (Erika
Moreira: seña de $50 «paga completo mañana» y $1.950 como cuota cuatro días después; 6 de 14 señas
desde julio en prod). La cuota cuenta con la misma ventana que el ticket promedio
(`ticket_service.es_primera_cuota`): a menos de un mes de la seña. Una cuota más tarde es de otra
venta.

Convertida con una cuota, la seña es «Pago completo» si entre las dos llegan al precio del
programa (`Client.total_amount`, o el de lista de `SalesConsistencyService`), y si no «Pago parcial».
"""
from datetime import date

from sqlalchemy import func

from app import db
from app.models import Client, FinancialSale
from app.services.comercial_service import ComercialService, _limpiar_email, _limpiar_ig
from app.services.sales_consistency_service import SalesConsistencyService
from app.services.sheets_service import SheetsService
from app.services.ticket_service import es_primera_cuota

COMPLETO, PARCIAL = 'completo', 'parcial'


def claves_de_fila(fila):
    return [c for c in (_limpiar_email(fila['email']), _limpiar_ig(fila['ig'])) if c]


def _dia_de(fila):
    return date.fromisoformat(fila['fecha'][:10]) if fila['fecha'] else None


def pagos_posteriores(claves):
    """{clave: [(venta, tipo)]} con los completos, parciales y cuotas cobrados de esos contactos."""
    if not claves:
        return {}
    filas = FinancialSale.query.filter(
        db.or_(func.lower(FinancialSale.mail_cliente).in_(claves),
               func.lower(func.replace(FinancialSale.instagram, '@', '')).in_(claves))
    ).all()
    salida = {}
    for v in filas:
        if (v.estado or '').strip().lower() not in ('', 'completada', 'confirmada') or not v.date:
            continue
        _, tipo, es_venta = ComercialService.clasificar_venta(v)
        if not es_venta and tipo != 'cuota':
            continue
        for clave in {_limpiar_email(v.mail_cliente), _limpiar_ig(v.instagram)}:
            if clave in claves:
                salida.setdefault(clave, []).append((v, tipo))
    return salida


def _precio(fila, venta):
    client = db.session.get(Client, fila['client_id']) if fila.get('client_id') else None
    if client and client.total_amount is not None:
        return float(client.total_amount)
    codigo = (SheetsService.parse_tipo_pago(fila.get('tipo_pago_raw'))[0]
              or SheetsService.parse_tipo_pago(venta.tipo_pago)[0])
    return SalesConsistencyService.PROGRAM_DEFAULT_TOTALS.get(codigo, 0.0)


def conversion_de(fila, pagos):
    """(venta, COMPLETO o PARCIAL) con la que se convirtió la seña `fila`, o (None, None).

    `pagos` es lo de `pagos_posteriores`. Gana el primer pago que la convierte: un completo o
    parcial posterior, o una cuota a menos de un mes."""
    dia = _dia_de(fila)
    candidatos = []
    for clave in claves_de_fila(fila):
        for v, tipo in pagos.get(clave, ()):
            dia_pago = v.date.date()
            if tipo == 'cuota':
                if dia and es_primera_cuota(dia, dia_pago):
                    candidatos.append((v, tipo))
            elif not dia or dia_pago >= dia:
                candidatos.append((v, tipo))
    if not candidatos:
        return None, None
    venta, tipo = min(candidatos, key=lambda c: (c[0].date, c[0].id))
    if tipo == 'cuota':
        pagado = float(fila['monto'] or 0.0) + float(venta.monto or 0.0)
        precio = _precio(fila, venta)
        tipo = COMPLETO if precio and pagado >= precio - 0.01 else PARCIAL
    return venta, tipo
