"""Carga en el formulario «Sesión de Aceleración» los puntos del segmento A/B/C/D sacados de los datos y el
ruteo por segmento (docs/plan_segmentos_triage.md §8.9). Versión 2026-12, modo suma.

Cambios (todos idempotentes: correrlo dos veces deja lo mismo):
  - `puntosSeg` (-3 a +2) en Inversión, Etapa, Examen y Decide: 0 es el lead promedio, lo que resta compra
    menos. Salen de una logística penalizada sobre 736 leads (jun–sep 2026, 77 compras a 60 días), pasada a
    enteros. `puntos` (la nota de 0 a 10 del closer) no se toca.
  - Cortes A ≥ 4 (con la inversión al doble, los mismos A de antes), B ≥ 1, C ≥ -1, D el resto. Quien no
    invierte no llega a B (corte duro: el script frena si una opción lo rompe).
  - Ruteo: las reglas con url (mk-academy: estudiante que no invierte, también «podría conseguir ayuda»)
    quedan primero; las mk-g* se reemplazan por una por segmento:
    A → Grupo 5 · B → Grupo 4 · C y D → Triage (lo crea), con el desborde de siempre. «Todo lo demás»
    (sin segmento: falta Inversión o Etapa) sigue en Grupo 1.
  - Examen: Ecuador, Chile y Panamá antes de «Otro». Decide queda como siempre; con --quien-decide pasa a
    «¿Quién más participa de esta decisión?».
Lo guarda con `guardar_doc` (normaliza, republica los eventos y sube la versión de Thalamus). Después correr
scripts/backfill_segmentos.py --apply --force para recalcular los segmentos guardados.

Uso (en el servidor):
  python scripts/segmentos_formulario.py                   # dry-run: muestra cómo queda
  python scripts/segmentos_formulario.py --apply           # lo guarda
  python scripts/segmentos_formulario.py --apply --quien-decide   # con la pregunta nueva de Decide
"""
import copy
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app, db  # noqa: E402
from app.agendas_v2.modelos import SchedFormulario  # noqa: E402
from app.agendas_v2.nucleo.segmento import SEG_Q  # noqa: E402

FORM_ID = 'dg6gukz9emx'
INVERSION, ETAPA, EXAMEN, DECIDE = 'qglxqqlsgya', 'qg8xclvqc4c', 'qg6raaks2pe', 'qgnajtuxkuz'
SEGMENTO = {'activo': True, 'modo': 'suma', 'a': 4, 'b': 1, 'c': -1, 'sigma': 1, 'version': '2026-12.1'}

# Efecto de cada respuesta en la compra (log-odds centrado; un punto ≈ 0,23, unas 1,26 veces las chances).
PUNTOS_SEG = {
    # La inversión pesa el doble que el resto (pedido del equipo, 27/10): $500 o más +4 · $200–$500 +2.
    # Quien no invierte no puede llegar a A ni a B (corte duro, ver _chequear_corte): «podría conseguir ayuda» -3,
    # «no estoy dispuesto» -4. «Menos de $200» (solo en el servidor de prueba) -2: como mucho B.
    INVERSION: {'ogmgmpvwtgt': 4, 'oa9pmy94tfg': 4, 'ogmdr0s275v': 4, 'oglxqq0u44o': 2, 'og-menos-200': -2,
                'o8slpjgvje7': -3, 'oglxqqlugub': -4},
    # Rural y general (+1) · especialista (-1) · residente (-2) · estudiante o interno (-3: compra 3,4%).
    ETAPA: {'og8xclet205': -3, 'og8xclf4go4': 1, 'og94zlvu9m2': 1, 'og9azfspw7e': -2, 'og9ed3qtpzx': -1},
    # Colombia y Perú (+1) · Otro y USMLE (0) · no busca examen (-1) · ENARM (-2). MIR daba +1 y queda en 0:
    # España no es mercado prioritario (Mario, 24/10/2026). Chile, Panamá y Ecuador no tienen datos propios:
    # siguen el orden que les dio Mario (Chile y Panamá como Colombia, Ecuador abajo).
    EXAMEN: {'og77bdut6ym': 1, 'og6raas2nv9': 1, 'og7cr7tiwh9': 0, 'og-chile': 1, 'og-panama': 1, 'og-ecuador': 0,
             'og7nm9cskac': 0, 'og6raaoi8vy': 0, 'og7imnc8sh8': -2, 'og7p4glxgce': -1},
    # Decide solo (+1) · necesita apoyo (-1).
    DECIDE: {'ognajtws1ke': 1, 'ognajtnj7rg': -1, 'og-pareja': -1, 'og-otra-persona': -1},
}
NO_INVIERTE = ('o8slpjgvje7', 'oglxqqlugub')
ROL = {INVERSION: 'clave', ETAPA: 'clave', EXAMEN: 'cuenta', DECIDE: 'cuenta'}
# C y D van solo al triage (Mario, 26/10): el grupo «Triage», último en el orden, con las personas del triage.
# Máxima disponibilidad: el lead ve los horarios de las dos. Si están llenas desborda a «Todos los closers».
TRIAGE = 'ws-triage'
POR_SEGMENTO = {'A': 'ws-g5', 'B': 'ws-g4', 'C': TRIAGE, 'D': TRIAGE}
# La sesión de cada segmento (Mario, 27/10): A y B, la Sesión de Aceleración del formulario; C y D, la
# Sesión diagnóstica de 30 min con el triage.
SESION_TRIAGE = 'sesion-diagnostica'
SESION_POR_SEGMENTO = {'C': SESION_TRIAGE, 'D': SESION_TRIAGE}
RESTO = 'ws-g1'

