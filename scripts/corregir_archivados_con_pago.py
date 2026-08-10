"""Corrige citas que el barrido automático de backlog (CloserService.archive_stale_backlog)
marcó 'Lead Perdido' por no haberse confirmado/procesado a tiempo, pero cuyo cliente en
realidad SÍ tiene un pago real registrado (FinancialSale) — si pagó, necesariamente asistió,
así que quedó mal marcado como perdido por un barrido de mantenimiento que no tenía forma de
saber que el lead convirtió por fuera del flujo normal de la app.

Caso que originó este script: "Andrés Simón" (Appointment #2855) — pagó el programa completo
en enero pero la cita nunca se procesó dentro de NeurOPS, así que el barrido automático la
archivó como perdida a los 30 días. Al corregirla manualmente se pidió generalizar la
corrección a cualquier otro lead en la misma situación.

Detecta exactamente las citas tocadas por ese barrido (closer_result='Lead Perdido' y
closer_notes con la firma "[Sistema] Archivado automáticamente...", ver
CloserService.archive_stale_backlog) cuyo cliente tiene una fila real en FinancialSale
(mismo cruce email/instagram/teléfono que ya usa CloserFollowUpService._client_has_sale).
Las corrige a closer_result='Show up' (si pagó, asistió) y deja una nota + ClientComment
explicando el porqué, sin tocar seguimiento_realizado ni closer_processed (ya quedan
correctos desde el archivado: procesada=True, y estos clientes ya paged/tienen venta así que
el pool de seguimientos los sigue tratando como "cerrada" por CloserFollowUpService, no
como "tomada", sin importar closer_result).

No dispara ninguna automatización (ni Discord, ni n8n, ni Google Sheets) — es una corrección
de datos, no una acción de venta.

Uso:
  python scripts/corregir_archivados_con_pago.py            # dry-run: solo lista lo afectado
  python scripts/corregir_archivados_con_pago.py --apply     # aplica la corrección

Para correr contra producción en vez de local (mismo patrón que actualizar_db.py), exportar
DATABASE_URL con la cadena de conexión de producción antes de invocar el script.
"""
import os
import sys

current_dir = os.path.abspath(os.path.dirname(__file__))
if os.path.basename(current_dir) == 'scripts':
    sys.path.append(os.path.abspath(os.path.join(current_dir, '..')))
else:
    sys.path.append(current_dir)

from app import create_app, db

ARCHIVE_NOTE_MARKER = "Archivado automáticamente"


def corregir_archivados_con_pago(apply=False):
    app = create_app()
    with app.app_context():
        from app.models import Appointment, ClientComment, User
        from app.services.closer_followup_service import CloserFollowUpService

        system_author = User.query.filter_by(role='admin').first() or User.query.first()

        candidatos = Appointment.query.filter(
            Appointment.closer_result == 'Lead Perdido',
            Appointment.closer_notes.ilike(f'%{ARCHIVE_NOTE_MARKER}%')
        ).all()

        print(f"--- Citas archivadas automáticamente como 'Lead Perdido': {len(candidatos)} ---")

        afectadas = []
        for appt in candidatos:
            if not appt.client:
                continue
            if CloserFollowUpService._client_has_sale(appt.client):
                afectadas.append(appt)

        print(f"--- De esas, con un pago real registrado (FinancialSale) del cliente: {len(afectadas)} ---")
        for appt in afectadas:
            print(f"  Appointment #{appt.id} · client #{appt.client_id} {appt.client.full_name} · start_time={appt.start_time}")

        if not apply:
            print("\n[DRY-RUN] Nada se modificó. Corré con --apply para corregir de verdad.")
            return afectadas

        note = "[Corrección manual] El cliente sí tiene un pago real registrado (FinancialSale) — no era un lead perdido, quedó mal archivado por el barrido automático de backlog sin haberse procesado dentro de la app."
        for appt in afectadas:
            appt.closer_result = 'Show up'
            appt.closer_notes = f"{appt.closer_notes}\n{note}".strip() if appt.closer_notes else note
            if system_author:
                db.session.add(ClientComment(
                    client_id=appt.client_id,
                    author_id=system_author.id,
                    text=f"Estado corregido: la cita #{appt.id} había quedado marcada 'Lead Perdido' por el archivado automático de backlog, pero el cliente sí tiene un pago real registrado. Se corrigió a 'Show up'."
                ))

        db.session.commit()
        print(f"\n[OK] {len(afectadas)} cita(s) corregida(s) a closer_result='Show up'.")
        return afectadas


if __name__ == '__main__':
    corregir_archivados_con_pago(apply='--apply' in sys.argv)
