"""Agrupa los pagos históricos (`FinancialSale`) en ventas (`Sale`) y les cuelga su plan de cuotas.
Las reglas están en `app/services/sales_grouping.py`.

Uso:
  python scripts/backfill_sales.py            # prueba: cuenta y muestra los dudosos, no escribe nada
  python scripts/backfill_sales.py --apply    # crea las ventas y llena sale_id en pagos y cuotas
  python scripts/backfill_sales.py --apply --rehacer   # borra todas las ventas y las vuelve a armar

`--rehacer` es para cuando ya hay ventas armadas de a un pago por el camino en vivo (`sale_service`),
por ejemplo después de corregir_comprador_pagador, que les cambia el cliente a pagos viejos. Se
corre antes de la carga de suscripciones: suelta también la venta de suscripciones y eventos.

Solo toma los pagos completados que todavía no tienen venta (`sale_id` NULL), así que correrlo dos
veces no duplica nada. Los pagos no completados (pendientes, reembolsos) quedan sin venta y se cuentan.

Las ventas que quedaron solo en seña hasta 2025 se cargan `cancelled`: no van a seguir, así que no
son deuda (decisión de Santiago, 20/10/2026). Las de después, a más de 30 días, quedan para revisar
(`sale_service.marcar_senas_sin_seguir`), sin cancelarse.
"""
import os
import sys
from collections import Counter
from datetime import datetime, timedelta

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import FinancialSale, InstallmentPlan, Sale
from app.services import sale_service
from app.services.comercial_service import venta_completada
from app.services.sales_grouping import agrupar, pago_de_fila, resumen

EJEMPLOS = 15
ULTIMO_ANIO_SENA_CANCELADA = 2025


def _cancelada(venta):
    """Una seña vieja que nunca siguió."""
    dia = venta.pagos[0].dia
    return venta.solo_sena and dia is not None and dia.year <= ULTIMO_ANIO_SENA_CANCELADA


def _crear_ventas(ventas, filas):
    """Guarda cada `Venta` como `Sale` y apunta sus pagos."""
    for venta in ventas:
        primera = filas[venta.pagos[0].id]
        personas = Counter(filas[p.id].person_uuid for p in venta.pagos if filas[p.id].person_uuid)
        sale = Sale(client_id=venta.client_id,
                    person_uuid=personas.most_common(1)[0][0] if personas else None, program_code=venta.programa, kind=venta.kind,
                    status='cancelled' if _cancelada(venta) else 'active',
                    sold_at=primera.date or datetime.utcnow(), closer_email=primera.email_vendedor,
                    setter=primera.setter, source='backfill', review_note=venta.review_note)
        db.session.add(sale)
        db.session.flush()
        for pago in venta.pagos:
            filas[pago.id].sale_id = sale.id


def _venta_del_plan(plan, ventas):
    """La venta de un plan de cuotas: la última de su programa vendida hasta el día que se armó el
    plan; si no hay, la primera después. Un plan sin programa solo se cuelga si el cliente tiene
    una sola venta."""
    if plan.programa_code:
        ventas = [v for v in ventas if v.program_code == plan.programa_code]
    elif len(ventas) != 1:
        return None
    if not ventas:
        return None
    tope = (plan.created_at or datetime.utcnow()) + timedelta(days=1)
    antes = [v for v in ventas if v.sold_at <= tope]
    return max(antes, key=lambda v: v.sold_at) if antes else min(ventas, key=lambda v: v.sold_at)


def _colgar_planes():
    colgados = sin_venta = 0
    planes = InstallmentPlan.query.filter(InstallmentPlan.sale_id.is_(None)).all()
    por_cliente = {}
    for sale in Sale.query.filter(Sale.client_id.in_({p.client_id for p in planes if p.client_id})).all():
        por_cliente.setdefault(sale.client_id, []).append(sale)
    for plan in planes:
        sale = _venta_del_plan(plan, por_cliente.get(plan.client_id, []))
        if sale:
            plan.sale_id = sale.id
            colgados += 1
        else:
            sin_venta += 1
    return colgados, sin_venta


def _mostrar(numeros, ventas, filas):
    print(f"Pagos agrupados: {numeros['pagos']} (fuera por no estar completados: {numeros['pagos_fuera']})")
    print(f"Ventas: {numeros['ventas']} {numeros['por_tipo']}")
    print(f"Ventas que quedan solo en seña: {numeros['solo_sena']} "
          f"(se cargan cancelled, hasta {ULTIMO_ANIO_SENA_CANCELADA}: {sum(1 for v in ventas if _cancelada(v))})")
    print(f"Para revisar: {numeros['para_revisar']} {numeros['motivos']}")
    dudosas = [v for v in ventas if v.notas][:EJEMPLOS]
    if dudosas:
        print(f'\nEjemplos para revisar (hasta {EJEMPLOS}):')
    for v in dudosas:
        pagos = ', '.join(f"#{p.id} {p.tipo or filas[p.id].tipo_pago} {p.dia}" for p in v.pagos)
        print(f"  [{v.programa or '?'}] cliente {v.client_id or '?'}: {pagos} -> {v.review_note}")


def _deshacer():
    """Suelta y borra todas las ventas, sin pasar por el before_flush de `sale_service`."""
    for sql in ('UPDATE sales SET subscription_id = NULL', 'UPDATE subscriptions SET sale_id = NULL',
                'UPDATE subscription_events SET sale_id = NULL', 'UPDATE installment_plans SET sale_id = NULL',
                'UPDATE financial_sales SET sale_id = NULL', 'DELETE FROM sales'):
        db.session.execute(db.text(sql))
    db.session.flush()


def ejecutar(apply=False, rehacer=False):
    """El agrupado dentro de un app context. Devuelve los números del resumen."""
    if rehacer:
        print(f'Rehacer: se borran {Sale.query.count()} ventas y se arman de nuevo.')
        _deshacer()
    todas = FinancialSale.query.filter(FinancialSale.sale_id.is_(None)).all()
    completadas = [f for f in todas if venta_completada(f)]
    filas = {f.id: f for f in completadas}
    ventas = agrupar([pago_de_fila(f) for f in completadas])
    numeros = resumen(ventas, len(todas) - len(completadas))
    _mostrar(numeros, ventas, filas)

    if not apply:
        db.session.rollback()
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para guardar.')
        return numeros
    _crear_ventas(ventas, filas)
    colgados, sin_venta = _colgar_planes()
    db.session.commit()
    marcadas = sale_service.marcar_senas_sin_seguir()
    print(f'\nAplicado: {len(ventas)} ventas creadas; cuotas del plan colgadas: {colgados}, sin venta: {sin_venta}; '
          f'señas sin seguir para revisar: {marcadas}.')
    return {**numeros, 'planes_colgados': colgados, 'planes_sin_venta': sin_venta, 'senas_para_revisar': marcadas}


if __name__ == '__main__':
    with create_app().app_context():
        ejecutar(apply='--apply' in sys.argv, rehacer='--rehacer' in sys.argv)