# Decide: la pregunta de siempre, y la nueva «¿Quién más participa?» para cuando se decida (--quien-decide).
DECIDE_ORIGINAL = ('Necesitas apoyo (logístico, emocional o económico) de alguien, para poder tomar decisiones en tu '
                   'aprendizaje o es algo que depende 100% de ti?',
                   {'ognajtws1ke': 'No, depende 100% de mi', 'ognajtnj7rg': 'Si, necesito el apoyo de mis padres/pareja'})
DECIDE_NUEVA = ('¿Quién más participa de esta decisión?', {'ognajtws1ke': 'Solo yo', 'ognajtnj7rg': 'Mis padres'})


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


def _reglas(reglas, inversion):
    """Las reglas con url (mk-academy) primero y una por segmento después; las mk-g* se van.
    mk-academy: el estudiante que no invierte, sea «no estoy dispuesto» o «podría conseguir ayuda» (Mario, 26/10)."""
    filtros = [r for r in reglas if r.get('url')]
    existen = {o['id'] for o in inversion['opciones']}
    for r in filtros:
        if r.get('id') != 'mk-academy':
            continue
        for c in r['cond']:
            if c['q'] == INVERSION:
                c['ops'] = [o for o in ('oglxqqlugub', 'o8slpjgvje7') if o in existen]
    por_seg = [{'id': f'seg-{s.lower()}', 'grupo': g, 'url': '', 'cond': [{'q': SEG_Q, 'ops': [s]}],
                **({'evento': SESION_POR_SEGMENTO[s]} if s in SESION_POR_SEGMENTO else {})}
               for s, g in POR_SEGMENTO.items()]
    return filtros + por_seg


