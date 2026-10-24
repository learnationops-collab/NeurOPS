"""Carga en el formulario «Sesión de Aceleración» los puntos y las opciones de los segmentos A/B/C/D
(docs/plan_segmentos_triage.md §2.1 y §8.8) y activa la segmentación con la versión 2026-11.

Cambios (todos idempotentes: correrlo dos veces deja lo mismo):
  - Inversión: «Menos de $200 USD» nueva (3); «$500 a $1000» pasa a «Más de $500 USD» (8) y se quita
    «Más de $1000» (también de las reglas que la nombraban).
  - Examen: Ecuador (4), Chile (6) y Panamá (6) antes de «Otro».
  - Decide: «¿Quién más participa de esta decisión?» Solo yo (4) · Mis padres / Mi pareja / Otra persona (0).
  - Puntos del plan en Inversión, Etapa, Examen y Decide. Trabaja y Puntos a subir no se tocan (en observación).
  - Inversión y Etapa son clave (sin respuesta no hay segmento); Examen y Decide cuentan.
Lo guarda con `guardar_doc` (normaliza, republica los eventos y sube la versión de Thalamus).

Uso (en el servidor):
  python scripts/segmentos_formulario.py           # dry-run: muestra cómo queda
  python scripts/segmentos_formulario.py --apply   # lo guarda
"""
import copy
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app, db  # noqa: E402
from app.agendas_v2.modelos import SchedFormulario  # noqa: E402

FORM_ID = 'dg6gukz9emx'
INVERSION, ETAPA, EXAMEN, DECIDE = 'qglxqqlsgya', 'qg8xclvqc4c', 'qg6raaks2pe', 'qgnajtuxkuz'
MAS_DE_1000 = 'ogmgmpvwtgt'
# Máximo 24 (Inversión 8 + Etapa 6 + Examen 6 + Decide 4): los cortes de Mario, 18/14/8 puntos, son 75/58/33%.
SEGMENTO = {'activo': True, 'a': 75, 'b': 58, 'c': 33, 'sigma': 12, 'version': '2026-11'}

PUNTOS = {
    INVERSION: {'oglxqqlugub': 0, 'og-menos-200': 3, 'oglxqq0u44o': 6, 'ogmdr0s275v': 8},
    ETAPA: {'og8xclet205': 0, 'og8xclf4go4': 6, 'og94zlvu9m2': 6, 'og9azfspw7e': 3, 'og9ed3qtpzx': 3},
    EXAMEN: {'og77bdut6ym': 6, 'og7cr7tiwh9': 6, 'og6raas2nv9': 6, 'og-ecuador': 4, 'og-chile': 6, 'og-panama': 6,
             'og7imnc8sh8': 2, 'og6raaoi8vy': 2, 'og7nm9cskac': 2, 'og7p4glxgce': 0},
    DECIDE: {'ognajtws1ke': 4, 'ognajtnj7rg': 0, 'og-pareja': 0, 'og-otra-persona': 0},
}
ROL = {INVERSION: 'clave', ETAPA: 'clave', EXAMEN: 'cuenta', DECIDE: 'cuenta'}


def _op(id_, texto):
    return {'id': id_, 'texto': texto, 'corto': '', 'puntos': None, 'descalifica': False}


def _insertar(opciones, nueva, antes_de=None, despues_de=None):
    if any(o['id'] == nueva['id'] for o in opciones):
        return
    ids = [o['id'] for o in opciones]
    if despues_de in ids:
        opciones.insert(ids.index(despues_de) + 1, nueva)
    elif antes_de in ids:
        opciones.insert(ids.index(antes_de), nueva)
    else:
        opciones.append(nueva)


def preparar(datos):
    preguntas = {q['id']: q for q in datos['preguntas']}
    faltan = [q for q in PUNTOS if q not in preguntas]
    if faltan:
        raise SystemExit(f'Faltan preguntas en el formulario: {faltan}')

    inv = preguntas[INVERSION]['opciones']
    _insertar(inv, _op('og-menos-200', 'Menos de $200 USD.'), despues_de='oglxqqlugub')
    for o in inv:
        if o['id'] == 'ogmdr0s275v':
            o['texto'] = 'Más de $500 USD.'
    preguntas[INVERSION]['opciones'] = [o for o in inv if o['id'] != MAS_DE_1000]

    exa = preguntas[EXAMEN]['opciones']
    for id_, texto in (('og-ecuador', 'Examen de residencias | Ecuador'), ('og-chile', 'EUNACOM | Chile'),
                       ('og-panama', 'Examen de residencias | Panamá')):
        _insertar(exa, _op(id_, texto), antes_de='og7nm9cskac')

    dec = preguntas[DECIDE]
    dec['titulo'] = '¿Quién más participa de esta decisión?'
    textos = {'ognajtws1ke': 'Solo yo', 'ognajtnj7rg': 'Mis padres'}
    for o in dec['opciones']:
        o['texto'] = textos.get(o['id'], o['texto'])
    _insertar(dec['opciones'], _op('og-pareja', 'Mi pareja'), despues_de='ognajtws1ke')
    _insertar(dec['opciones'], _op('og-otra-persona', 'Otra persona'))

    for qid, puntos in PUNTOS.items():
        preguntas[qid]['segmento'] = ROL[qid]
        for o in preguntas[qid]['opciones']:
            if o['id'] in puntos:
                o['puntos'] = puntos[o['id']]

    for r in datos.get('reglas') or []:
        for c in r.get('cond') or []:
            c['ops'] = [x for x in c.get('ops') or [] if x != MAS_DE_1000]
    datos['segmento'] = dict(SEGMENTO)
    return datos


def mostrar(datos):
    for q in datos['preguntas']:
        if q['id'] not in PUNTOS:
            continue
        print(f"\n{q['titulo']} [{q.get('segmento')}]")
        for o in q['opciones']:
            print(f"   {o['puntos']!s:>4}  {o['texto']}  ({o['id']})")
    print('\nsegmento:', datos['segmento'])
    print('reglas:', [(r['id'], [c['ops'] for c in r['cond']]) for r in datos.get('reglas') or []])


def main(apply=False):
    app = create_app()
    with app.app_context():
        from app.agendas_v2.servicio import guardar_doc

        fila = db.session.get(SchedFormulario, FORM_ID)
        if not fila:
            raise SystemExit(f'No existe el formulario {FORM_ID}')
        datos = preparar(copy.deepcopy(fila.datos))
        mostrar(datos)
        if not apply:
            print('\nDRY-RUN: no se guardó nada. Con --apply se guarda.')
            return
        doc = guardar_doc('formularios', FORM_ID, datos)
        print('\nGuardado. Segmentación:', doc['segmento'])


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
