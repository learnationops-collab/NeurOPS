"""El conector de Work para el cerebro de Learnito (en la Academia: VISION/LEARNITO_COMO_SERVICIO.md, etapa 3, y su
API.md §2.15). El cerebro vive en la Academia y le pide a Work lo suyo con `POST {op, args}`: cómo se presenta, sus
herramientas, el diccionario y el motor de tablas, sus clientes y su equipo. Acá no hay IA: Work responde datos. Cada
operación es un método del contrato (LearnitoConnector y LearnitoData de la Academia), con los mismos nombres de
argumentos que su ConnectorServer.

Quien pregunta viaja en `quien` ({id, nombre, email, rol, zona}) con su id de Work: los datos se leen con sus permisos
(montos y tablas de admin, como en Tablas). Sin quien, lo de alguien sin rol.

Lo que Work todavía no tiene para Learnito: acciones (delegar, observaciones), material y gráficos. Esas operaciones
responden vacío y el cerebro sigue sin ellas. Las herramientas son las de la dirección (copiloto_datos.py) más buscar
un cliente y leer su expediente.
"""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy import func, or_

from app import db
from app.models import Appointment, Client, User
from app.models.person import Person
from app.services import copiloto_datos
from app.services.tablas import buscar, catalogo, diccionario, exclusion, motor
from app.services.tablas.plan import normalize as normalizar_plan

logger = logging.getLogger(__name__)

# Lo que el cerebro de la Academia pone como columna "nombre de la fila"; en Work ese nombre ya viaja en `fila`.
ETIQUETA = 'f.__label'
CLIENTES_MAX = 10
EQUIPO_DIAS = 90
EXPEDIENTE_ENTRADAS = 150


class ConectorError(ValueError):
    """Un pedido mal armado: vuelve como {ok: false, error} con 422."""


class _SinRol:
    """Quien consulta sin usuario de Work: sin montos ni tablas de admin (como agent/ask)."""
    role = None
    id = None
    email = None
    username = None
    timezone = 'America/La_Paz'


def usuario(quien):
    """El usuario de Work de `quien` (activo), o uno sin rol."""
    try:
        u = db.session.get(User, int((quien or {}).get('id') or 0))
    except (TypeError, ValueError):
        u = None
    return u if u is not None and u.is_active else _SinRol()


# --- Perfil -----------------------------------------------------------------------------------------------------

GUIA = '\n\n'.join([
    'Respondés sobre Work, el sistema comercial de Learnation: leads y clientes, agendas (las llamadas con los '
    'closers y su resultado), ventas, pagos, cuotas, suscripciones y la cobranza. Te escribe alguien de la '
    'dirección (admin, operaciones o director comercial).',
    'Te piden cosas como:\n'
    '- Números del comercial: ventas por mes o por closer, show up, no shows, señas sin convertir, cuotas vencidas.\n'
    '- Quién debe y cuánto, qué cuotas vencen, qué clientes están en riesgo de no pagar.\n'
    '- La historia de un cliente: de dónde vino, sus llamadas, qué compró, qué pagó y qué debe.\n'
    '- Cruzar con la Academia: cómo viene en sus estudios alguien que debe una cuota.',
    'Datos:\n'
    '- Cuentas, listas y porcentajes: arma un plan por claves y calculalo con calcular_tabla. Empezá por '
    'buscar_datos con la pregunta y buenas palabras clave: te da la fuente, los conceptos del equipo (usalos como '
    'condición {"concepto": clave}: ya traen la definición exacta), los datos y las trampas. fuentes_de_datos solo si '
    'te falta un dato. Vos nunca contás ni calculás: los números salen del motor.\n'
    '- Si la pregunta encaja en una habilidad (preguntas frecuentes ya resueltas), usar_habilidad antes que un plan.\n'
    '- Los datos s. son reglas de Work (s.estado_pago, s.deuda, s.estado_agenda) y los d. son calculados del '
    'diccionario. En una fuente de hechos sin período en la pregunta, acotá a los últimos 30 días por su fecha y '
    'decilo.\n'
    '- Para un cliente puntual: buscar_cliente (nombre, email o teléfono) y después expediente_cliente con su id.\n'
    '- Los datos de la Academia (alumnos, actividad, sesiones) se piden con sistema "academia" en fuentes_de_datos, '
    'buscar_datos y calcular_tabla. Las filas de Work traen alumno_id, que es el id del alumno en la Academia: así '
    'se cruzan.\n'
    '- Si la medición trae avisos (muestra chica, diferencia que puede ser azar), decilos.\n'
    '- No inventes datos. Si algo no está, decilo.',
    'Acciones: desde Learnito todavía no podés dejar nada hecho en Work (ni tareas ni notas). Si te piden una, '
    'decilo en una línea y ofrecé redactar el mensaje para que la persona lo mande.',
])