def preparar(datos, quien_decide=False):
    preguntas = {q['id']: q for q in datos['preguntas']}
    faltan = [q for q in PUNTOS_SEG if q not in preguntas]
    if faltan:
        raise SystemExit(f'Faltan preguntas en el formulario: {faltan}')

    exa = preguntas[EXAMEN]['opciones']
    for id_, texto in (('og-ecuador', 'Examen de residencias | Ecuador'), ('og-chile', 'EUNACOM | Chile'),
                       ('og-panama', 'Examen de residencias | Panamá')):
        _insertar(exa, _op(id_, texto), antes_de='og7nm9cskac')

    dec = preguntas[DECIDE]
    if quien_decide:
        dec['titulo'] = DECIDE_NUEVA[0]
        textos = DECIDE_NUEVA[1]
        _insertar(dec['opciones'], _op('og-pareja', 'Mi pareja'), despues_de='ognajtws1ke')
        _insertar(dec['opciones'], _op('og-otra-persona', 'Otra persona'))
    else:
        # La pregunta de siempre (y, si se había cargado la nueva, vuelve a esta).
        dec['titulo'] = DECIDE_ORIGINAL[0]
        textos = DECIDE_ORIGINAL[1]
        dec['opciones'] = [o for o in dec['opciones'] if o['id'] not in ('og-pareja', 'og-otra-persona')]
    for o in dec['opciones']:
        o['texto'] = textos.get(o['id'], o['texto'])

    for qid, puntos in PUNTOS_SEG.items():
        preguntas[qid]['segmento'] = ROL[qid]
        for o in preguntas[qid]['opciones']:
            if o['id'] in puntos:
                o['puntosSeg'] = puntos[o['id']]
        # Una opción nueva sin puntos no suma ni resta: mejor frenar que segmentar mal.
        sin = [o['texto'] for o in preguntas[qid]['opciones'] if o.get('puntosSeg') is None]
        if sin:
            raise SystemExit(f'Opciones sin puntos de segmento en {qid}: {sin}')

    _chequear_corte(preguntas)
    datos['segmento'] = dict(SEGMENTO)
    datos['reglas'] = _reglas(datos.get('reglas') or [], preguntas[INVERSION])
    datos['resto'] = RESTO
    return datos


def _chequear_corte(preguntas):
    """Corte duro: quien no invierte, con lo mejor en todo lo demás, no llega a B. Frena si una opción nueva lo rompe."""
    resto = sum(max(o['puntosSeg'] for o in preguntas[q]['opciones']) for q in PUNTOS_SEG if q != INVERSION)
    for o in preguntas[INVERSION]['opciones']:
        if o['id'] in NO_INVIERTE and o['puntosSeg'] + resto >= SEGMENTO['b']:
            raise SystemExit(f"«{o['texto']}» puede llegar a B ({o['puntosSeg']} + {resto}): bajale los puntos.")


def mostrar(datos):
    for q in datos['preguntas']:
        if q['id'] not in PUNTOS_SEG:
            continue
        print(f"\n{q['titulo']} [{q.get('segmento')}]")
        for o in q['opciones']:
            print(f"   {o.get('puntosSeg')!s:>3}  (nota {o['puntos']!s:>4})  {o['texto']}  ({o['id']})")
    print('\nsegmento:', datos['segmento'])
    print('reglas:')
    for r in datos['reglas']:
        print('  ', r['id'], [(c['q'], c['ops']) for c in r['cond']], '→', r.get('url') or r['grupo'])
    print('   resto →', datos['resto'])


def grupo_triage():
    """El grupo «Triage» con las personas del triage, después de todos los demás."""
    from app.agendas_v2.nucleo.datos import es_triage, ordenados
    from app.agendas_v2.servicio import colecciones

    d = colecciones()
    miembros = [p['id'] for p in ordenados(d, 'personas') if es_triage(d, p)]
    if not miembros:
        raise SystemExit('No hay personas con rol triage en Team.')
    orden = max([g.get('orden') or 0 for g in d['grupos'] if g['id'] != TRIAGE] or [0]) + 1
    return {'nombre': 'Triage', 'estrategia': 'horario', 'miembros': miembros, 'orden': orden}


def main(apply=False, quien_decide=False):
    app = create_app()
    with app.app_context():
        from app.agendas_v2.servicio import guardar_doc

        grupo = grupo_triage()
        print('grupo', TRIAGE, grupo)

        fila = db.session.get(SchedFormulario, FORM_ID)
        if not fila:
            raise SystemExit(f'No existe el formulario {FORM_ID}')
        datos = preparar(copy.deepcopy(fila.datos), quien_decide)
        mostrar(datos)
        if not apply:
            print('\nDRY-RUN: no se guardó nada. Con --apply se guarda.')
            return
        guardar_doc('grupos', TRIAGE, grupo)
        doc = guardar_doc('formularios', FORM_ID, datos)
        print('\nGuardado. Segmentación:', doc['segmento'])


if __name__ == '__main__':
    main(apply='--apply' in sys.argv, quien_decide='--quien-decide' in sys.argv)
