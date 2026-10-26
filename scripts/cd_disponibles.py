"""Marca «Disponible» en el Google Calendar del closer el evento de cada agenda C/D futura (app/agendas_v2/desplazar.py).
Las nuevas ya nacen así (operacion.crear_evento). Solo toca eventos que creó Work (`google_event_id`): los de
Calendly no se tocan. Sin avisar a los invitados.

Uso (en el servidor):
  python scripts/cd_disponibles.py            # dry-run: lista qué marcaría
  python scripts/cd_disponibles.py --apply    # los marca
"""
import os
import sys
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app  # noqa: E402


def main(apply=False):
    app = create_app()
    with app.app_context():
        from app.agendas_v2 import operacion
        from app.agendas_v2.desplazar import DESPLAZABLES
        from app.models import Appointment
        from app.services.google_service import GoogleService

        filas = Appointment.query.filter(
            Appointment.segmento.in_(DESPLAZABLES),
            Appointment.google_event_id.isnot(None),
            Appointment.start_time >= datetime.utcnow(),
            *operacion.filtro_vigente(),
        ).order_by(Appointment.start_time).all()
        marcadas = errores = ya = 0
        for a in filas:
            calendario = a.calendar_id or GoogleService._calendario(a.closer_id)
            try:
                service = GoogleService.get_service(a.closer_id)
                e = service.events().get(calendarId=calendario, eventId=a.google_event_id).execute()
                if e.get('transparency') == 'transparent':
                    ya += 1
                    continue
                print(f'#{a.id} {a.segmento} closer {a.closer_id} {a.start_time} UTC: {e.get("summary")}')
                if apply:
                    service.events().patch(
                        calendarId=calendario, eventId=a.google_event_id, body={'transparency': 'transparent'},
                        sendUpdates='none',
                    ).execute()
                marcadas += 1
            except Exception as ex:  # noqa: BLE001  (un evento que no se puede leer no frena a los otros)
                errores += 1
                print(f'#{a.id}: error {ex}')
        print(f'\n{len(filas)} agendas C/D con evento de Work · {marcadas} {"marcadas" if apply else "por marcar"} · '
              f'{ya} ya estaban · {errores} con error')
        if not apply:
            print('DRY-RUN: no se cambió nada. Con --apply se marcan.')


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
