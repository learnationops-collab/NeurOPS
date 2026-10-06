"""Formularios: puntaje, ruteo por reglas, validación de respuestas y textos personalizados.
Port de core/formulario.js.
"""

import re

from app.agendas_v2.nucleo.catalogos import con_opciones
from app.agendas_v2.nucleo.normalizar import normal_pregunta
from app.agendas_v2.nucleo.util import WS, clonar, js_round, js_str, js_trim, js_truthy, mayus, num, txt, uid


def _opcion(q, resp):
    v = resp.get(q.get('id'))
    return next((x for x in q.get('opciones') or [] if x.get('id') == v), None)


def resumen_form(f):
    ps = f['preguntas']
    return {
        'n': len(ps),
        'puntua': len([q for q in ps if con_opciones(q['tipo']) and q['peso'] > 0]),
        'filtra': len([q for q in ps if con_opciones(q['tipo']) and any(o.get('descalifica') for o in q['opciones'])]),
    }


def calificar(preguntas, resp):
    """Nota de 0 a 10 con un decimal: suma de peso×puntos sobre el máximo posible (peso×10).
    Solo cuentan las preguntas con opciones, con peso, respondidas y cuya opción tiene puntos.
    Sin nada puntuable devuelve None. La nota no rutea: es información para el closer y para Stats."""
    n, den = 0, 0
    for q in preguntas:
        if not con_opciones(q.get('tipo')) or not js_truthy(q.get('peso')):
            continue
        o = _opcion(q, resp)
        if not o or o.get('puntos') is None:
            continue
        n += q['peso'] * o['puntos']
        den += q['peso'] * 10
    return num(js_round(n / den * 100) / 10) if den else None


def opcion_descalifica(q, resp):
    """Una opción elegida que descalifica corta el formulario."""
    if not con_opciones(q.get('tipo')):
        return False
    o = _opcion(q, resp)
    return bool(o and o.get('descalifica'))


def grupo_por_reglas(fo, resp):
    """Ruteo: las reglas se miran en orden y la primera que se cumple decide la prioridad.
    Una regla se cumple si en cada condición el lead eligió alguna de las respuestas marcadas.
    Las reglas sin condiciones completas se saltean. Si ninguna se cumple, va a `resto`."""
    if not fo:
        return {'grupo': '', 'regla': None}
    for i, r in enumerate(fo.get('reglas') or []):
        conds = [c for c in r['cond'] if js_truthy(c.get('q')) and c.get('ops')]
        if conds and all(resp.get(c['q']) in c['ops'] for c in conds):
            return {'grupo': r['grupo'], 'regla': i}
    return {'grupo': fo.get('resto') or '', 'regla': None}


def texto_regla(fo, i):
    """Una regla de segmentación en palabras: 'si "¿Cuánto invertís?" es Más de 1000' (None = el resto)."""
    if i is None:
        return 'el resto'
    reglas = (fo or {}).get('reglas') or []
    if not 0 <= i < len(reglas):
        return ''
    preguntas = {q['id']: q for q in fo.get('preguntas') or []}
    conds = []
    for c in reglas[i]['cond']:
        q = preguntas.get(c.get('q'))
        textos = [next((o['texto'] for o in (q or {}).get('opciones', []) if o['id'] == x), x) for x in c.get('ops') or []]
        conds.append(f'"{q["titulo"] if q else c.get("q")}" es {" o ".join(textos)}')
    return 'si ' + ' y '.join(conds)


def grupos_de_form(fo):
    ids = []
    if not fo:
        return ids
    for r in fo['reglas']:
        if r['grupo'] and r['grupo'] not in ids:
            ids.append(r['grupo'])
    if fo.get('resto') and fo['resto'] not in ids:
        ids.append(fo['resto'])
    return ids


def reglas_rotas(fo):
    """Reglas que apuntan a preguntas u opciones que ya no existen: nunca se van a cumplir."""

    def rota(c):
        if not c.get('q'):
            return False
        q = next((x for x in fo['preguntas'] if x['id'] == c['q']), None)
        return (
            not q or not con_opciones(q['tipo']) or any(not any(x['id'] == o for x in q['opciones']) for o in c['ops'])
        )

    return [i for i, r in enumerate(fo['reglas'] if fo else []) if any(rota(c) for c in r['cond'])]


def nombre_lead(resp, ejemplo=None):
    base = resp.get('c-nombre') if js_truthy(resp.get('c-nombre')) else ejemplo
    n = re.split('[' + WS + ']+', js_trim(txt(base)))[0]
    return mayus(n) if n else ''


def personalizar(t, nombre):
    """{nombre} se reemplaza por el primer nombre. Si todavía no hay nombre, se borra con su coma o dos puntos."""
    t = txt(t)
    if nombre:
        return re.sub(r'\{nombre\}', lambda m: nombre, t, flags=re.I)
    t = re.sub(r'\{nombre\}[' + WS + ']*[,:]?[' + WS + ']*', '', t, flags=re.I)
    return re.sub('^([¿¡]?)([^' + WS + '])', lambda m: m.group(1) + m.group(2).upper(), t, count=1)


def validar_respuesta(q, v):
    """Error a mostrar para una respuesta, o '' si está bien."""
    if not js_truthy(v):
        if not q.get('obligatoria'):
            return ''
        return 'Elegí una opción.' if con_opciones(q.get('tipo')) else 'Completá este dato.'
    v = js_str(v)
    t = q.get('tipo')
    if t == 'email' and not re.fullmatch('[^' + WS + '@]+@[^' + WS + '@]+\\.[^' + WS + '@]{2,}', v):
        return 'Revisá el correo.'
    if t == 'telefono' and len(re.sub('[^0-9]', '', v)) < 6:
        return 'El número parece incompleto.'
    if t == 'instagram' and not re.fullmatch('[A-Za-z0-9._]{1,30}', v):
        return 'Solo letras, números, puntos y guiones bajos.'
    return ''


def limpiar_respuesta(q, v):
    v = js_trim(txt(v))
    if q.get('tipo') == 'instagram':
        v = re.sub('[' + WS + ']+', '', re.sub('^@+', '', v))
    return v


def nueva_pregunta():
    return normal_pregunta({'tipo': 'opciones', 'titulo': '', 'opciones': [{'texto': ''}, {'texto': ''}]})


def copiar_pregunta(q):
    c = clonar(q)
    c['id'] = uid('q')
    for o in c['opciones']:
        o['id'] = uid('o')
    return c


def duplicar_form(fd):
    """Copia de un formulario con ids nuevos; las reglas se remapean a las preguntas y opciones copiadas."""
    mq, mo, preguntas = {}, {}, []
    for q in fd['preguntas']:
        c = copiar_pregunta(q)
        mq[q['id']] = c['id']
        for j, o in enumerate(q['opciones']):
            mo[o['id']] = c['opciones'][j]['id']
        preguntas.append(c)
    reglas = [
        {
            'id': uid('r'),
            'grupo': r['grupo'],
            'cond': [{'q': mq.get(c['q']) or '', 'ops': [mo[o] for o in c['ops'] if mo.get(o)]} for c in r['cond']],
        }
        for r in fd['reglas']
    ]
    return {
        'nombre': fd['nombre'] + ' (copia)',
        'contacto': clonar(fd['contacto']),
        'preguntas': preguntas,
        'reglas': reglas,
        'resto': fd['resto'],
        'fin': clonar(fd['fin']),
    }
