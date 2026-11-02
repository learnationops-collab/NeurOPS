"""Segmentación con el segmento Alfa en el formulario «Sesión de Aceleración» (Mario, 02/11/2026, ADR-W056 y ADR-W057).

Lo que hace (idempotente: correrlo dos veces deja lo mismo):
  - Examen: Colombia y Perú +2 (los mejores); el resto de los exámenes +1; sin examen −1; ENARM −2.
    Versión del segmento 2026-12.4. Los demás puntos no cambian.
  - Cinco estrategias en Team: Segmento Alfa (Máxima disponibilidad: Marlon › Jean Carlo › Mario),
    Segmento A y Segmento B (Llenar agenda: Jean Carlo › Marlon), Triage · Segmento C y Triage · Segmento D
    (Máxima disponibilidad: Juliana › Dari). Borra las demás estrategias, salvo las que use otro formulario.
  - Reemplaza las reglas del formulario por reglas escritas solo con respuestas (sin «Segmento del lead»),
    una por grupo de combinaciones, que no se pisan y cubren todo (nadie se descarta: sale `mk-academy`):
      quien puede invertir (inversión con dinero):
        Alfa  médico general o Rural + Colombia o Perú + decide solo
        A     médico general o Rural con segmento A por puntos (sin ser Alfa)
        A     residente o especialista que decide solo, cualquier país
        A     estudiante o interno que decide solo y rinde Colombia o Perú
        B     el resto (médico general o Rural con segmento B; residente o especialista con apoyo;
              estudiante de otro país o con apoyo)
      quien no puede invertir: segmento C o D por puntos → su triage, con la Sesión diagnóstica.
    «Todo lo demás» (el lead al que le falta inversión o etapa, sin segmento) → Triage · Segmento D.
  - Antes de guardar prueba todas las combinaciones de inversión × etapa × examen × decide con el ruteo real
    (grupo_por_reglas): cada una tiene que cumplir una sola regla y caer en el grupo esperado. Si no, frena.

Uso (en el servidor):
  python scripts/segmentacion_alfa.py            # ensayo: muestra cómo queda, no guarda
  python scripts/segmentacion_alfa.py --apply    # lo guarda
Después: python scripts/backfill_segmentos.py --apply --force (recalcula los segmentos con los puntos nuevos).
"""
import copy
import itertools
import os
import sys
import unicodedata

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ['DISABLE_REMINDER_SCHEDULER'] = 'true'
os.environ['FOLLOWUP_REMINDERS_ENABLED'] = 'false'

from app import create_app  # noqa: E402

FORM_ID = 'dg6gukz9emx'
INVERSION, ETAPA, EXAMEN, DECIDE = 'qglxqqlsgya', 'qg8xclvqc4c', 'qg6raaks2pe', 'qgnajtuxkuz'
VERSION = '2026-12.4'
SESION_TRIAGE = 'sesion-diagnostica'

# Etapa («Soy estudiante» e «internado» son opciones aparte y van juntas)
ESTUDIANTE, RURAL, GENERAL, RESIDENTE, ESPECIALISTA = 'og8xclet205', 'og8xclf4go4', 'og94zlvu9m2', 'og9azfspw7e', 'og9ed3qtpzx'
INTERNADO = 'og-internado'
# Examen
COLOMBIA, PERU, ENARM, SIN_EXAMEN = 'og77bdut6ym', 'og6raas2nv9', 'og7imnc8sh8', 'og7p4glxgce'
# Decide
SOLO = 'ognajtws1ke'

GRUPOS = {
    'ws-seg-alfa': ('Segmento Alfa', 'horario', ['marlon', 'jean carlo', 'mario']),
    'ws-seg-a': ('Segmento A', 'llenar', ['jean carlo', 'marlon']),
    'ws-seg-b': ('Segmento B', 'llenar', ['jean carlo', 'marlon']),
    'ws-triage-c': ('Triage · Segmento C', 'horario', ['juliana', 'dari']),
    'ws-triage-d': ('Triage · Segmento D', 'horario', ['juliana', 'dari']),
}
GRUPO_DE = {'Alfa': 'ws-seg-alfa', 'A': 'ws-seg-a', 'B': 'ws-seg-b', 'C': 'ws-triage-c', 'D': 'ws-triage-d'}


