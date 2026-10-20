"""Cada pago con su venta, por cualquier camino que entre (20/10/2026).

Un pago (`FinancialSale`) nace o se corrige desde muchos lados: la venta declarada
(`SheetsService.post_to_sheets`), el pago cargado a mano en la ficha, el webhook, la edición y la
edición en lote de Operaciones, la corrección desde Diferencias. En vez de acordarse de cada uno,
un `before_flush` (como `workshop_live_sync`) le busca la venta a todo pago completado que no la
tenga, con la misma regla del agrupado retroactivo (`sales_grouping.decidir`):
  · un pago nuevo se suma a la venta vigente de su cliente y programa, o abre una nueva;
  · si a un pago le cambian el tipo, el programa o el cliente, se lo vuelve a ubicar;
  · si quien lo guarda ya eligió la venta (`sale_id`), se respeta;
  · una venta que se queda sin pagos ni plan de cuotas se borra.
"""
import logging
from datetime import datetime

from sqlalchemy import event, inspect

from app import db
from app.models import FinancialSale, InstallmentPlan, Sale
from app.services.comercial_service import venta_completada
from app.services.sales_grouping import KIND_DE_TIPO, Venta, decidir, pago_de_fila

logger = logging.getLogger(__name__)

# Lo que, al cambiar, puede llevar un pago a otra venta.
CAMPOS_QUE_MUEVEN = ('tipo_pago', 'client_id', 'estado')


def _orden(fila):
    return (fila.date or datetime.max, fila.id or 0)


def _pagos_de(session, sale, excepto):
    """Los pagos de `sale` en orden, con los de este mismo flush que todavía no se guardaron."""
    guardados = session.query(FinancialSale).filter(FinancialSale.sale_id == sale.id).all() if sale.id else []
    nuevos = [f for f in session.new if isinstance(f, FinancialSale) and f.sale is sale]
    return sorted((f for f in {*guardados, *nuevos} if f is not excepto), key=_orden)


def _vigente(session, fila, pago):
    """La venta vigente del cliente en el programa del pago: la última vendida hasta su fecha
    (un pago viejo cargado hoy va a la venta de su época), o si no hay, la más reciente."""
    if not fila.client_id:
        return None
    q = session.query(Sale).filter(Sale.client_id == fila.client_id, Sale.status == 'active',
                                   Sale.program_code.is_(None) if pago.programa is None
                                   else Sale.program_code == pago.programa)
    pendientes = [s for s in session.new if isinstance(s, Sale) and s.client_id == fila.client_id
                  and s.program_code == pago.programa]
    # La venta de la que sale este mismo pago (al corregirlo) no cuenta si se queda sin nada.
    candidatas = [s for s in q.all() + pendientes if _pagos_de(session, s, fila)]
    if not candidatas:
        return None
    hasta = fila.date or datetime.max
    antes = [s for s in candidatas if (s.sold_at or datetime.min) <= hasta]
    return max(antes or candidatas, key=lambda s: (s.sold_at or datetime.min, s.id or 0))


def _anotar(sale, notas):
    if notas:
        partes = [p for p in (sale.review_note or '').split('; ') if p]
        sale.review_note = '; '.join(dict.fromkeys(partes + notas))[:255]


def ubicar(session, fila):
    """Le da su venta a `fila` (sin guardar): la vigente o una nueva."""
    pago = pago_de_fila(fila)
    sale = _vigente(session, fila, pago)
    abierta = None
    if sale is not None:
        abierta = Venta(sale.program_code, sale.kind, [pago_de_fila(f) for f in _pagos_de(session, sale, fila)])
    abre, notas = decidir(abierta, pago)
    if abre:
        sale = Sale(client_id=fila.client_id, program_code=pago.programa, kind=KIND_DE_TIPO.get(pago.tipo, 'new'),
                    sold_at=fila.date or datetime.utcnow(), closer_email=fila.email_vendedor, setter=fila.setter,
                    source='auto')
        session.add(sale)
    _anotar(sale, notas)
    fila.sale = sale
    return sale


def _soltar_si_quedo_vacia(session, sale, excepto):
    """Borra la venta si `excepto` era lo único que tenía (ni otros pagos ni plan de cuotas)."""
    if sale is None or sale.id is None or _pagos_de(session, sale, excepto):
        return
    if session.query(InstallmentPlan).filter(InstallmentPlan.sale_id == sale.id).first():
        return
    session.delete(sale)


def _cambio(fila, campo):
    return inspect(fila).attrs[campo].history.has_changes()


def _antes(fila):
    """La venta que tenía la fila al empezar este flush (None si no tenía)."""
    previos = inspect(fila).attrs.sale_id.history.deleted
    sale_id = previos[0] if previos else fila.sale_id
    return db.session.get(Sale, sale_id) if sale_id else None


def venta_elegida(valor, client_id, programa):
    """El id de la venta que eligió a mano quien carga o corrige un pago, validado. None (o vacío)
    es «que la ubique el sistema». Levanta ValueError con el motivo."""
    if valor in (None, ''):
        return None
    try:
        sale = db.session.get(Sale, int(valor))
    except (TypeError, ValueError):
        sale = None
    if sale is None or not client_id or sale.client_id != client_id:
        raise ValueError('Esa venta no es de este cliente.')
    if programa and sale.program_code and sale.program_code != programa:
        raise ValueError(f'Esa venta es de {sale.program_code} y el pago es de {programa}: elegí una venta '
                         'del mismo programa, o «Automática».')
    return sale.id


def mantener(session):
    """El cuerpo del `before_flush`: nuevos, corregidos y borrados."""
    with session.no_autoflush:
        for fila in [f for f in session.new if isinstance(f, FinancialSale)]:
            if fila.sale_id is None and fila.sale is None and venta_completada(fila):
                ubicar(session, fila)
        for fila in [f for f in session.dirty if isinstance(f, FinancialSale)]:
            if _cambio(fila, 'sale_id'):
                # Alguien lo movió a mano: se respeta, y la venta de la que salió se borra si quedó vacía.
                _soltar_si_quedo_vacia(session, _antes(fila), fila)
                continue
            if _cambio(fila, 'sale') or not any(_cambio(fila, c) for c in CAMPOS_QUE_MUEVEN):
                continue
            anterior = _antes(fila)
            fila.sale = None
            if venta_completada(fila):
                ubicar(session, fila)
            if anterior is not None and anterior is not fila.sale:
                _soltar_si_quedo_vacia(session, anterior, fila)
        for fila in [f for f in session.deleted if isinstance(f, FinancialSale)]:
            if fila.sale_id:
                _soltar_si_quedo_vacia(session, db.session.get(Sale, fila.sale_id), fila)


def register_sale_tracking(app):
    @event.listens_for(db.session, 'before_flush')
    def _ventas_before_flush(session, flush_context, instances):
        try:
            mantener(session)
        except Exception as e:
            # El pago se guarda igual: sin venta queda para el script de agrupado.
            logger.error(f'[SALES] No se pudo ubicar la venta del pago: {e}')
