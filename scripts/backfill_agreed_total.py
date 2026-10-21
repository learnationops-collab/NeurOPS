"""Frente L (docs/plan_personas.md): el total que negoció cada cliente (`clients.total_amount`) pasa a su
venta (`sales.agreed_total`).

Por persona (o por cliente, si el cliente no tiene persona):
  · si tiene exactamente una venta 'new' activa, se le escribe el total del cliente;
  · si tiene varias o ninguna, va a la lista para revisar y no se escribe nada;
  · si sus clientes duplicados tienen totales distintos, también va a la lista;
  · si la venta ya tiene otro total acordado, va a la lista (no se pisa).
Correrlo dos veces no cambia nada más.

Uso:
  python scripts/backfill_agreed_total.py            # prueba: cuántas se escriben y la lista para revisar
  python scripts/backfill_agreed_total.py --apply    # escribe
"""
import os
import sys
from collections import Counter, defaultdict

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import Client, Sale

EJEMPLOS = 40


def main(apply=False):
    totales = defaultdict(dict)   # clave -> {client_id: total}
    nombres = {}
    for cid, puuid, total, nombre in db.session.query(Client.id, Client.person_uuid, Client.total_amount,
                                                     Client.full_name).filter(Client.total_amount.isnot(None)):
        clave = f'p:{puuid}' if puuid else f'c:{cid}'
        totales[clave][cid] = float(total)
        nombres.setdefault(clave, nombre)

    ventas = defaultdict(list)
    for sale in Sale.query.filter(Sale.kind == 'new', Sale.status == 'active'):
        if sale.person_uuid:
            ventas[f'p:{sale.person_uuid}'].append(sale)
        elif sale.client_id:
            ventas[f'c:{sale.client_id}'].append(sale)

    escribir, ya, revisar = [], 0, defaultdict(list)
    for clave, por_cliente in totales.items():
        distintos = sorted(set(round(t, 2) for t in por_cliente.values()))
        suyas = ventas.get(clave, [])
        if len(distintos) > 1:
            revisar['totales_distintos'].append((clave, por_cliente, suyas))
            continue
        total = distintos[0]
        if not suyas:
            revisar['sin_venta'].append((clave, por_cliente, suyas))
        elif len(suyas) > 1:
            revisar['varias_ventas'].append((clave, por_cliente, suyas))
        elif suyas[0].agreed_total is None:
            escribir.append((suyas[0], total))
        elif round(suyas[0].agreed_total, 2) == total:
            ya += 1
        else:
            revisar['otro_total_en_la_venta'].append((clave, por_cliente, suyas))

    print(f'Personas o clientes con total_amount: {len(totales)}')
    print(f'  se escribe agreed_total: {len(escribir)} ventas (${sum(t for _, t in escribir):,.2f})')
    print(f'  ya lo tenían igual: {ya}')
    for motivo in ('totales_distintos', 'varias_ventas', 'otro_total_en_la_venta', 'sin_venta'):
        print(f'  para revisar, {motivo}: {len(revisar[motivo])}')
    print(f'  ventas new activas en total: {sum(len(v) for v in ventas.values())}')

    for motivo in ('totales_distintos', 'varias_ventas', 'otro_total_en_la_venta', 'sin_venta'):
        filas = revisar[motivo]
        if not filas:
            continue
        print(f'\n== {motivo} ({len(filas)}; primeros {min(EJEMPLOS, len(filas))})')
        for clave, por_cliente, suyas in filas[:EJEMPLOS]:
            detalle = ', '.join(f'venta {s.id} {s.program_code} {s.sold_at:%Y-%m-%d} acordado={s.agreed_total}'
                                for s in suyas) or 'sin ventas'
            print(f'  {clave} {nombres.get(clave)!r}: totales por cliente {por_cliente} | {detalle}')

    if not apply:
        print('\n[PRUEBA] No se escribió nada. Corré con --apply para escribir.')
        return Counter({k: len(v) for k, v in revisar.items()})
    for sale, total in escribir:
        sale.agreed_total = total
    db.session.commit()
    print(f'\nAplicado: {len(escribir)} ventas con agreed_total.')


if __name__ == '__main__':
    with create_app().app_context():
        main(apply='--apply' in sys.argv)