def _plano(t):
    return ''.join(c for c in unicodedata.normalize('NFD', (t or '').lower()) if unicodedata.category(c) != 'Mn')


def _personas(d):
    """Nombre corto → id de la persona en Team. Frena si un nombre no aparece o aparece dos veces."""
    ids = {}
    for corto in {n for _, _, ms in GRUPOS.values() for n in ms}:
        hay = [p for p in d['personas'] if _plano(p.get('nombre')).startswith(corto)]
        if len(hay) != 1:
            raise SystemExit(f'«{corto}» aparece {len(hay)} veces en Team: {[p.get("nombre") for p in hay]}')
        ids[corto] = hay[0]['id']
    return ids


def _grupos(d):
    ids = _personas(d)
    orden = max([g.get('orden') or 0 for g in d['grupos']] or [0])
    out = {}
    for i, (gid, (nombre, estrategia, miembros)) in enumerate(GRUPOS.items(), 1):
        out[gid] = {'nombre': nombre, 'estrategia': estrategia, 'miembros': [ids[m] for m in miembros],
                    'orden': orden + i}
    return out


def _puntos_examen(q):
    for o in q['opciones']:
        o['puntosSeg'] = 2 if o['id'] in (COLOMBIA, PERU) else -2 if o['id'] == ENARM else -1 if o['id'] == SIN_EXAMEN else 1


def _reglas(datos):
    """Reglas escritas solo con respuestas, sin «Segmento del lead». Por segmento (Alfa, A, B, C, D) agrupa por
    inversión × etapa las combinaciones que van a ese segmento y junta las que piden lo mismo de examen y decide.
    Cada regla toma solo combinaciones de su segmento: ninguna se pisa y todas quedan cubiertas."""
    preguntas = {q['id']: q for q in datos['preguntas']}
    ops = {qid: [o['id'] for o in preguntas[qid]['opciones']] for qid in (INVERSION, ETAPA, EXAMEN, DECIDE)}
    seg = {}
    for combo in itertools.product(*(ops[q] for q in (INVERSION, ETAPA, EXAMEN, DECIDE))):
        seg[combo] = esperado(datos, dict(zip((INVERSION, ETAPA, EXAMEN, DECIDE), combo)))
    reglas = []
    for s in ('Alfa', 'A', 'B', 'C', 'D'):
        # celda inversión × etapa → {decides que van a s: exámenes}
        celdas = {}
        for a, b in itertools.product(ops[INVERSION], ops[ETAPA]):
            patron = {}
            for x in ops[EXAMEN]:
                dec = tuple(d for d in ops[DECIDE] if seg[(a, b, x, d)] == s)
                if dec:
                    patron.setdefault(dec, []).append(x)
            if patron:
                celdas[(a, b)] = tuple(sorted((k, tuple(v)) for k, v in patron.items()))
        por_inv = {}
        for (a, b), pat in celdas.items():
            por_inv.setdefault((a, pat), []).append(b)
        juntas = {}
        for (a, pat), etapas in por_inv.items():
            juntas.setdefault((tuple(etapas), pat), []).append(a)
        for (etapas, pat), invs in juntas.items():
            for dec, exams in pat:
                cond = []
                if len(invs) < len(ops[INVERSION]):
                    cond.append({'q': INVERSION, 'ops': list(invs)})
                if len(etapas) < len(ops[ETAPA]):
                    cond.append({'q': ETAPA, 'ops': list(etapas)})
                if len(exams) < len(ops[EXAMEN]):
                    cond.append({'q': EXAMEN, 'ops': list(exams)})
                if len(dec) < len(ops[DECIDE]):
                    cond.append({'q': DECIDE, 'ops': list(dec)})
                n = sum(1 for r in reglas if r['grupo'] == GRUPO_DE[s]) + 1
                reglas.append({'id': f'{s.lower()}-{n}', 'grupo': GRUPO_DE[s], 'url': '', 'cond': cond,
                               **({'evento': SESION_TRIAGE} if s in ('C', 'D') else {})})
    if len(reglas) > 40:
        raise SystemExit(f'Salen {len(reglas)} reglas y Thalamus guarda hasta 40.')
    return reglas


