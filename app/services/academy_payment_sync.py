"""Aviso a la Academia de cada pago nuevo (POST /api/v1/payments de la Academia).

Cada `FinancialSale` que nace de verdad (webhook de la hoja, venta declarada, pago cargado a mano;
no el `_rebuild_sales` de la resincronizacion completa, que recrea todas) se le avisa a la
Academia con el vencimiento que corresponde. La Academia lo aplica solo si extiende el acceso,
convierte la seña si el pago no es seña, lo deja en la bitacora del alumno y avisa a su gestor.
Ver docs/integracion_learnation_api.md §7.

Vencimiento por pago (decision del 2026-10-13):
- seña: 7 dias desde el pago;
- con alguna cuota pendiente del plan (`InstallmentPlan`) que vence despues del pago: esa fecha
  + GRACE_DAYS;
- sin cuotas pendientes: 4 meses desde el pago.

El HTTP corre en un hilo aparte (la venta ya esta guardada y la Academia puede tardar); si falla,
queda en el log y la venta no se toca.
"""
import threading
from datetime import date, datetime, timedelta

from flask import current_app
from sqlalchemy import func

from app.services.academy_access_service import AcademyAccessService, _add_months

GRACE_DAYS = 5


def compute_payment_expiration(client_id, programa_code, tipo_simple, fecha_pago):
    """Hasta cuando le da acceso este pago. Funcion pura sobre la base, sin HTTP."""
    from app.models import InstallmentPlan

    base = fecha_pago.date() if isinstance(fecha_pago, datetime) else (fecha_pago or date.today())
    if tipo_simple == 'seña':
        return base + timedelta(days=7)
    if client_id:
        query = InstallmentPlan.query.filter(
            InstallmentPlan.client_id == client_id,
            InstallmentPlan.estado == 'pendiente',
            InstallmentPlan.fecha_vencimiento > base,
        )
        if programa_code:
            # Los planes viejos no tienen programa: se cuentan igual.
            query = query.filter((InstallmentPlan.programa_code == programa_code) | (InstallmentPlan.programa_code.is_(None)))
        proxima = query.order_by(InstallmentPlan.fecha_vencimiento).first()
        if proxima:
            return proxima.fecha_vencimiento + timedelta(days=GRACE_DAYS)
    return _add_months(base, 4)


def build_payment_payload(sale):
    """El aviso de un pago, armado dentro de la request (lee la base). None si no se avisa."""
    from app.models import Client
    from app.services.sheets_service import SheetsService

    if (sale.estado or 'Completada') != 'Completada':
        return None
    # El webhook de la hoja guarda la venta con lo minimo y deja el resto en raw_data.
    raw = sale.raw_data or {}
    tipo_pago = sale.tipo_pago or raw.get('tipo_pago')
    email = (sale.mail_cliente or raw.get('mail_cliente') or raw.get('email') or '').strip().lower() or None
    client = Client.query.get(sale.client_id) if sale.client_id else None
    if not client and email:
        client = Client.query.filter(func.lower(Client.email) == email).first()
    email = email or ((client.email or '').strip().lower() if client else None)
    if not email and not client:
        return None

    programa, tipo = SheetsService.parse_tipo_pago(tipo_pago)
    fecha = sale.date or datetime.utcnow()
    expires_at = compute_payment_expiration(client.id if client else None, programa, tipo, fecha)

    return {
        'sale_id': sale.id,
        'email': email,
        'work_client_id': client.id if client else None,
        'fecha': fecha.date().isoformat() if isinstance(fecha, datetime) else str(fecha),
        'monto': sale.monto,
        'tipo_pago': tipo_pago,
        'product_slug': AcademyAccessService.get_product_mapping().get(programa) if programa else None,
        'is_deposit_payment': tipo == 'seña',
        'expires_at': expires_at.isoformat(),
    }


def notify_academy_of_payments(sales):
    """Avisa los pagos a la Academia fuera de la request. Nunca levanta: el pago ya esta guardado."""
    try:
        payloads = [p for p in (build_payment_payload(s) for s in sales) if p]
    except Exception as e:
        current_app.logger.error(f'[ACADEMY PAYMENTS] No se pudo armar el aviso: {e}')
        return
    if not payloads:
        return
    app = current_app._get_current_object()

    def _correr():
        with app.app_context():
            from app.services.learnation_service import LearnationService, LearnationAPIError
            for payload in payloads:
                try:
                    LearnationService.report_payment(payload)
                except LearnationAPIError as e:
                    app.logger.warning(f"[ACADEMY PAYMENTS] Venta {payload['sale_id']}: {e} ({e.status_code})")
                except Exception as e:
                    app.logger.error(f"[ACADEMY PAYMENTS] Venta {payload['sale_id']}: {e}")

    threading.Thread(target=_correr, daemon=True, name='academy-payments').start()