def guide():
    return GUIA


def appendix():
    """Las fuentes principales de Work, para que una pregunta simple sepa dónde buscar sin salir a preguntar."""
    lineas = ['# Fuentes principales de Work (clave · qué es cada fila)']
    for clave, (nombre, descripcion) in catalogo.NAMED.items():
        t = diccionario.tabla(clave) or {}
        fecha = f" · fecha {t['fecha']}" if t.get('fecha') else ''
        lineas.append(f'- {clave} ({nombre}{fecha}): {descripcion}.')
    lineas.append('Hay más tablas: buscar_datos las encuentra. Horas en UTC; el equipo lee el día en la zona de cada '
                  'closer (por defecto America/La_Paz).')
    lineas.append('Para agrupar o mostrar por alguien del equipo, su nombre (p.closer_id.username, '
                  'p.setter_id.username), no su número (f.closer_id): la respuesta nombra al closer, nunca su id. El show up se mide con los '
                  'conceptos (agenda_realizada como base, agenda_show_up), que leen s.estado_agenda, no con '
                  'f.closer_result.')
    return '\n'.join(lineas)


def asker_note(quien):
    q = quien or {}
    return (f"Te escribe {q.get('nombre')} ({q.get('email')}), rol {q.get('rol')} en Work. Cuando diga \"mis "
            f"agendas\", \"mis ventas\" o \"los míos\": como closer, las filas de su closer (closer_id {q.get('id')}, "
            f"o el email {q.get('email')} en las tablas que guardan el mail del closer). Si no queda claro, decí cuál "
            f'usaste.')


# --- Herramientas -----------------------------------------------------------------------------------------------

CLIENTES = [
    {
        'name': 'buscar_cliente',
        'description': 'Busca clientes de Work (leads, clientes y alumnos) por nombre, email o teléfono. Devuelve '
                       f'hasta {CLIENTES_MAX} con su id y programa. Usalo para tener el id antes de pedir un '
                       'expediente.',
        'input_schema': {'type': 'object', 'properties': {'texto': {'type': 'string'}}, 'required': ['texto']},
    },
    {
        'name': 'expediente_cliente',
        'description': 'El expediente de un cliente de Work: quién es, estado, la última llamada y su resultado, la '
                       'cobranza (si podés ver montos), sus agendas y su formulario.',
        'input_schema': {'type': 'object', 'properties': {'cliente_id': {'type': 'integer'}},
                         'required': ['cliente_id']},
    },
]

DATOS = ('buscar_datos', 'fuentes_de_datos', 'calcular_tabla')


def _api(t):
    return {'name': t['name'], 'description': t['description'], 'inputSchema': t['input_schema']}


def _solo_work(t):
    """La herramienta sin `sistema`: el planificador arma planes que corre Work."""
    schema = json.loads(json.dumps(t['input_schema']))
    schema['properties'].pop('sistema', None)
    schema['required'] = [r for r in schema.get('required', []) if r != 'sistema']
    return {'name': t['name'], 'description': t['description'], 'inputSchema': schema}


def tools():
    return [_api(t) for t in [*copiloto_datos.HERRAMIENTAS, *CLIENTES]]


def planner_tools():
    return [_solo_work(t) for t in copiloto_datos.HERRAMIENTAS if t['name'] in ('buscar_datos', 'fuentes_de_datos')]


def plan_schema():
    return copiloto_datos.PLAN