def esperado(datos, resp):
    """El segmento que pidió Mario para esas respuestas (lo que las reglas tienen que reproducir)."""
    from app.agendas_v2.nucleo.segmento import segmentar
    seg = (segmentar(datos, resp) or {}).get('segmento')
    if resp[INVERSION] not in datos['segmento']['dinero']['ops']:
        return seg  # C o D por puntos
    etapa, col_peru, solo = resp[ETAPA], resp[EXAMEN] in (COLOMBIA, PERU), resp[DECIDE] == SOLO
    if etapa in (GENERAL, RURAL):
        return 'Alfa' if col_peru and solo else seg
    if etapa in (RESIDENTE, ESPECIALISTA):
        return 'A' if solo else 'B'
    return 'A' if solo and col_peru else 'B'


def verificar(datos):
    """Cada combinación cumple una sola regla y cae en el grupo de su segmento esperado."""
    from app.agendas_v2.nucleo.formulario import grupo_por_reglas
    from app.agendas_v2.nucleo.segmento import segmentar
    preguntas = {q['id']: q for q in datos['preguntas']}
    qs = (INVERSION, ETAPA, EXAMEN, DECIDE)
    cuenta, malas = {}, []
    for combo in itertools.product(*[[o['id'] for o in preguntas[q]['opciones']] for q in qs]):
        resp = dict(zip(qs, combo))
        seg = (segmentar(datos, resp) or {}).get('segmento')
        cumplen = [r['id'] for r in datos['reglas'] if all(resp.get(c['q']) in c['ops'] for c in r['cond'])]
        quiere = esperado(datos, resp)
        va = grupo_por_reglas(datos, resp)['grupo']
        cuenta[quiere] = cuenta.get(quiere, 0) + 1
        if len(cumplen) != 1 or va != GRUPO_DE[quiere]:
            malas.append((combo, seg, quiere, cumplen, va))
    for m in malas[:20]:
        print('  MAL', m)
    if malas:
        raise SystemExit(f'{len(malas)} combinaciones no cumplen una sola regla o van a otro grupo: no se guarda nada.')
    return cuenta


def preparar(datos):
    preguntas = {q['id']: q for q in datos['preguntas']}
    faltan = [q for q in (INVERSION, ETAPA, EXAMEN, DECIDE) if q not in preguntas]
    if faltan:
        raise SystemExit(f'Faltan preguntas en el formulario: {faltan}')
    # Una etapa nueva sin clasificar no sabría a qué regla ir: mejor frenar.
    sueltas = [o['texto'] for o in preguntas[ETAPA]['opciones']
               if o['id'] not in (ESTUDIANTE, INTERNADO, RURAL, GENERAL, RESIDENTE, ESPECIALISTA)]
    if sueltas:
        raise SystemExit(f'Etapas sin clasificar: {sueltas}')
    ids = {o['id'] for q in (ETAPA, EXAMEN, DECIDE) for o in preguntas[q]['opciones']}
    faltan = [x for x in (ESTUDIANTE, RURAL, GENERAL, RESIDENTE, ESPECIALISTA, COLOMBIA, PERU, ENARM, SIN_EXAMEN, SOLO)
              if x not in ids]
    if faltan:
        raise SystemExit(f'Faltan opciones en el formulario: {faltan}')
    if not (datos.get('segmento') or {}).get('dinero'):
        raise SystemExit('El formulario no tiene la regla del dinero (segmento.dinero).')
    _puntos_examen(preguntas[EXAMEN])
    datos['segmento']['version'] = VERSION
    datos['reglas'] = _reglas(datos)
    datos['resto'] = GRUPO_DE['D']
    return datos


