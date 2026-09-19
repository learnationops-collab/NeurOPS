"""Corrige las agendas históricas de leads que compraron pero cuya llamada quedó sin reportar.

Una venta registrada prueba que el lead asistió a la llamada, pero el closer muchas veces
declara la venta sin volver a la bandeja a reportar el resultado, y la agenda se queda en
'Pendiente' (o incluso en 'No Show'). Desde ahora eso se corrige solo al registrar cada venta
(ver SheetsService.post_to_sheets); este script es la pasada única sobre lo ya existente.

Regla (ver CloserService.pick_sale_appointment): por cada venta se toca **una sola agenda**, la
última que ya había empezado cuando se registró la venta (no la fecha que tipeó el closer, que
sale en su hora local y corrida un día), y solo si esa llamada quedó a menos de 14 días de la
venta. NO se marca todo el historial del lead: un No Show real de hace dos meses sigue siendo un
No Show aunque la persona haya comprado después, y darlo por asistido falsearía el show rate.
Cada cambio deja un evento `sale_show_up` en la agenda con lo que había antes.

Uso:
  python scripts/backfill_show_up_por_venta.py                          # dry-run: solo muestra qué cambiaría
  python scripts/backfill_show_up_por_venta.py --apply                  # aplica los cambios
  python scripts/backfill_show_up_por_venta.py --desde 2026-08-14       # solo ventas registradas desde esa fecha

`--desde` sirve para reparar lo reciente sin mover las estadísticas de meses ya cerrados.

Hay que correrlo una vez por base de datos: producción tiene la suya, así que ejecutarlo en
local no corrige nada allá.
"""
import os
import sys
from collections import Counter
from datetime import datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

# `create_app()` arranca el scheduler de recordatorios de seguimiento, que manda WhatsApp apenas
# arranca el proceso (ver reminder_scheduler.start_scheduler). Este script solo toca la base —y
# se corre a mano contra la de producción— así que ese envío tiene que quedar apagado siempre.
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'

from app import create_app
from app.services.closer_service import CloserService


def main(apply=False, desde=None):
    app = create_app()
    with app.app_context():
        res = CloserService.backfill_show_up_from_sales(dry_run=not apply, desde=desde)
        modo = 'APLICADO' if apply else 'DRY-RUN (no se escribió nada)'
        print(f"--- Show up por venta · {modo}" + (f" · ventas desde {desde.date()}" if desde else "") + " ---")
        print(f"Agendas afectadas: {res['total']}")

        if res['cambios']:
            print("Estado que tenían:", dict(Counter((c['closer_result_antes'] or '(vacío)') for c in res['cambios'])))
            print("Por mes:", dict(sorted(Counter(c['start_time'][:7] for c in res['cambios']).items())))
            print("\nDetalle:")
            for c in res['cambios']:
                print(f"  appt {c['appointment_id']} | {c['start_time'][:10]} | "
                      f"closer_result {c['closer_result_antes']!r} -> 'Show up' | venta {c['sale_id']}")

        if not apply and res['total']:
            print("\nPara aplicarlo: repetir el mismo comando con --apply")


if __name__ == '__main__':
    desde = None
    if '--desde' in sys.argv:
        desde = datetime.strptime(sys.argv[sys.argv.index('--desde') + 1], '%Y-%m-%d')
    main(apply='--apply' in sys.argv, desde=desde)
