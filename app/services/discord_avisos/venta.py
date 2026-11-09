"""El aviso de cada venta o cobro registrado (ADR-W121): a #wins siempre y a #onboardings si entra un alumno
nuevo (pago completo, primer pago o seña).

Reemplaza al flujo «New Sales» de n8n (sus avisos a Discord, el WhatsApp interno y la página de Notion). Sale de
SheetsService.post_to_sheets, con el mismo interruptor que el webhook de n8n (`enviar_webhook`): una
corrección que no reenvía no avisa.

Se arma en un hilo unos segundos después del registro: el plan de cuotas y la venta (Sale) se guardan en la
misma request, después del pago, y la tarjeta los muestra.
"""
import threading
import time

from flask import current_app

from app import db
from app.services.discord_avisos.tarjeta import Aviso, avisar, corto

ESPERA = 4  # segundos, para que la request termine de guardar el plan

# (emoji, título, tono) por tipo canónico de pago (SheetsService.parse_tipo_pago).
TIPOS = {
    'completo': ('💰', 'Venta · pago completo', 'verde'),
    'parcial': ('💰', 'Venta · primer pago', 'verde'),
    'seña': ('🤝', 'Seña', 'amarillo'),
    'cuota': ('💵', 'Cobro de cuota', 'azul'),
    'upsell': ('🚀', 'Upsell', 'verde'),
    'renovacion': ('🔁', 'Renovación', 'verde'),
}
ESTADOS = {'Pendiente': 'amarillo', 'Cancelada': 'rojo'}
ALUMNO_NUEVO = ('completo', 'parcial', 'seña')


def _plata(n):
    return f"${n:,.0f}".replace(',', '.') if n is not None else '-'


def _plan_y_saldo(pago):
    """(cuotas pendientes [(fecha, monto)], saldo) de la venta del pago; ([], None) si no hay venta."""
    from app.models import FinancialSale, InstallmentPlan, Sale

    if not pago.sale_id:
        return [], None
    venta = db.session.get(Sale, pago.sale_id)
    cuotas = (InstallmentPlan.query.filter_by(sale_id=pago.sale_id, estado='pendiente')
              .order_by(InstallmentPlan.fecha_vencimiento).all())
    saldo = None
    if venta and venta.agreed_total:
        pagado = db.session.query(db.func.coalesce(db.func.sum(FinancialSale.monto), 0)).filter(
            FinancialSale.sale_id == pago.sale_id).scalar() or 0
        saldo = max(0.0, float(venta.agreed_total) - float(pagado))
    return [(c.fecha_vencimiento, c.monto) for c in cuotas], saldo


def armar(pago, convirtio_sena=False):
    """El Aviso de un FinancialSale ya guardado."""
    from app.models import User
    from app.services.closer_service import PROGRAM_LABELS
    from app.services.sheets_service import SheetsService

    programa, tipo = SheetsService.parse_tipo_pago(pago.tipo_pago)
    emoji, titulo, tono = TIPOS.get(tipo, ('💰', 'Pago registrado', 'verde'))
    tono = ESTADOS.get(pago.estado, tono)
    contacto = pago.contacto()
    closer = User.query.filter(db.func.lower(User.email) == (pago.email_vendedor or '').lower()).first() \
        if pago.email_vendedor else None
    cuotas, saldo = _plan_y_saldo(pago)

    chips = [{'icono': 'dinero', 'texto': _plata(pago.monto)}]
    if programa:
        chips.append({'marca': programa, 'texto': PROGRAM_LABELS.get(programa, programa)})
    if pago.metodo_pago:
        chips.append({'icono': 'billetera', 'texto': pago.metodo_pago})
    if convirtio_sena:
        chips.append({'icono': 'check', 'texto': 'Convirtió su seña'})

    cajas = [{'titulo': 'Closer', 'valor': closer.username if closer else (pago.email_vendedor or '-'),
              'color': 'azul', 'icono': 'personas'},
             {'titulo': 'Origen', 'valor': pago.setter or '-', 'color': 'verde', 'icono': 'bandeja'}]
    if saldo is not None:
        cajas.append({'titulo': 'Saldo', 'valor': _plata(saldo), 'sub': 'pagado' if saldo == 0 else 'por cobrar',
                      'color': 'verde' if saldo == 0 else 'rojo', 'icono': 'dinero'})
    tiles = []
    if cuotas:
        detalle = ' · '.join(f"{f.strftime('%d/%m')} {_plata(m)}" for f, m in cuotas[:6])
        tiles.append({'icono': 'cal', 'titulo': f'Plan: {len(cuotas)} cuota{"s" if len(cuotas) > 1 else ""} pendiente{"s" if len(cuotas) > 1 else ""}',
                      'sub': corto(detalle, 140)})
    elif pago.segundo_pago:
        tiles.append({'icono': 'cal', 'titulo': 'Segundo pago', 'sub': corto(pago.segundo_pago, 140)})
    if pago.examen:
        tiles.append({'icono': 'meta', 'titulo': 'Examen', 'sub': corto(pago.examen, 140)})

    return Aviso(emoji=emoji, titulo=titulo, nombre=contacto.get('nombre_cliente') or 'Cliente',
                 telefono=contacto.get('telefono') or '', evento=titulo, estado=pago.estado or '', tono=tono,
                 chips=chips, cajas=cajas, tiles=tiles, pie=f'Venta · pago #{pago.id}',
                 menciones=[closer.discord_id] if closer and closer.discord_id else [])


def canales(pago):
    """#wins, siempre; #onboardings, solo si entra un alumno nuevo (pago completo, primer pago o seña), como hacía n8n."""
    from app.services.sheets_service import SheetsService

    _, tipo = SheetsService.parse_tipo_pago(pago.tipo_pago)
    return ['wins', 'onboarding'] if tipo in ALUMNO_NUEVO else ['wins']


def avisar_pago(pago_id, convirtio_sena=False):
    """Avisa el pago `pago_id` en un hilo. Nunca lanza."""
    app = current_app._get_current_object()

    def correr():
        with app.app_context():
            try:
                from app.models import FinancialSale

                if not app.testing:
                    time.sleep(ESPERA)
                pago = db.session.get(FinancialSale, pago_id)
                if pago:
                    aviso = armar(pago, convirtio_sena)
                    for canal in canales(pago):
                        avisar(canal, aviso, etiqueta='VENTA', en_hilo=False)
            except Exception as e:  # noqa: BLE001
                app.logger.error(f'[VENTA] No se pudo avisar el pago #{pago_id} a Discord: {e}')
            finally:
                db.session.remove()

    if app.testing:
        correr()
    else:
        threading.Thread(target=correr, daemon=True, name='discord-venta').start()
