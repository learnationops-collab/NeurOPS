"""Corrige las agendas históricas de leads que compraron pero cuya llamada quedó sin reportar.

Una venta registrada prueba que el lead asistió a la llamada, pero el closer muchas veces
declara la venta sin volver a la bandeja a reportar el resultado, y la agenda se queda en
'Pendiente' (o incluso en 'No Show'). Desde ahora eso se corrige solo al registrar cada venta
(ver SheetsService.post_to_sheets); este script es la pasada única sobre lo ya existente.

Regla (ver CloserService.mark_sale_appointment_as_show_up): por cada venta se toca **una sola
agenda**, la más reciente anterior o igual a la fecha de la venta. NO se marca todo el historial
del lead: un No Show real de hace dos meses sigue siendo un No Show aunque la persona haya
comprado después, y darlo por asistido falsearía el show rate.

Uso:
  python scripts/backfill_show_up_por_venta.py            # dry-run: solo muestra qué cambiaría
  python scripts/backfill_show_up_por_venta.py --apply    # aplica los cambios

Hay que correrlo una vez por base de datos: producción tiene la suya, así que ejecutarlo en
local no corrige nada allá.
"""
import os
import sys
from collections import Counter

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app
from app.services.closer_service import CloserService


def main(apply=False):
    app = create_app()
    with app.app_context():
        res = CloserService.backfill_show_up_from_sales(dry_run=not apply)
        modo = 'APLICADO' if apply else 'DRY-RUN (no se escribió nada)'
        print(f"--- Show up por venta · {modo} ---")
        print(f"Agendas afectadas: {res['total']}")

        if res['cambios']:
            print("Estado que tenían:", dict(Counter((c['closer_result_antes'] or '(vacío)') for c in res['cambios'])))
            print("Por mes:", dict(sorted(Counter(c['start_time'][:7] for c in res['cambios']).items())))
            print("\nDetalle:")
            for c in res['cambios']:
                print(f"  appt {c['appointment_id']} | {c['start_time'][:10]} | "
                      f"closer_result {c['closer_result_antes']!r} -> 'Show up' | venta {c['sale_id']}")

        if not apply and res['total']:
            print("\nPara aplicarlo: python scripts/backfill_show_up_por_venta.py --apply")


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
