"""Buscador del diccionario de datos (como `DataSearch` de la Academia, su ADR-173): una pregunta y hasta 10 palabras
clave devuelven, en una sola llamada, las fuentes, los conceptos, los datos y las trampas que sirven para armar un
plan, en vez de leer el catálogo entero de una fuente. Busca en memoria sobre el diccionario (nombres,
significados, valores y las palabras clave escritas como habla el equipo) y ordena con las capas de cada fuente:
área, tipo de fila y autor.

Lo que quien pregunta no puede ver no aparece: fuentes que no ve y datos que no están en su fuente (montos).
"""
import re
import unicodedata

from app.services.tablas import catalogo, diccionario, sistema

AREAS = {
    'personas': 'Personas: leads, clientes, alumnos, identidades y fusiones',
    'ventas': 'Ventas: ventas, pagos, cuotas, suscripciones, señas y renovaciones',
    'agendas': 'Agendas: llamadas con closers, resultados, disponibilidad, Agendas 2.0 y reportes del closer',
    'marketing': 'Marketing: campañas, anuncios, gasto en Meta, landings, formularios y UTM',
    'conversaciones': 'Conversaciones: setters, Instagram, palabras clave y automatizaciones',
    'workshop': 'Workshops: talleres, inscriptos, asistencia y metas',
    'equipo': 'Equipo: reportes diarios, triage, Playbook, bugs y alertas',
    'finanzas': 'Finanzas: gastos, nómina, conciliación y saldos (solo admin)',
}

ROWS = {'hecho': 'cada fila es algo que pasó: se cuenta por período',
        'estado': 'cada fila es algo vivo que cambia: se cuenta como foto de hoy',
        'catalogo': 'contenido o configuración', 'relacion': 'une dos tablas'}

LIMITS = {'conceptos': 6, 'datos': 10, 'fuentes': 4}

# Palabras de la pregunta que no ayudan a buscar.
STOP = {'cuantos', 'cuantas', 'cuanto', 'cuales', 'quienes', 'donde', 'cuando', 'tienen', 'tiene', 'estan', 'esta',
        'este', 'esto', 'para', 'pero', 'porque', 'sobre', 'desde', 'hasta', 'entre', 'todos', 'todas', 'hacen', 'hizo',
        'como', 'mas', 'menos', 'cada', 'mismo', 'hay', 'son', 'fue', 'del', 'los', 'las', 'que', 'con', 'una', 'uno',
        'por', 'sus', 'quiero', 'saber', 'decime', 'dame', 'mostrame', 'cual'}

# Cómo nombra el equipo las dimensiones más comunes ("por closer", "por programa") → claves posibles, la primera que
# exista en la fuente.
DIMENSIONS = {
    'closer': ('p.closer_id.username', 'f.closer_email', 'f.closer', 'f.email_vendedor'),
    'setter': ('p.setter_id.username', 'f.setter'),
    'programa': ('f.program_code', 'f.programa_code'),
    'producto': ('f.product_slug', 'f.program_code', 'f.programa_code'),
    'metodo': ('f.metodo_pago',),
    'palabra': ('f.keyword',),
    'canal': ('f.channel', 'f.origin', 'f.source'),
    'origen': ('f.origin', 'f.source', 'f.channel'),
    'tipo': ('f.kind', 'f.tipo_pago', 'f.type'),
    'estado de pago': ('s.estado_pago',),
    'estado': ('s.estado_agenda', 'f.status', 'f.estado'),
}

_index = None


def fold(texto):
    """Minúsculas y sin tildes, para comparar como escribe la gente."""
    plano = unicodedata.normalize('NFKD', str(texto or ''))
    return ''.join(c for c in plano if not unicodedata.combining(c)).casefold()


def _words(texto):
    return [w for w in re.split(r'[^\w]+', fold(texto)) if len(w) >= 4 and w not in STOP]


def _item(tipo, fuente, clave, nombre, texto, palabras, detalle):
    return {'tipo': tipo, 'fuente': fuente, 'clave': clave, 'nombre': fold(nombre), 'texto': fold(texto),
            'palabras': fold(palabras), 'detalle': detalle}


