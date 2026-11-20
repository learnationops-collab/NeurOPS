"""Backfill del segmento A/B/C/D en clientes y agendas (docs/plan_segmentos_triage.md §8.3).

Usa los puntos y cortes vigentes del formulario «Sesión de Aceleración» (correr antes
scripts/segmentos_formulario.py --apply). Fuentes, en orden:
  1. Agendas de Thalamus: su propio `agenda_payload` (opción por opción).
  2. Clientes: su último formulario de Thalamus (`formulario_payload`) o, si no tiene, el formulario
     viejo de Calendly/n8n (`form_data`, por texto: ver EQUIVALENCIAS).
  3. Agendas sin formulario propio: el segmento de su cliente.
Solo escribe las columnas `segmento*`; no toca los payloads ni nada más. Sin --force no pisa un
segmento ya guardado.

Uso (en el servidor):
  python scripts/backfill_segmentos.py            # dry-run: cuenta qué quedaría
  python scripts/backfill_segmentos.py --apply    # lo guarda
  python scripts/backfill_segmentos.py --apply --force   # recalcula también los que ya tienen
Al final informa las agendas que NO se pueden segmentar (por motivo y mes). Opciones del informe:
  --desde=AAAA-MM-DD   desde qué alta de agenda cuenta (por defecto 2026-10-01)
  --ids                lista los ids de esas agendas
"""
import os
import sys
from collections import Counter
from datetime import datetime

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app, db  # noqa: E402
from app.agendas_v2.modelos import SchedFormulario  # noqa: E402
from app.agendas_v2.nucleo.normalizar import normal_form  # noqa: E402
from app.agendas_v2.nucleo.segmento import segmentar  # noqa: E402
from app.models.booking import Appointment  # noqa: E402
from app.models.client import Client  # noqa: E402
from app.services.segmento_service import aplicar, copiar  # noqa: E402

# Las respuestas del formulario se leen igual en el backfill, el ajuste y el panel Segmentos (ADR-W187).
from app.services.formulario_respuestas import (  # noqa: E402,F401
    ALIAS, DECIDE, EQUIVALENCIAS, ETAPA, EXAMEN, FORM_ID, INVERSION, NO_DISPUESTO, PODRIA_AYUDA, _norm,
    resp_de_form_data, resp_de_payload,
)
from app.services.formulario_respuestas import de_thalamus as _de_thalamus  # noqa: E402


def _motivo_sin_segmento(a):
    c = a.client
    if _de_thalamus(a.agenda_payload):
        return 'thalamus: respuestas insuficientes'
    if isinstance(a.agenda_payload, dict) and a.agenda_payload.get('formulario_id'):
        return 'formulario que no segmenta (Consultoría, Hiring…)'
    if c is None:
        return 'agenda sin cliente'
    if _de_thalamus(c.formulario_payload):
        return 'cliente de Thalamus: respuestas insuficientes'
    if isinstance(c.form_data, dict) and c.form_data:
        return 'formulario viejo incompleto (no alcanza para segmentar)'
    return 'cliente sin formulario (no hay con qué segmentar)'


def informe_sin_segmento(desde):
    """Lo que el backfill NO puede resolver: agendas desde `desde` que quedan sin segmento, por motivo y mes.
    Usa la sesión sin guardar, así que cuenta lo que quedaría también en el dry-run (flush en memoria)."""
    db.session.flush()
    filas = Appointment.query.filter(Appointment.segmento.is_(None), Appointment.created_at >= desde).all()
    por_motivo = Counter((_motivo_sin_segmento(a), a.created_at.strftime('%Y-%m')) for a in filas)
    total = Appointment.query.filter(Appointment.created_at >= desde).count()
    print(f'\nAgendas desde {desde:%d/%m/%Y} que quedan sin segmento: {len(filas)} de {total}')
    for (motivo, mes), n in sorted(por_motivo.items()):
        print(f'  {mes}  {n:4d}  {motivo}')
    if len(filas) and '--ids' in sys.argv:
        print('  ids:', ', '.join(str(a.id) for a in filas))


def main(apply=False, force=False, desde=None):
    desde = desde or datetime(2026, 10, 1)
    app = create_app()
    with app.app_context():
        fila = db.session.get(SchedFormulario, FORM_ID)
        form = normal_form(FORM_ID, fila.datos if fila else {})
        if not form.get('segmento'):
            raise SystemExit('El formulario no tiene la segmentación activa: correr antes scripts/segmentos_formulario.py --apply')

        conteo = Counter()
        for c in Client.query.filter((Client.formulario_payload.isnot(None)) | (Client.form_data.isnot(None))).all():
            if c.segmento and not force:
                conteo['cliente_ya_tenia'] += 1
                continue
            if _de_thalamus(c.formulario_payload):
                seg, fuente = segmentar(form, resp_de_payload(c.formulario_payload)), 'thalamus'
            elif isinstance(c.form_data, dict) and c.form_data:
                seg, fuente = segmentar(form, resp_de_form_data(c.form_data)), 'viejo'
            else:
                continue
            aplicar(c, seg)
            conteo[f"cliente_{fuente}_{seg['segmento'] if seg else 'sin'}"] += 1

        for a in Appointment.query.all():
            if a.segmento and not force:
                conteo['agenda_ya_tenia'] += 1
                continue
            if _de_thalamus(a.agenda_payload):
                seg = segmentar(form, resp_de_payload(a.agenda_payload))
                aplicar(a, seg)
                conteo[f"agenda_thalamus_{seg['segmento'] if seg else 'sin'}"] += 1
            elif a.client is not None and a.client.segmento:
                copiar(a, a.client)
                conteo[f'agenda_del_cliente_{a.client.segmento}'] += 1

        for k in sorted(conteo):
            print(f'{k:32s} {conteo[k]}')
        informe_sin_segmento(desde)
        if apply:
            db.session.commit()
            print('\nGuardado.')
        else:
            db.session.rollback()
            print('\nDRY-RUN: no se guardó nada. Con --apply se guarda.')


if __name__ == '__main__':
    desde = next((datetime.strptime(a.split('=', 1)[1], '%Y-%m-%d') for a in sys.argv if a.startswith('--desde=')), None)
    main(apply='--apply' in sys.argv, force='--force' in sys.argv, desde=desde)
