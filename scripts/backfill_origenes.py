"""Backfill del origen guardado de agendas y ventas (ADR-W101, `app/services/origen_service.py`).

  1. Cada agenda (sin los marcadores de cualificado) recibe su origen: conversación y palabra clave de Setting,
     o el taller de Workshop. No toca las elegidas por el setter ni las del link.
  2. Cada venta nueva sin agenda recibe la última agenda de su persona hasta la venta.

Uso (en el servidor):
  python scripts/backfill_origenes.py                 # dry-run: cuenta qué quedaría, no guarda
  python scripts/backfill_origenes.py --apply         # lo guarda
  python scripts/backfill_origenes.py --apply --force # recalcula también las agendas que ya tenían origen
  --desde=AAAA-MM-DD   solo agendas y ventas desde esa fecha (por defecto, todas)
"""
import os
import sys
from collections import Counter
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app, db  # noqa: E402

TANDA = 400


def _arg(nombre):
    return next((a.split('=', 1)[1] for a in sys.argv if a.startswith(f'--{nombre}=')), None)


def main():
    aplicar, forzar = '--apply' in sys.argv, '--force' in sys.argv
    desde = datetime.strptime(_arg('desde'), '%Y-%m-%d') if _arg('desde') else datetime(2000, 1, 1)
    app = create_app()
    with app.app_context():
        from app.models import Appointment
        from app.models.sale import Sale
        from app.services import origen_service
        from app.services.comercial_cruces import no_es_marcador

        ids = [i for (i,) in db.session.query(Appointment.id).filter(
            Appointment.created_at >= desde, no_es_marcador()).order_by(Appointment.id)]
        cuenta = Counter()
        for i in range(0, len(ids), TANDA):
            agendas = Appointment.query.filter(Appointment.id.in_(ids[i:i + TANDA])).all()
            cuenta.update(origen_service.fijar_agendas(agendas, recalcular=forzar))
            if aplicar:
                db.session.commit()
            print(f'agendas {min(i + TANDA, len(ids))}/{len(ids)}', flush=True)
        ventas = Sale.query.filter(Sale.sold_at >= desde, Sale.kind == 'new', Sale.appointment_id.is_(None)).all()
        puestas = origen_service.fijar_ventas(ventas)
        if aplicar:
            db.session.commit()
        else:
            db.session.rollback()

        print('Agendas por atribución:', dict(cuenta))
        print(f'Ventas nuevas sin agenda: {len(ventas)} · con agenda puesta: {puestas}')
        print('GUARDADO' if aplicar else 'DRY-RUN: nada guardado (usar --apply)')


if __name__ == '__main__':
    main()
