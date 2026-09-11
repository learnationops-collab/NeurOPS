"""Recalcula el snapshot de métricas de TODOS los WorkshopEvent ya cargados.

Desde el 05/09/2026 las agendas de un taller se cuentan hasta el taller siguiente
(ver app/services/workshop_metrics_service.py). Los talleres registrados antes
conservan el snapshot viejo (vivo solo el día D, grabación 2 días) hasta que
caiga una agenda/venta nueva en su ventana o alguien apriete "Resync sistema"
en el panel, uno por uno. Este script es esa pasada única sobre lo ya cargado:
el mismo cálculo que el botón, para cada taller, mostrando antes y después.

Uso:
  python scripts/resync_workshop_events.py            # dry-run: solo muestra qué cambiaría
  python scripts/resync_workshop_events.py --apply    # escribe el snapshot nuevo

Hay que correrlo una vez por base de datos: producción tiene la suya, así que
ejecutarlo en local no corrige nada allá.
"""
import os
import sys
from datetime import datetime

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db
from app.models import WorkshopEvent
from app.services.workshop_metrics_service import calcular_prefill

CAMPOS = ('aplicaciones_form', 'agendas_exitosas', 'show_up_sales_call', 'sales', 'cash_collected')


def main(apply=False):
    app = create_app()
    with app.app_context():
        eventos = WorkshopEvent.query.order_by(WorkshopEvent.date).all()
        modo = 'APLICADO' if apply else 'DRY-RUN (no se escribió nada)'
        print(f"--- Resync de {len(eventos)} workshop(s) · {modo} ---")

        cambiados = 0
        for ev in eventos:
            data = calcular_prefill(ev.date)
            v = data['ventana']
            antes = {c: getattr(ev, c) or 0 for c in CAMPOS}
            despues = {c: data[c] for c in CAMPOS}
            diff = {c: (antes[c], despues[c]) for c in CAMPOS if antes[c] != despues[c]}

            abierta = ', abierta hasta hoy)' if v['abierta'] else ')'
            rango = f"{v['desde']} → {v['hasta']} ({v['dias']} día/s{abierta}"
            estado = 'sin cambios' if not diff else ', '.join(f"{c}: {a} → {d}" for c, (a, d) in diff.items())
            print(f"{ev.date} {ev.name[:30]:<30} ventana {rango:<45} {estado}")

            if diff:
                cambiados += 1
                if apply:
                    for c in CAMPOS:
                        setattr(ev, c, despues[c])
                    ev.synced_at = datetime.utcnow()

        if apply:
            db.session.commit()
            print(f"\nListo: {cambiados} workshop(s) actualizados.")
        else:
            print(f"\n{cambiados} workshop(s) cambiarían.")
            print("Para aplicarlo: python scripts/resync_workshop_events.py --apply")


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