def run_tool(nombre, entrada, user, opciones=None):
    """{texto, plan?}: el texto va al modelo; el plan, al banco de planes del cerebro."""
    entrada = dict(entrada or {})
    if nombre == 'buscar_cliente':
        return {'texto': json.dumps(find_people(entrada.get('texto') or ''), ensure_ascii=False)}
    if nombre == 'expediente_cliente':
        tipo = (opciones or {}).get('expediente') or 'ficha'
        return {'texto': dossier(user, entrada.get('cliente_id'), tipo)}
    if nombre in DATOS:
        entrada.setdefault('sistema', 'work')
    texto, es_error = copiloto_datos.ejecutar(nombre, entrada, user)
    out = {'texto': f'Error: {texto}' if es_error else texto}
    if nombre == 'calcular_tabla' and not es_error and entrada.get('sistema') == 'work':
        try:
            out['plan'] = motor.prepare(user, entrada.get('plan'))[1]
        except motor.MotorError:
            pass
    return out


# --- Datos ------------------------------------------------------------------------------------------------------

def dictionary():
    """Conceptos y fuentes (sin columnas ni calculados: esos los pide el motor, no el cerebro)."""
    fuentes = {}
    for clave, f in catalogo.sources(_SinRol()).items():
        t = {k: v for k, v in (diccionario.tabla(clave) or {}).items()
             if k not in ('columnas', 'derivados', 'conceptos')}
        fuentes[clave] = {**t, 'nombre': f.label, 'principal': clave in catalogo.NAMED, 'columna_nombre': ETIQUETA}
    conceptos = {k: {c: v.get(c) for c in ('clave', 'nombre', 'fuente', 'condicion', 'palabras', 'significado',
                                           'ejemplo')}
                 for k, v in diccionario.conceptos().items() if v.get('fuente') in fuentes}
    return {'conceptos': conceptos, 'fuentes': fuentes}


def _fuente(user, clave):
    return catalogo.source(user, str(clave or ''))


def has_field(user, fuente, dato):
    f = _fuente(user, fuente)
    return bool(f and dato in f.fields)


def field_for(user, fuente, texto, estricto=False):
    if not estricto:
        return buscar.campo_para(user, fuente, texto)
    f = _fuente(user, fuente)
    t = buscar.fold(texto)
    for palabra, claves in buscar.DIMENSIONS.items():
        if f and palabra in t:
            return next((c for c in claves if c in f.fields), None)
    return None


# Dónde está el email de la persona de la fila, de más directo a menos.
EMAIL_DE_PERSONA = ('f.email', 'p.person_uuid.email', 'p.client_id.email')


def person_condition(user, fuente, email):
    f = _fuente(user, fuente)
    campo = next((c for c in EMAIL_DE_PERSONA if f and c in f.fields), None)
    if campo is None:
        raise ConectorError(f'La fuente «{fuente}» no tiene el email de la persona.')
    return {'field': campo, 'op': 'eq', 'value': email}


def normalize(user, plan):
    """[plan, errores], como TablePlan::normalize de la Academia. La columna de nombre del cerebro se descarta: en
    Work el nombre de cada fila ya viaja en `fila`."""
    plan = dict(plan or {})
    f = _fuente(user, plan.get('fuente'))
    if f is None:
        return [[], [f"La fuente «{plan.get('fuente')}» no existe. Pedí la lista de fuentes."]]
    plan['columnas'] = [c for c in plan.get('columnas') or [] if c != ETIQUETA]
    return list(normalizar_plan(f, plan))


def labels(user, fuente):
    f = _fuente(user, fuente)
    return {k: c.label for k, c in f.fields.items()} if f else {}


def rows(user, plan, limite):
    """{total, filas}: cada fila con su clave, su nombre (`fila`), su alumno_id y las columnas por nombre."""
    try:
        p = motor.run(user, plan, por_pagina=max(1, min(50, int(limite or 10))), con_medicion=False)
    except motor.MotorError as e:
        raise ConectorError(' '.join(e.errores)) from e
    nombres = {c['clave']: c['nombre'] for c in p.get('columnas') or []}
    personas = _nombres_de_personas([r.get('persona') for r in p.get('filas') or [] if _sin_nombre(r.get('fila'))])
    filas = [{'clave': r.get('clave'), 'alumno_id': r.get('alumno_id'),
              'fila': (personas.get(r.get('persona')) if _sin_nombre(r.get('fila')) else None) or r.get('fila'),
              **{nombres.get(k, k): v for k, v in r.items() if k in nombres}} for r in p.get('filas') or []]
    return {'total': p['total'], 'filas': filas}