def _corto(texto, n=160):
    texto = str(texto or '')
    return texto if len(texto) <= n else texto[:n - 1].rstrip() + '…'


def index():
    """Todo lo buscable: fuentes, conceptos, calculados, columnas explicadas y los datos del sistema (`s.`)."""
    global _index
    if _index is not None:
        return _index
    items = []
    for tabla, t in diccionario.todo().items():
        if t.get('uso') == 'sin_uso' or (t.get('area') or [None])[0] == 'sistema':
            continue
        items.append(_item('fuente', tabla, tabla, tabla.replace('_', ' '),
                           f"{t.get('significado', '')} {t.get('notas', '')}", t.get('palabras', ''), ''))
        for c in t.get('conceptos') or []:
            items.append(_item('concepto', c['fuente'], c['clave'], c['nombre'],
                               f"{c.get('significado', '')} {c.get('ejemplo', '')}", c.get('palabras', ''),
                               f"{c['nombre']}: {_corto(c.get('significado'))}"))
        for d in t.get('derivados') or []:
            detalle = f"{d.get('nombre')} (calculado, {d.get('tipo', 'text')}): {_corto(d.get('significado'))}"
            items.append(_item('dato', tabla, f"d.{d['clave']}", d.get('nombre', ''), d.get('significado', ''),
                               d.get('palabras', ''), detalle))
        for col, c in (t.get('columnas') or {}).items():
            valores = ' '.join(f"{v.get('label', '')} {v.get('significado', '')}"
                               for v in (c.get('valores') or {}).values())
            items.append(_item('dato', tabla, f'f.{col}', col.replace('_', ' '),
                               f"{c.get('significado', '')} {valores}", '',
                               _corto(diccionario.detalle_columna(tabla, col), 260)))
    for tabla, datos in (('clients', sistema.PAGO), ('appointments', sistema.AGENDA)):
        for clave, (nombre, tipo, _, detalle) in datos.items():
            items.append(_item('dato', tabla, clave, nombre, detalle, '',
                               f'{nombre} (regla de Work, {tipo}): {detalle}'))
    _index = items
    return items


def _score(item, terms, areas):
    score = sum((w if t in item['palabras'] else 0) + (w * 0.7 if t in item['nombre'] else 0)
                + (w * 0.35 if t in item['texto'] else 0) for t, w in terms)
    if score > 0 and areas:
        suyas = (diccionario.tabla(item['fuente']) or {}).get('area') or []
        score *= 1.5 if set(areas) & set(suyas) else 0.4
    return score * 1.2 if item['tipo'] == 'concepto' else score


def find(user, pregunta, palabras_clave, areas=None):
    """{fuentes, conceptos, datos} para la pregunta, solo con lo que `user` puede ver."""
    areas = [a for a in (areas or []) if a in AREAS]
    frases = list(dict.fromkeys(f for f in (fold(k).strip() for k in (palabras_clave or [])[:10]) if len(f) >= 3))
    terms = [(f, 4.5 if ' ' in f else 3) for f in frases]
    terms += [(w, 1.5) for w in dict.fromkeys(_words(pregunta)) if w not in frases]
    if not terms:
        return {'fuentes': [], 'conceptos': [], 'datos': []}

    visibles = catalogo.sources(user)
    scored = sorted(({**i, 'score': _score(i, terms, areas)} for i in index() if i['fuente'] in visibles),
                    key=lambda i: i['score'], reverse=True)
    scored = [i for i in scored if i['score'] > 0]

    # Las fuentes, por lo mejor que tienen (su propia ficha y sus tres mejores datos o conceptos).
    por_fuente = {}
    for i in scored:
        por_fuente.setdefault(i['fuente'], []).append(i['score'])
    fuentes = sorted(por_fuente, key=lambda f: sum(sorted(por_fuente[f], reverse=True)[:3]), reverse=True)
    fuentes = fuentes[:LIMITS['fuentes']]
    campos = {f: catalogo.source(user, f).fields for f in fuentes}

    def visible(i):
        if i['tipo'] == 'concepto':
            c = diccionario.concepto(i['clave']) or {}
            src = campos.get(i['fuente']) or catalogo.source(user, i['fuente']).fields
            return all(x.get('field') in src for x in c.get('condicion') or [])
        return i['fuente'] in campos and i['clave'] in campos[i['fuente']]

    conceptos = [i for i in scored if i['tipo'] == 'concepto' and visible(i)][:LIMITS['conceptos']]
    datos = [i for i in scored if i['tipo'] == 'dato' and visible(i)][:LIMITS['datos']]
    return {'fuentes': [{'fuente': f, **_source_info(f, visibles[f])} for f in fuentes],
            'conceptos': conceptos, 'datos': datos}


