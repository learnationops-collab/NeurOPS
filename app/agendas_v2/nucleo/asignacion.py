"""Asignación: qué horarios ve el lead y a qué closer va cada uno. Port de core/asignacion.js.
Orden: respuestas → regla → prioridad → estrategia de la prioridad → closer por horario.
"""

from app.agendas_v2.nucleo.datos import buscar, closers, es_closer, horas_semana, ordenados, sesion_de
from app.agendas_v2.nucleo.disponibilidad import GENERICA, agenda_opt, ahora_ms, slots_persona
from app.agendas_v2.nucleo.formulario import calificar, grupo_por_reglas
from app.agendas_v2.nucleo.util import js_truthy

DIA = 86400000
# "Llenar en orden": un closer está lleno cuando no le queda ningún horario libre en esta ventana.
# Mientras tenga lugar en los próximos 7 días, el lead ve solo su agenda.
VENTANA_LLENAR_DIAS = 7


def miembros_validos(d, g):
    if not g:
        return []
    ps = [buscar(d, 'personas', i) for i in g['miembros']]
    return [p for p in ps if p and es_closer(d, p) and horas_semana(p) > 0]


def _o(*xs):
    """El `a || b || c` de JS entre números: el primero que no da 0 (ni NaN)."""
    for x in xs:
        if x == x and x != 0:
            return x
    return xs[-1]


def peso_de(g, pid, n):
    """El porcentaje de un closer en una estrategia Distribuida; sin cargar, parte pareja."""
    pesos = (g or {}).get('pesos') or {}
    return pesos[pid] if pid in pesos else 100 / n


def _por_estrategia(estrategia, miembros, slots_de, ahora, carga_de, g=None):
    if estrategia == 'llenar':
        limite = ahora + VENTANA_LLENAR_DIAS * DIA
        elegido, idx = None, -1
        for i, p in enumerate(miembros):
            s = slots_de(p)
            if any(t < limite for t in s):
                elegido, idx = p, i
                break
            if not elegido and s:
                elegido, idx = p, i
        if not elegido:
            return {'slots': [], 'regla': ''}
        return {
            'slots': [{'t': t, 'p': elegido['id']} for t in slots_de(elegido)],
            'regla': elegido['nombre'] + (' (los anteriores están llenos)' if idx else ' hasta llenarse'),
        }
    mapa = {}
    if estrategia == 'horario':
        # Máxima disponibilidad: el lead ve todos los horarios del grupo; cada uno va al primero de la
        # lista que esté libre.
        for p in miembros:
            for t in slots_de(p):
                mapa.setdefault(t, p['id'])
    else:
        # Distribuida: cada horario va a quien está más lejos de su porcentaje (agendas por delante
        # / porcentaje); con 0% solo recibe si nadie más está libre. A igual, a quien tiene más lugar
        # libre; después, el orden de la lista. Sin porcentajes es parejo.
        carga, libres, pos, w = {}, {}, {}, {}
        for i, p in enumerate(miembros):
            carga[p['id']], libres[p['id']], pos[p['id']] = carga_de(p['id']), len(slots_de(p)), i
            w[p['id']] = peso_de(g, p['id'], len(miembros))

        def mejor(a, b):
            za, zb = w[a] <= 0, w[b] <= 0
            if za != zb:
                return 1 if za else -1
            c = carga[a] - carga[b] if za else carga[a] * w[b] - carga[b] * w[a]
            return _o(c, libres[b] - libres[a], pos[a] - pos[b])

        for p in miembros:
            for t in slots_de(p):
                x = mapa.get(t)
                if not x or mejor(p['id'], x) < 0:
                    mapa[t] = p['id']
    slots = [{'t': t, 'p': mapa[t]} for t in sorted(mapa)]
    nombres = [p['nombre'] for p in miembros]
    regla = (
        'Máxima disponibilidad: ' + ' → '.join(nombres)
        if estrategia == 'horario'
        else 'Distribuida entre ' + str(len(miembros))
    )
    return {'slots': slots, 'regla': regla}