def _sin_nombre(fila):
    """Las tablas sin columna de nombre (agendas, ventas) se nombran «#id»: para una lista sirve más su persona."""
    return fila is None or str(fila).startswith('#')


def _nombres_de_personas(uuids):
    uuids = [u for u in dict.fromkeys(uuids) if u]
    if not uuids:
        return {}
    return dict(db.session.query(Person.uuid, Person.full_name).filter(Person.uuid.in_(uuids)).all())


def measures(plan):
    return bool((plan or {}).get('agrupar_por') or (plan or {}).get('medir'))


def measure(user, plan):
    """La medición del motor: {total, value, porcentaje?, warnings} o, por grupo, {total, rows: [{k, n, m}], others,
    group, warnings}. Es la misma forma que el Board de la Academia."""
    try:
        return motor.run(user, plan, por_pagina=1).get('medicion') or {}
    except motor.MotorError as e:
        raise ConectorError(' '.join(e.errores)) from e


# --- Personas: los clientes -------------------------------------------------------------------------------------

def _clientes(filtro):
    q = (db.session.query(Client, Person).outerjoin(Person, Person.uuid == Client.person_uuid)
         .filter(filtro).order_by(Client.created_at.desc()).limit(CLIENTES_MAX))
    from app.services.closer_followup_service import PROGRAM_CODE_NAMES, CloserFollowUpService
    out = []
    for c, p in q.all():
        codigo = CloserFollowUpService._client_program_code(c.id)
        out.append({'student_id': c.id, 'nombre': (p and p.full_name) or c.full_name or '',
                    'email': (p and p.email) or c.email or '', 'programa': PROGRAM_CODE_NAMES.get(codigo, codigo),
                    'ultimo_ingreso': None})
    return out


def find_people(texto):
    texto = str(texto or '').strip()
    if len(texto) < 2:
        return []
    like = f'%{texto}%'
    return _clientes(or_(Person.full_name.ilike(like), Person.email.ilike(like), Person.phone.ilike(like),
                         Client.full_name.ilike(like), Client.email.ilike(like), Client.phone.ilike(like)))


def people_by_id(ids):
    return _clientes(Client.id.in_([int(i) for i in ids or []]))


def people_named(palabras, maximo=4):
    nombre = func.coalesce(Person.full_name, Client.full_name)
    q = db.session.query(Client.id).outerjoin(Person, Person.uuid == Client.person_uuid)
    for w in palabras or []:
        q = q.filter(nombre.ilike(f'%{w}%'))
    ids = [r[0] for r in q.limit(int(maximo) + 1).all()]
    return ids if ids and len(ids) <= int(maximo) else []


def person(cliente_id):
    c = db.session.get(Client, int(cliente_id or 0))
    if c is None:
        return None
    p = c.person
    return {'id': c.id, 'name': (p and p.full_name) or c.full_name or '', 'email': (p and p.email) or c.email or ''}


def _linea(e):
    partes = [str(e.get('fecha') or '')[:16].replace('T', ' '), e.get('grupo'), e.get('que'), e.get('detalle'),
              e.get('por') and f"por {e['por']}"]
    return '- ' + ' · '.join(str(p).replace('\n', ' ') for p in partes if p)


