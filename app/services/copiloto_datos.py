"""Las herramientas de datos de Learnito para la dirección (admin, operaciones, director comercial): el motor de
tablas de Work (app/services/tablas/) y, por agentes pares, el de la Academia (`LearnationService.agent_ask`).

Claude nunca escribe SQL ni hace cuentas: arma un plan por claves y el motor del sistema dueño del dato lo calcula.
Los resultados van como TEXTO CORTO (como en copiloto_herramientas.py): son la entrada de la próxima llamada a Claude.
"""
import json
import logging

from app.services import habilidades
from app.services.copiloto_herramientas import HerramientaError
from app.services.tablas import buscar, motor

logger = logging.getLogger(__name__)

MAX_FUENTES = 40
MAX_DATOS = 60
MAX_FILAS = 15
SISTEMAS = ('work', 'academia')

_SISTEMA = {'type': 'string', 'enum': list(SISTEMAS),
            'description': 'work: ventas, pagos, cuotas, agendas, leads. academia: alumnos, actividad, sesiones.'}

PLAN = {
    'type': 'object',
    'description': 'Plan por claves. Las claves y los conceptos salen de buscar_datos (o de fuentes_de_datos).',
    'properties': {
        'fuente': {'type': 'string'},
        'condiciones': {'type': 'object', 'description': '{"match": "all"|"any", "items": [{"field", "op", "value", '
                                                         '"negate"} o {"concepto": clave}]}. '
                                                         'op: eq neq contains in gt gte lt lte empty '
                                                         'notempty within_days older_days next_days.'},
        'columnas': {'type': 'array', 'items': {'type': 'string'}},
        'orden': {'type': 'object', 'description': '{"dato": clave, "dir": "asc"|"desc"}'},
        'agrupar_por': {'type': 'string'},
        'periodo': {'type': 'string', 'enum': ['day', 'week', 'month', 'quarter', 'year']},
        'medir': {'type': 'object', 'description': '{"metrica": count|sum|avg|min|max|pct, "dato": clave, '
                                                   '"valor": texto (para pct)}'},
    },
    'required': ['fuente'],
}

HERRAMIENTAS = [
    {
        'name': 'usar_habilidad',
        'description': 'Una pregunta frecuente ya resuelta. Si la pregunta encaja, usá esta antes que armar un plan. '
                       + habilidades.descripcion(),
        'input_schema': {
            'type': 'object',
            'properties': {'nombre': {'type': 'string', 'enum': list(habilidades.HABILIDADES)},
                           'parametros': {'type': 'object'}},
            'required': ['nombre'],
            'additionalProperties': False,
        },
    },
    buscar.TOOL,
    {
        'name': 'fuentes_de_datos',
        'description': 'Fuentes de un sistema o, con fuente, sus datos (claves), conceptos y trampas. Solo si '
                       'buscar_datos no alcanzó. Usá buscar.',
        'input_schema': {
            'type': 'object',
            'properties': {'sistema': _SISTEMA, 'fuente': {'type': 'string'},
                           'buscar': {'type': 'string', 'description': 'Palabra para acotar los datos.'}},
            'required': ['sistema'],
            'additionalProperties': False,
        },
    },
    {
        'name': 'calcular_tabla',
        'description': 'Corre un plan: cuenta, agrupa, mide y lista filas. Usalo para cualquier número o comparación.',
        'input_schema': {
            'type': 'object',
            'properties': {'sistema': _SISTEMA, 'plan': PLAN},
            'required': ['sistema', 'plan'],
            'additionalProperties': False,
        },
    },
]

INSTRUCCIONES = '\n\n'.join([
    'Tenés habilidades (preguntas frecuentes ya resueltas, usar_habilidad) y operaciones (calcular_tabla con un plan '
    'por claves). Si la pregunta encaja en una habilidad, usala; si no, armá el plan. Vos nunca contás ni calculás. '
    'Para armar el plan empezá por buscar_datos con la pregunta y buenas palabras clave: te da la fuente, los '
    'conceptos del equipo (usalos como condición {"concepto": clave}: ya traen la definición exacta), los datos y las '
    'trampas. fuentes_de_datos solo si te falta un dato. Los datos s. son reglas de Work (s.estado_pago, s.deuda, '
    's.estado_agenda) y los d. son calculados del diccionario. En una fuente de hechos sin período en la pregunta, '
    'acotá a los últimos 30 días por su fecha y decilo.',
    'Citá el total y los avisos del resultado (muestra chica, diferencia que puede ser azar) tal cual.',
    'Para cruzar personas entre sistemas: las filas de Work traen alumno_id, que es el alumno_id de la Academia.',
])


def _sistema(entrada):
    sistema = entrada.get('sistema')
    if sistema not in SISTEMAS:
        raise HerramientaError('sistema tiene que ser work o academia.')
    return sistema


def _quien(user):
    return {'email': getattr(user, 'email', None), 'rol': getattr(user, 'role', None)}