def asignacion(ctx, d, opts=None):
    """ctx: {preguntas, resp, dur, margen, evento_id, ag, reglas, resto, persona}. dur y margen son la
    propuesta del evento; cada closer usa lo suyo si lo ajustó (sesion_de).
    opts: {ahora, ocupado(persona_id, t, dur), carga_de(persona_id) → agendas futuras, prueba}
    Devuelve {nota, grupo, grupo_regla, regla_idx, desborde, slots: [{t, p}], regla, aviso}."""
    opts = opts or {}
    ahora = ahora_ms() if opts.get('ahora') is None else opts['ahora']
    ocupado = opts.get('ocupado') or (lambda pid, t, dur: False)
    carga_de = opts.get('carga_de') or (lambda pid: 0)
    resp = ctx.get('resp') or {}
    nota = calificar(ctx.get('preguntas') or [], resp)
    o = agenda_opt(ctx.get('ag'), ctx['dur'])
    memo = {}

    def slots_de(p):
        if p['id'] not in memo:
            dur, margen = sesion_de(p, ctx.get('evento_id'), ctx['dur'], ctx.get('margen'))
            memo[p['id']] = slots_persona(p, dur, o, ahora=ahora, ocupado=ocupado, margen=margen)
        return memo[p['id']]

    base = {'nota': nota, 'grupo': None, 'grupo_regla': '', 'regla_idx': None, 'desborde': False, 'aviso': ''}

    if js_truthy(ctx.get('persona')):
        pp = buscar(d, 'personas', ctx['persona'])
        return {**base, 'regla': 'Persona fija', 'slots': [{'t': t, 'p': pp['id']} for t in slots_de(pp)] if pp else []}

    # Ojo: en JS `reglas: []` es verdadero, así que sin reglas igual se va a `resto`.
    if js_truthy(ctx.get('reglas')):
        r = grupo_por_reglas({'reglas': ctx['reglas'], 'resto': ctx.get('resto')}, resp)
    else:
        r = {'grupo': '', 'regla': None}
    g0 = buscar(d, 'grupos', r['grupo'])
    res = {**base, 'grupo_regla': g0['id'] if g0 else '', 'regla_idx': r['regla']}

    if g0:
        # Desborde: si la prioridad elegida no tiene closers con lugar, pasa a las siguientes en orden.
        grupos = ordenados(d, 'grupos')
        desde = next(i for i, g in enumerate(grupos) if g['id'] == g0['id'])
        for g in grupos[desde:]:
            miembros = miembros_validos(d, g)
            if not miembros:
                continue
            x = _por_estrategia(g['estrategia'], miembros, slots_de, ahora, carga_de, g)
            if x['slots']:
                otro = g['id'] != g0['id']
                return {
                    **res,
                    'grupo': g,
                    'desborde': otro,
                    'slots': x['slots'],
                    'regla': (g0['nombre'] + ' sin lugar → ' if otro else '') + x['regla'],
                }

    todos = [p for p in closers(d) if horas_semana(p) > 0]
    if todos:
        x = _por_estrategia('repartir', todos, slots_de, ahora, carga_de)
        if x['slots']:
            return {
                **res,
                'desborde': bool(g0),
                'slots': x['slots'],
                'regla': (g0['nombre'] + ' sin lugar → ' if g0 else '') + 'Todos los closers',
            }

    if opts.get('prueba'):
        return {
            **res,
            'slots': [{'t': t, 'p': None} for t in slots_persona(GENERICA, ctx['dur'], o, ahora=ahora)],
            'regla': 'Horarios de prueba',
            'aviso': 'Horarios de prueba: cargá horarios en Team.',
        }
    return {**res, 'slots': [], 'regla': 'Sin horarios'}