def _sobrantes(d):
    """Las estrategias que no son las cinco de los segmentos. Se borran las que ningún otro formulario usa."""
    sobran, quedan = [], []
    for g in d['grupos']:
        if g['id'] in GRUPOS:
            continue
        usan = [f['nombre'] for f in d['formularios'] if f['id'] != FORM_ID
                and (f.get('resto') == g['id'] or any(r.get('grupo') == g['id'] for r in f.get('reglas') or []))]
        (quedan.append((g, usan)) if usan else sobran.append(g))
    return sobran, quedan


def mostrar(datos, grupos, d):
    nombre = {p['id']: p.get('nombre') for p in d['personas']}
    textos = {o['id']: o['texto'] for q in datos['preguntas'] for o in q.get('opciones') or []}
    titulos = {q['id']: (q.get('corto') or q['titulo'])[:30] for q in datos['preguntas']}
    print('Estrategias nuevas:')
    for gid, g in grupos.items():
        print(f"  {gid}: {g['nombre']} ({g['estrategia']}) {' › '.join(nombre[m] for m in g['miembros'])}")
    print('\nExamen (puntosSeg):')
    for o in next(q for q in datos['preguntas'] if q['id'] == EXAMEN)['opciones']:
        print(f"  {o['puntosSeg']:>3}  {o['texto']}")
    print(f'\nReglas ({len(datos["reglas"])}):')
    for i, r in enumerate(datos['reglas'], 1):
        conds = ' y '.join(f'{titulos.get(c["q"], c["q"])} = {" o ".join(textos.get(x, x)[:28] for x in c["ops"])}'
                           for c in r['cond'])
        print(f"  {i:>2}. {conds}\n      → {grupos[r['grupo']]['nombre']}{' · ' + r['evento'] if r.get('evento') else ''}")
    print('  Todo lo demás →', grupos[datos['resto']]['nombre'])


def main(apply=False):
    app = create_app()
    with app.app_context():
        from app.agendas_v2.servicio import borrar_doc, colecciones, guardar_doc
        d = colecciones()
        form = next((f for f in d['formularios'] if f['id'] == FORM_ID), None)
        if not form:
            raise SystemExit(f'No existe el formulario {FORM_ID}')
        if not any(e['id'] == SESION_TRIAGE for e in d['eventos']):
            raise SystemExit(f'No existe el evento {SESION_TRIAGE}')
        grupos = _grupos(d)
        datos = preparar(copy.deepcopy(form))
        mostrar(datos, grupos, d)
        cuenta = verificar(datos)
        sobran, quedan = _sobrantes(d)
        print('\nEstrategias que se borran:', ', '.join(g['nombre'] for g in sobran) or 'ninguna')
        for g, usan in quedan:
            print(f"  NO se borra {g['nombre']}: la usa {', '.join(usan)}")
        print('\nVerificado: cada combinación cumple una sola regla y va al grupo de su segmento.',
              ' · '.join(f'{s} {cuenta.get(s, 0)}' for s in ('Alfa', 'A', 'B', 'C', 'D')))
        if not apply:
            print('\nENSAYO: no se guardó nada. Con --apply se guarda.')
            return
        for i, (gid, g) in enumerate(grupos.items(), 1):
            guardar_doc('grupos', gid, {**g, 'orden': i})
        doc = guardar_doc('formularios', FORM_ID, datos)
        print('\nGuardado.', len(doc['reglas']), 'reglas · segmento', doc['segmento']['version'])
        for g in sobran:
            borrar_doc('grupos', g['id'])
            print('Borrada la estrategia', g['nombre'])


if __name__ == '__main__':
    main(apply='--apply' in sys.argv)
