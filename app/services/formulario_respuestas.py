"""Las respuestas de una persona al formulario de agenda «Sesión de Aceleración» (Thalamus, `FORM_ID`).

Dos fuentes, en este orden: su último formulario de Thalamus (`Client.formulario_payload`, opción por opción) o,
si no tiene, el formulario viejo de Calendly/n8n (`Client.form_data`, por texto: ver `EQUIVALENCIAS`). Sale de
`scripts/backfill_segmentos.py` (docs/plan_segmentos_triage.md §8.3), que ahora lo importa de acá: lo usan el
backfill, el ajuste de los puntos y el corte «Respuesta» del panel Segmentos (ADR-W187).
"""
import re
import unicodedata

FORM_ID = 'dg6gukz9emx'
INVERSION, ETAPA, EXAMEN, DECIDE = 'qglxqqlsgya', 'qg8xclvqc4c', 'qg6raaks2pe', 'qgnajtuxkuz'
PREGUNTAS = (INVERSION, DECIDE, ETAPA, EXAMEN)
# Opciones que se juntaron en otra (§8.8).
ALIAS = {'ogmgmpvwtgt': 'ogmdr0s275v'}
NO_DISPUESTO, PODRIA_AYUDA = 'oglxqqlugub', 'o8slpjgvje7'

# Formulario viejo (form_data): clave → [(patrón en el texto normalizado, opción de Thalamus)], en orden.
# «No estoy en una posición…» es la opción de hoy «podría conseguir ayuda», no «No estoy dispuesto» (§8.9).
EQUIVALENCIAS = {
    'inversion': (INVERSION, [(r'no estoy|no puedo|posicion', PODRIA_AYUDA), (r'200', 'oglxqq0u44o'),
                              (r'500|1000', 'ogmdr0s275v'), (r'sentido', 'oglxqq0u44o')]),
    'formacion': (ETAPA, [(r'^estoy en mi internado', 'og-internado'), (r'estudiante|internado', 'og8xclet205'),
                          (r'rural|social', 'og8xclf4go4'), (r'trabajando|general', 'og94zlvu9m2'),
                          (r'residente', 'og9azfspw7e'), (r'especialista', 'og9ed3qtpzx')]),
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
            op = ALIAS.get(r['opcion_id'], r['opcion_id'])
            # Hasta el 26/10 esa opción decía «no estoy en posición de invertir»: es la de «podría conseguir ayuda».
            if op == NO_DISPUESTO and 'posici' in _norm(r.get('respuesta')):
                op = PODRIA_AYUDA
            resp[r['pregunta_id']] = op
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


def de_thalamus(payload):
    return isinstance(payload, dict) and payload.get('formulario_id') == FORM_ID


def de_cliente(cliente):
    """{pregunta_id: opcion_id} del cliente, o None si no llenó ningún formulario que se entienda."""
    if de_thalamus(cliente.formulario_payload):
        return resp_de_payload(cliente.formulario_payload)
    if isinstance(cliente.form_data, dict) and cliente.form_data:
        return resp_de_form_data(cliente.form_data)
    return None
