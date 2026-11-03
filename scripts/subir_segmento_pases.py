"""Sube C→A y D→B en las agendas de closing futuras que vienen del triage (y sus reagendas), y deja ocupado su
evento de Google: nacieron «Disponible» como cualquier C/D y dejaban agendar encima (triage_service._segmento_al_pasar).
Sin avisar a los invitados.

Uso (en el servidor):
  python scripts/subir_segmento_pases.py            # dry-run
  python scripts/subir_segmento_pases.py --apply
"""
import os
import sys
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app, db  # noqa: E402


def main(apply=False):
    app = create_app()
    with app.app_context():
        from app.agendas_v2 import operacion
        from app.models import Appointment
        from app.services.google_service import GoogleService
        from app.services.triage_service import _SUBE_AL_PASAR

        filas = Appointment.query.filter(
            Appointment.segmento.in_(list(_SUBE_AL_PASAR)),
            Appointment.start_time >= datetime.utcnow(),
            *operacion.filtro_vigente(),
        ).order_by(Appointment.start_time).all()
        filas = [a for a in filas if a.agenda_triage_id or (a.agenda_payload or {}).get('pase_triage')]
        errores = 0
        for a in filas:
            nuevo = _SUBE_AL_PASAR[a.segmento]
            print(f'#{a.id} closer {a.closer_id} {a.start_time} UTC: {a.segmento} → {nuevo}')
            if not apply:
                continue
            payload = dict(a.agenda_payload or {})
            if isinstance(payload.get('segmento_lead'), dict):
                payload['segmento_lead'] = {**payload['segmento_lead'], 'segmento': nuevo}
                a.agenda_payload = payload
            a.segmento = nuevo
            db.session.commit()
            if not a.google_event_id:
                continue
            try:
                calendario = a.calendar_id or GoogleService._calendario(a.closer_id)
                GoogleService.get_service(a.closer_id).events().patch(
                    calendarId=calendario, eventId=a.google_event_id, body={'transparency': 'opaque'},
                    sendUpdates='none',
                ).execute()
            except Exception as ex:  # noqa: BLE001  (un evento que no se puede tocar no frena a los otros)
                errores += 1
                print(f'#{a.id}: error en Google {ex}')
        print(f'\n{len(filas)} agendas · {errores} con error en Google')
        if not apply:
            print('DRY-RUN: no se cambió nada. Con --apply se aplican.')


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