def _academia(user, **kwargs):
    from app.services.learnation_service import LearnationAPIError, LearnationService
    try:
        return LearnationService.agent_ask(quien=_quien(user), **kwargs)
    except LearnationAPIError as e:
        detalle = (e.payload or {}).get('errores') if isinstance(e.payload, dict) else None
        raise HerramientaError(f'La Academia respondió: {detalle or e}') from e


def _texto_fuentes(fuentes):
    lineas = [f"{f['clave']} · {f['nombre']}" for f in fuentes[:MAX_FUENTES]]
    if len(fuentes) > MAX_FUENTES:
        lineas.append(f'… y {len(fuentes) - MAX_FUENTES} más.')
    return '\n'.join(lineas)


def _texto_datos(cat):
    datos = cat.get('datos') or []
    lineas = [f"{d['clave']} ({d['tipo']}) {d['nombre']}" for d in datos[:MAX_DATOS]]
    if len(datos) > MAX_DATOS:
        lineas.append(f'… y {len(datos) - MAX_DATOS} más: acotá con buscar.')
    return '\n'.join(lineas) or 'Ningún dato coincide.'


def fuentes_de_datos(user, sistema, fuente=None, buscar=None):
    sistema = _sistema({'sistema': sistema})
    if sistema == 'work':
        try:
            cat = motor.catalog(user, fuente or True, buscar)
        except motor.MotorError as e:
            raise HerramientaError(str(e)) from e
    else:
        datos = _academia(user, catalogo=fuente or True, buscar=buscar).get('datos')
        if datos is None:
            raise HerramientaError('La Academia no devolvió su catálogo: usá claves que ya conozcas '
                                   '(fuente "alumno", por ejemplo pulse_band).')
        return _texto_datos({'datos': datos}) if fuente else _texto_fuentes(datos)
    return _texto_fuentes(cat) if not fuente else _texto_datos(cat)


def _texto_paquete(p):
    lineas = [f"Total: {p.get('total')} filas ({p.get('magnitud')})."]
    m = p.get('medicion')
    if m:
        if 'rows' in m:
            lineas.append('Por grupo (valor; filas):')
            lineas += [f"{r.get('k') if r.get('k') is not None else '(vacío)'}: {r.get('n')}; {r.get('m')}"
                       for r in m['rows']]
            if m.get('others'):
                lineas.append(f"Otros: {m['others']} filas fuera de los grupos mostrados.")
        else:
            valor = m.get('porcentaje', m.get('value'))
            lineas.append(f"Valor: {valor}{' %' if 'porcentaje' in m else ''}.")
        lineas += [f'Aviso: {w}' for w in m.get('warnings') or []]
    filas = p.get('filas') or []
    if filas and not m:
        lineas.append('Filas:')
        lineas += [json.dumps(f, ensure_ascii=False, default=str) for f in filas[:MAX_FILAS]]
        if len(filas) > MAX_FILAS or (p.get('total') or 0) > len(filas):
            lineas.append(f"… se muestran {min(len(filas), MAX_FILAS)} de {p.get('total')}.")
    if p.get('nota'):
        lineas.append(p['nota'])
    return '\n'.join(lineas)


def calcular_tabla(user, sistema, plan):
    sistema = _sistema({'sistema': sistema})
    if sistema == 'work':
        try:
            paquete = motor.run(user, plan, por_pagina=MAX_FILAS)
        except motor.MotorError as e:
            raise HerramientaError(' '.join(e.errores)) from e
    else:
        paquete = _academia(user, plan=plan)
    return _texto_paquete(paquete)


def buscar_datos(user, sistema, pregunta, palabras_clave, area=None):
    sistema = _sistema({'sistema': sistema})
    if sistema == 'work':
        return buscar.texto(buscar.find(user, pregunta, palabras_clave, area))
    # La Academia tiene el mismo buscador (su DataSearch); por agentes pares todavía no lo expone.
    try:
        paquete = _academia(user, buscar_datos={'pregunta': pregunta, 'palabras_clave': palabras_clave, 'area': area})
    except HerramientaError:
        return ('La Academia todavía no responde buscar_datos por agentes pares: usá fuentes_de_datos con sistema '
                'academia y buscar (la fuente principal es "alumno").')
    return paquete.get('texto') or 'La Academia no devolvió coincidencias.'


def usar_habilidad(user, nombre, parametros=None):
    try:
        return habilidades.usar(user, nombre, parametros)
    except (habilidades.HabilidadError, motor.MotorError) as e:
        raise HerramientaError(str(e)) from e


_EJECUTORES = {'buscar_datos': buscar_datos, 'fuentes_de_datos': fuentes_de_datos, 'calcular_tabla': calcular_tabla,
               'usar_habilidad': usar_habilidad}


def ejecutar(nombre, entrada, user):
    """(texto, es_error), como copiloto_herramientas.ejecutar."""
    funcion = _EJECUTORES.get(nombre)
    if not funcion:
        return f'No existe la herramienta {nombre}.', True
    try:
        return funcion(user, **(entrada or {})), False
    except (HerramientaError, TypeError) as e:
        return str(e), True
    except Exception as e:
        logger.error(f'[COPILOTO] {nombre} falló para el usuario {user.id}: {e}')
        return 'No se pudo calcular eso. Probá de nuevo en un rato.', True