def _source_info(clave, fuente):
    t = diccionario.tabla(clave) or {}
    return {'nombre': fuente.label, 'fila': ROWS.get(t.get('fila')), 'fecha': t.get('fecha'),
            'que_es': _corto(t.get('significado') or fuente.description, 200),
            'trampas': _corto(t['notas'], 320) if t.get('notas') else None}


def campo_para(user, fuente_clave, texto):
    """El dato de una fuente que mejor nombra un texto ("por closer", "monto"), para agrupar o medir; None si
    ninguno."""
    fuente = catalogo.source(user, fuente_clave)
    if fuente is None:
        return None
    t = fold(texto)
    for palabra, claves in DIMENSIONS.items():
        if palabra in t:
            for clave in claves:
                if clave in fuente.fields:
                    return clave
    words = _words(texto)
    best = max(((sum((3 if w in i['palabras'] else 0) + (2 if w in i['nombre'] else 0) + (0.5 if w in i['texto'] else 0)
                     for w in words), i['clave'])
                for i in index() if i['tipo'] == 'dato' and i['fuente'] == fuente_clave), default=(0, None))
    return best[1] if best[0] > 0 and best[1] in fuente.fields else None


TOOL = {
    'name': 'buscar_datos',
    'description': 'Busca en el diccionario de datos qué conceptos del equipo, fuentes y datos sirven para una '
                   'pregunta, con su significado, sus valores y las trampas conocidas. Empezá por acá antes de armar '
                   'un plan: con la pregunta y buenas palabras clave alcanza una llamada. fuentes_de_datos queda para '
                   'ver una fuente entera.',
    'input_schema': {
        'type': 'object',
        'properties': {
            'sistema': {'type': 'string', 'enum': ['work', 'academia']},
            'pregunta': {'type': 'string'},
            'palabras_clave': {'type': 'array', 'items': {'type': 'string'}, 'maxItems': 10,
                               'description': 'Hasta 10: el dato o concepto, sinónimos y cómo lo dice el equipo '
                                              '("no pagó", "se cayó", "no vino")'},
            'area': {'type': 'array', 'items': {'type': 'string'},
                     'description': 'Opcional, ordena: ' + ', '.join(AREAS)},
        },
        'required': ['sistema', 'pregunta', 'palabras_clave'],
        'additionalProperties': False,
    },
}


def texto(found):
    """El resultado como texto compacto para el modelo (el mismo formato que la Academia)."""
    if not found['fuentes']:
        return 'Sin coincidencias en el diccionario. Probá otras palabras o mirá las fuentes con fuentes_de_datos.'
    out = ['Fuentes:']
    for s in found['fuentes']:
        fila = f" · {s['fila']}" if s.get('fila') else ''
        fecha = f" · fecha {s['fecha']}" if s.get('fecha') else ''
        out.append(f"- {s['fuente']} ({s['nombre']}{fila}{fecha}): {s['que_es']}")
    if found['conceptos']:
        out.append('\nConceptos (condición {"concepto": clave} en su fuente):')
        out += [f"- {c['clave']} [{c['fuente']}]: {c['detalle']}" for c in found['conceptos']]
    if found['datos']:
        out.append('\nDatos:')
        out += [f"- {d['fuente']} · {d['clave']}: {d['detalle']}" for d in found['datos']]
    trampas = [s for s in found['fuentes'] if s.get('trampas')][:3]
    if trampas:
        out.append('\nTrampas:')
        out += [f"- {s['fuente']}: {s['trampas']}" for s in trampas]
    return '\n'.join(out)