def dossier(user, cliente_id, tipo='ficha'):
    """El expediente en texto. La ficha: lo de la ficha del lead (sin la cobranza si no ve montos). El completo suma la
    bitácora del lead, con lo de la Academia si está vinculado."""
    from app.services import bitacora_lead_service, ficha_lead_service
    c = db.session.get(Client, int(cliente_id or 0))
    if c is None:
        return 'No existe un cliente con ese id.'
    nombre = (c.person and c.person.full_name) or c.full_name or f'cliente {c.id}'
    lineas = [f'# Expediente de {nombre} (cliente {c.id} en Work)',
              f"Generado el {datetime.utcnow().strftime('%Y-%m-%d %H:%M')} UTC."]
    # Con la agenda más reciente: sin agenda, la ficha ancla una nueva (escribe), y un expediente solo lee.
    appt = Appointment.query.filter_by(client_id=c.id).order_by(Appointment.start_time.desc()).first()
    if appt is not None:
        f = ficha_lead_service.ficha(appointment_id=appt.id, usuario=user) or {}
        quitar = {'permisos', 'vocabulario'} | (set() if exclusion.sees_amounts(user) else {'cobro'})
        for clave, valor in f.items():
            if clave in quitar or not valor:
                continue
            if clave == 'comunicacion':
                valor = {'notas': valor.get('notas')}
            lineas += ['', f'## {clave.capitalize()}', json.dumps(valor, ensure_ascii=False, default=str)]
    else:
        lineas += ['', 'Sin agendas en Work.']
        tipo = 'completo'  # sin ficha, lo que hay de esa persona está en la bitácora
    if tipo == 'completo':
        quien = {'email': getattr(user, 'email', None), 'rol': getattr(user, 'role', None)}
        b = bitacora_lead_service.bitacora(c, quien)
        lineas += ['', f'## Bitácora (hasta {EXPEDIENTE_ENTRADAS} entradas, lo más nuevo primero)']
        if b.get('aviso_academia'):
            lineas.append(f"Aviso: {b['aviso_academia']}")
        entradas = [e | {'grupo': f"{t['label']} · {e.get('grupo')}"} for t in b['tramos'] for e in t['entradas']]
        lineas += [_linea(e) for e in sorted(entradas, key=lambda e: e['fecha'], reverse=True)[:EXPEDIENTE_ENTRADAS]]
    return '\n'.join(lineas)


# --- Equipo -----------------------------------------------------------------------------------------------------

def team():
    """Las cuentas activas, con sus agendas como closer de los últimos 90 días (para desempatar apodos)."""
    desde = datetime.utcnow() - timedelta(days=EQUIPO_DIAS)
    agendas = dict(db.session.query(Appointment.closer_id, func.count()).filter(Appointment.start_time >= desde)
                   .group_by(Appointment.closer_id).all())
    return [{'id': u.id, 'name': u.username or u.email, 'activity': int(agendas.get(u.id, 0))}
            for u in User.query.filter(User.is_active == True).all()]  # noqa: E712


# --- Las operaciones --------------------------------------------------------------------------------------------

def handle(op, args, quien=None):
    """El valor de una operación del contrato. ConectorError si el pedido está mal armado."""
    a = args if isinstance(args, dict) else {}
    user = usuario(a.get('quien') or quien)
    ops = {
        'guide': guide,
        'appendix': appendix,
        'askerNote': lambda: asker_note(a.get('quien') or quien),
        'tools': tools,
        'plannerTools': planner_tools,
        'planSchema': plan_schema,
        'runTool': lambda: run_tool(str(a.get('nombre') or ''), a.get('entrada'), user, a.get('opciones')),
        'dictionary': dictionary,
        'find': lambda: buscar.find(user, str(a.get('texto') or ''), list(a.get('terminos') or [])),
        'hasField': lambda: has_field(user, a.get('fuente'), a.get('dato')),
        'fieldFor': lambda: field_for(user, a.get('fuente'), str(a.get('texto') or ''), bool(a.get('estricto'))),
        'personCondition': lambda: person_condition(user, a.get('fuente'), str(a.get('email') or '')),
        'topicCondition': lambda: None,
        'normalize': lambda: normalize(user, a.get('plan')),
        'labels': lambda: labels(user, a.get('fuente')),
        'rows': lambda: rows(user, a.get('plan'), a.get('limite')),
        'measures': lambda: measures(a.get('plan')),
        'measure': lambda: measure(user, a.get('plan')),
        'card': lambda: None,
        'findPeople': lambda: find_people(a.get('texto')),
        'peopleById': lambda: people_by_id(a.get('ids')),
        'peopleNamed': lambda: people_named(a.get('palabras'), a.get('max') or 4),
        'person': lambda: person(a.get('id')),
        'dossier': lambda: dossier(user, a.get('id'), 'completo' if a.get('tipo') == 'completo' else 'ficha'),
        'team': team,
        'proposeAction': lambda: [None, 'Desde Learnito todavía no se pueden dejar acciones en Work.'],
        'executeAction': _sin_acciones,
        'actionLabel': lambda: None,
        'openGoals': lambda: [],
        'findMaterial': lambda: {'results': [], 'more': []},
    }
    if op not in ops:
        raise ConectorError(f'Operación desconocida: {op}.')
    return ops[op]()


def _sin_acciones():
    raise ConectorError('Desde Learnito todavía no se pueden hacer acciones en Work.')
