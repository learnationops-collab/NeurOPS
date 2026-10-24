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
"""
import os
import re
import sys
import unicodedata
from collections import Counter

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

FORM_ID = 'dg6gukz9emx'
INVERSION, ETAPA, EXAMEN, DECIDE = 'qglxqqlsgya', 'qg8xclvqc4c', 'qg6raaks2pe', 'qgnajtuxkuz'
# Opciones que se juntaron en otra (§8.8).
ALIAS = {'ogmgmpvwtgt': 'ogmdr0s275v'}

# Formulario viejo (form_data): clave → [(patrón en el texto normalizado, opción de Thalamus)], en orden.
EQUIVALENCIAS = {
    'inversion': (INVERSION, [(r'no estoy|no puedo|posicion', 'oglxqqlugub'), (r'200', 'oglxqq0u44o'),
                              (r'500|1000', 'ogmdr0s275v'), (r'sentido', 'oglxqq0u44o')]),
    'formacion': (ETAPA, [(r'estudiante|internado', 'og8xclet205'), (r'rural|social', 'og8xclf4go4'),
                          (r'trabajando|general', 'og94zlvu9m2'), (r'residente', 'og9azfspw7e'),
                          (r'especialista', 'og9ed3qtpzx')]),
    'examen': (EXAMEN, [(r'colombia', 'og77bdut6ym'), (r'\bmir\b', 'og7cr7tiwh9'), (r'peru', 'og6raas2nv9'),
                        (r'enarm', 'og7imnc8sh8'), (r'usmle', 'og6raaoi8vy'), (r'no busco', 'og7p4glxgce'),
                        (r'otro', 'og7nm9cskac')]),
    'apoyo': (DECIDE, [(r'depende 100', 'ognajtws1ke'), (r'apoyo', 'ognajtnj7rg')]),
}


def _norm(s):
    s = unicodedata.normalize('NFKD', str(s or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', s).strip()


def resp_de_payload(payload):
    resp = {}
    for r in (payload or {}).get('respuestas') or []:
        if r.get('opcion_id'):
            resp[r['pregunta_id']] = ALIAS.get(r['opcion_id'], r['opcion_id'])
    return resp


def resp_de_form_data(fd):
    resp = {}
    for clave, (qid, reglas) in EQUIVALENCIAS.items():
        texto = _norm(fd.get(clave))
        if not texto or texto == 'none':
            continue
        opcion = next((op for patron, op in reglas if re.search(patron, texto)), None)
        if opcion:
            resp[qid] = opcion
    return resp


def _de_thalamus(payload):
    return isinstance(payload, dict) and payload.get('formulario_id') == FORM_ID


def main(apply=False, force=False):
    app = create_app()
    with app.app_context():
        fila = db.session.get(SchedFormulario, FORM_ID)
        form = normal_form(FORM_ID, fila.datos if fila else {})
        if not form['segmento']['activo']:
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
        if apply:
            db.session.commit()
            print('\nGuardado.')
        else:
            db.session.rollback()
            print('\nDRY-RUN: no se guardó nada. Con --apply se guarda.')


if __name__ == '__main__':
    main(apply='--apply' in sys.argv, force='--force' in sys.argv)
