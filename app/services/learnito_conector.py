"""El conector de Work para el cerebro de Learnito (en la Academia: VISION/LEARNITO_COMO_SERVICIO.md, etapa 3, y su
API.md §2.15). El cerebro vive en la Academia y le pide a Work lo suyo con `POST {op, args}`: cómo se presenta, sus
herramientas, el diccionario y el motor de tablas, sus clientes y su equipo. Acá no hay IA: Work responde datos. Cada
operación es un método del contrato (LearnitoConnector y LearnitoData de la Academia), con los mismos nombres de
argumentos que su ConnectorServer.

Quien pregunta viaja en `quien` ({id, nombre, email, rol, zona}) con su id de Work: los datos se leen con sus permisos
(montos y tablas de admin, como en Tablas). Sin quien, lo de alguien sin rol. Desde el 24/10/2026 pregunta todo el
equipo: la dirección ve todo y el resto, lo suyo y el ranking (tablas/alcance.py): sus filas, sus clientes y sus
expedientes, y las mediciones de todo el equipo.

Herramientas: las de datos (copiloto_datos.py), las del closer (copiloto_herramientas.py: sus agendas y quién le
debe), buscar un cliente y leer su expediente, y proponer una acción. Acciones: un comentario en la ficha de un
cliente o un aviso a alguien del equipo; el cerebro las muestra y se hacen recién cuando la persona confirma. Un
cálculo que agrupa o mide vuelve con su gráfico (`card`). Material: Work no tiene.
"""
import json
import logging
import unicodedata
from datetime import datetime, timedelta

from sqlalchemy import and_, func, or_, select

from app import db
from app.models import Appointment, Client, ClientComment, Notification, User
from app.models.person import Person
from app.services import copiloto_datos, copiloto_herramientas
from app.services.tablas import alcance, buscar, catalogo, diccionario, exclusion, motor
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
    'closers y su resultado), ventas, pagos, cuotas, suscripciones y la cobranza. Te escribe alguien del equipo: '
    'la dirección (admin, operaciones, director comercial), closers, setters u otros roles. Lo que ve cada uno '
    'está en la nota de quién pregunta.',
    'Te piden cosas como:\n'
    '- Números del comercial: ventas por mes o por closer, show up, no shows, señas sin convertir, cuotas vencidas.\n'
    '- Lo propio de un closer: sus agendas de un día (mis_agendas), quién le debe (los_que_mas_deben, deuda_de).\n'
    '- Quién debe y cuánto, qué cuotas vencen, qué clientes están en riesgo de no pagar.\n'
    '- La historia de un cliente: de dónde vino, sus llamadas, qué compró, qué pagó y qué debe.\n'
    '- Cruzar con la Academia (solo la dirección): cómo viene en sus estudios alguien que debe una cuota.',
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
    'Acciones (proponer_accion), cuando te lo piden: un comentario en la ficha de un cliente (con su cliente_id de '
    'buscar_cliente) o un aviso a alguien del equipo (por su nombre de usuario, y si es sobre un cliente, con su '
    'cliente_id). Una por respuesta. Nada se hace hasta que la persona lo confirma en pantalla: no digas que ya '
    'está hecho, decí en una línea qué dejaste listo. Un mensaje para un cliente (WhatsApp, mail) no es una acción: '
    'redactalo listo para copiar.',
])


def guide():
    return GUIA


# Las frases con que el cerebro habla de Work (ADR-192 de la Academia): presentación y ejemplos del repartidor y del
# planificador. Las reglas son del cerebro; la clave que falta va neutra (StaffAssistant::EXAMPLES).
EJEMPLOS = {
    'presentacion': 'Sos Learnito, el asistente del equipo de Learnation. Respondés en Work, su sistema comercial.',
    'primera_persona': '',
    'planificador': 'Sos el planificador de Learnito, el asistente del equipo de Learnation, en Work (su sistema '
                    'comercial: agendas, ventas y cobranza).',
    'p_tema': '',
    'p_concepto': '(agenda realizada, no show, cuota vencida, seña sin convertir…)',
    'p_glosario': '- Show up = agendas realizadas sobre las agendadas; cierre = la agenda terminó en venta. Para un '
                  'closer o un setter, agrupá por su nombre, nunca por su número.',
    'p_titulo': '("Show up por closer este mes")',
    'aclarar': '("¿cuántos se cayeron?": no shows, agendas canceladas o señas que no pagaron)',
    'r_pregunta': '("¿cuántas ventas hizo Juan este mes?", "¿quiénes de mis clientes tienen una cuota vencida?", '
                  '"¿qué agendas tengo hoy?"). Contar algo repartido por una dimensión también es pregunta ("¿cuántas '
                  'ventas hizo cada closer?", "¿qué fuente trae más agendas?"). También charla, dudas de cómo se hace '
                  'algo y seguir la conversación.',
    'r_investigacion': '("¿por qué bajó el show up este mes?", "¿los que señan rápido terminan pagando más?")',
    'r_accion': 'dejar un comentario en la ficha de un cliente o avisarle algo a alguien del equipo',
    'r_redactar': 'redactar = true si la respuesta es un texto largo a partir de la historia de un cliente (preparar '
                  'una llamada, un mensaje de cobranza, por qué no cerró).',
    'r_categoria': 'alumno (un cliente puntual), grupo (varios clientes, listas, rankings, métricas), material (Work '
                   'no tiene: no la uses), ventas (ventas, pagos, cuotas, señas, deuda), equipo (agendas, show up, el '
                   'trabajo de closers y setters), general (lo demás)',
    'r_tipo': 'dato (contar, listar o repartir algo de Work: agendas, ventas, pagos, cuotas, leads, clientes), alumno '
              '(la historia o la ficha de un cliente puntual) u otro (charla, cómo se hace algo, lo demás; Work no '
              'tiene material)',
    'r_intencion': '("por closer", "por mes")',
    'r_terminos': '("no show", "señó", "no pagó", "cerró")',
    'r_terminos_ej': '("¿qué closers tienen más no shows?": terminos de no shows, dimension closer)',
    'r_filtros': '("cuota vencida", "de Instagram", "con seña"): "¿cuántos clientes de Instagram tienen la cuota '
                 'vencida?" cuenta "de Instagram" con el filtro "cuota vencida".',
    'r_filtro_o': '("no show o cancelada")',
    'r_dato_extra': '',
    'r_alumno': 'alumno = el nombre del cliente si nombra a uno.',
    'r_tema': '',
    'r_medida': '(por ejemplo avg de "monto de la venta")',
    'r_con': 'La conversación es sobre un cliente puntual.',
    'r_sin': 'La conversación no tiene un cliente elegido.',
}


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
                  'p.setter_id.username), no su número (f.closer_id): la respuesta nombra al closer, nunca su id. '
                  'El show up rate es un solo paso: agendas con el concepto agenda_realizada, agrupar_por '
                  'p.closer_id.username y medir pct de s.asistio con valor si (lee s.estado_agenda, no '
                  'f.closer_result).')
    return '\n'.join(lineas)


def asker_note(quien):
    q = quien or {}
    user = usuario(q)
    if alcance.completo(user):
        ve = 'Es de la dirección: ve todos los datos de Work y de la Academia.'
    else:
        ve = ('No es de la dirección: ve lo suyo y el ranking. Las listas, los clientes y los expedientes son solo '
              'los suyos (donde figura o personas con las que tuvo una agenda); las mediciones (totales, '
              'porcentajes, por closer o por programa) son de todo el equipo. Los datos de la Academia no los ve. Si '
              'pide algo de otro, decíselo en una línea y ofrecé el número del equipo.')
    return (f"Te escribe {q.get('nombre')} ({q.get('email')}), rol {q.get('rol')} en Work. {ve} Cuando diga \"mis "
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

ACCIONES = {'comentario': 'Comentario en el cliente', 'aviso': 'Avisarle a alguien'}

PROPONER = {
    'name': 'proponer_accion',
    'description': 'Deja lista una acción para que la persona la confirme: comentario (una nota en la ficha de un '
                   'cliente) o aviso (una notificación en Work para alguien del equipo). Nada se hace hasta que '
                   'confirma.',
    'input_schema': {'type': 'object', 'properties': {
        'tipo': {'type': 'string', 'enum': list(ACCIONES)},
        'texto': {'type': 'string', 'description': 'El comentario, o lo que dice el aviso (corto y concreto).'},
        'cliente_id': {'type': 'integer', 'description': 'Comentario: obligatorio. Aviso: si es sobre un cliente.'},
        'para': {'type': 'string', 'description': 'Solo aviso: el nombre de usuario de quien lo recibe.'},
    }, 'required': ['tipo', 'texto']},
}

DATOS = ('buscar_datos', 'fuentes_de_datos', 'calcular_tabla')
CLOSER = {t['name'] for t in copiloto_herramientas.HERRAMIENTAS}


def _api(t):
    return {'name': t['name'], 'description': t['description'], 'inputSchema': t['input_schema']}


def _solo_work(t):
    """La herramienta sin `sistema`: el planificador arma planes que corre Work."""
    schema = json.loads(json.dumps(t['input_schema']))
    schema['properties'].pop('sistema', None)
    schema['required'] = [r for r in schema.get('required', []) if r != 'sistema']
    return {'name': t['name'], 'description': t['description'], 'inputSchema': schema}


def tools():
    return [_api(t) for t in [*copiloto_datos.HERRAMIENTAS, *copiloto_herramientas.HERRAMIENTAS, *CLIENTES, PROPONER]]


def planner_tools():
    return [_solo_work(t) for t in copiloto_datos.HERRAMIENTAS if t['name'] in ('buscar_datos', 'fuentes_de_datos')]


def plan_schema():
    return copiloto_datos.PLAN


def run_tool(nombre, entrada, user, opciones=None):
    """{texto, plan?}: el texto va al modelo; el plan, al banco de planes del cerebro."""
    entrada = dict(entrada or {})
    if nombre == 'buscar_cliente':
        return {'texto': json.dumps(find_people(user, entrada.get('texto') or ''), ensure_ascii=False)}
    if nombre == 'expediente_cliente':
        tipo = (opciones or {}).get('expediente') or 'ficha'
        return {'texto': dossier(user, entrada.get('cliente_id'), tipo)}
    if nombre in CLOSER:
        if getattr(user, 'id', None) is None:
            return {'texto': 'Error: no sé quién pregunta.'}
        texto, es_error = copiloto_herramientas.ejecutar(nombre, entrada, user)
        return {'texto': f'Error: {texto}' if es_error else texto}
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
                                           'ejemplo', 'actual')}
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


METRICAS = {'count': 'Cantidad', 'sum': 'Suma', 'avg': 'Promedio', 'min': 'Mínimo', 'max': 'Máximo'}
MESES = ('ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic')


def _periodo(k, bucket):
    """2026-10 → oct 2026; 2026-10-19 → 19/10. Lo demás, tal cual."""
    try:
        if bucket == 'month':
            return f'{MESES[int(k[5:7]) - 1]} {k[:4]}'
        if bucket in ('day', 'week'):
            return f'{k[8:10]}/{k[5:7]}'
    except (TypeError, ValueError, IndexError):
        pass
    return k


def card(user, plan):
    """El gráfico de un plan que agrupa o mide, para adjuntar a la respuesta: {title, w, data, error} o None.
    `w.tipo`: numero, anillo (un porcentaje), barras (por valor) o linea (por período). Lo dibuja la pantalla de
    Learnito de Work (LearnitoChat, Grafico)."""
    if not measures(plan):
        return None
    try:
        fuente, p = motor.prepare(user, plan)
        m = motor.run(user, plan, por_pagina=1).get('medicion')
    except motor.MotorError:
        return None
    if not m:
        return None
    medir = p['medir'] or {'metrica': 'count', 'dato': None, 'valor': ''}
    pct = medir['metrica'] == 'pct'
    dato = fuente.fields[medir['dato']].label.lower() if medir.get('dato') in fuente.fields else ''
    title = (f"% con {dato} = {medir['valor']}" if pct
             else fuente.label if medir['metrica'] == 'count' else f"{METRICAS[medir['metrica']]} de {dato}")
    if 'rows' in m:
        bucket = (m.get('group') or {}).get('bucket')
        title += f" por {fuente.fields[p['agrupar_por']].label.lower()}"
        filas = [{'label': '(vacío)' if r['k'] is None else _periodo(r['k'], bucket), 'valor': r['n'], 'filas': r['m'],
                  **({'ic95': r['ic95']} if r.get('ic95') else {})} for r in m['rows']]
        return {'title': title, 'w': {'tipo': 'linea' if bucket else 'barras', 'pct': pct}, 'error': None,
                'data': {'total': m['total'], 'filas': filas, 'otros': m.get('others') or 0}}
    valor = m.get('porcentaje', 0) if pct else m.get('value')
    return {'title': title, 'w': {'tipo': 'anillo' if pct else 'numero', 'pct': pct}, 'error': None,
            'data': {'total': m['total'], 'valor': valor}}


# --- Personas: los clientes -------------------------------------------------------------------------------------

def _suyos(user):
    """Los clientes de quien pregunta fuera de la dirección: con los que tuvo una agenda (tablas/alcance.py)."""
    uid = getattr(user, 'id', None)
    agendas = select(Appointment.client_id).where(or_(Appointment.closer_id == uid, Appointment.setter_id == uid))
    return Client.id.in_(agendas)


def _clientes(user, filtro):
    if not alcance.completo(user):
        filtro = filtro & _suyos(user)
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


TILDES = list(zip('áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'))


def _plano(col):
    """La columna en minúsculas y sin tildes, en SQLite y en Postgres: "Santillán" encuentra a "SANTILLAN"."""
    for con, sin in TILDES:
        col = func.replace(col, con, sin)
    return func.lower(col)


def _sin_tildes(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', str(texto).lower()) if unicodedata.category(c) != 'Mn')


def _por_nombre(palabras):
    """Cada palabra en el nombre, en cualquier orden y sin importar tildes: "Kevin Santillán" encuentra a "KEVIN LUIS
    SANTILLAN SANCHEZ"."""
    return and_(*[or_(_plano(Person.full_name).like(f'%{w}%'), _plano(Client.full_name).like(f'%{w}%'))
                  for w in palabras])


def find_people(user, texto):
    texto = str(texto or '').strip()
    if len(texto) < 2:
        return []
    like = f'%{texto}%'
    return _clientes(user, or_(_por_nombre(_sin_tildes(texto).split()), Person.email.ilike(like),
                               Person.phone.ilike(like), Client.email.ilike(like), Client.phone.ilike(like)))


def people_by_id(user, ids):
    return _clientes(user, Client.id.in_([int(i) for i in ids or []]))


def people_named(user, palabras, maximo=4):
    nombre = func.coalesce(Person.full_name, Client.full_name)
    q = db.session.query(Client.id).outerjoin(Person, Person.uuid == Client.person_uuid)
    if not alcance.completo(user):
        q = q.filter(_suyos(user))
    for w in palabras or []:
        q = q.filter(_plano(nombre).like(f'%{_sin_tildes(w)}%'))
    ids = [r[0] for r in q.limit(int(maximo) + 1).all()]
    return ids if ids and len(ids) <= int(maximo) else []


def _cliente(user, cliente_id):
    """El cliente, si quien pregunta lo puede ver (la dirección, todos; el resto, los suyos)."""
    try:
        q = Client.query.filter(Client.id == int(cliente_id or 0))
    except (TypeError, ValueError):
        return None
    if not alcance.completo(user):
        q = q.filter(_suyos(user))
    return q.first()


def person(user, cliente_id):
    c = _cliente(user, cliente_id)
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
    c = _cliente(user, cliente_id)
    if c is None:
        return ('No existe un cliente con ese id.' if alcance.completo(user)
                else 'No existe un cliente con ese id entre los tuyos (con los que tuviste una agenda).')
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


# --- Acciones ---------------------------------------------------------------------------------------------------

def _destinatario(texto):
    """[usuario, error] de quien recibe un aviso: por nombre de usuario o email, entre las cuentas activas."""
    t = str(texto or '').strip().lstrip('@')
    if len(t) < 2:
        return None, 'Falta a quién avisarle (su nombre de usuario).'
    activos = User.query.filter(User.is_active == True)  # noqa: E712
    exacto = activos.filter(or_(func.lower(User.username) == t.lower(), func.lower(User.email) == t.lower())).all()
    candidatos = exacto or activos.filter(or_(User.username.ilike(f'%{t}%'), User.email.ilike(f'%{t}%'))).limit(6).all()
    if len(candidatos) == 1:
        return candidatos[0], None
    if not candidatos:
        return None, f'No hay nadie del equipo que se llame «{t}».'
    return None, 'Hay más de una persona con ese nombre: ' + ', '.join(u.username or u.email for u in candidatos) + '.'


def _nombre_cliente(c):
    return (c.person and c.person.full_name) or c.full_name or f'cliente {c.id}'


def propose_action(user, entrada):
    """[acción, error]: la tarjeta que el cerebro muestra para confirmar. No escribe nada."""
    e = entrada if isinstance(entrada, dict) else {}
    tipo = str(e.get('tipo') or '')
    texto = str(e.get('texto') or '').strip()[:2000]
    if getattr(user, 'id', None) is None:
        return [None, 'No sé quién pregunta.']
    if tipo not in ACCIONES:
        return [None, 'Tipo de acción desconocido: comentario o aviso.']
    if not texto:
        return [None, 'Falta el texto.']
    cliente = None
    if e.get('cliente_id') not in (None, ''):
        cliente = _cliente(user, e.get('cliente_id'))
        if cliente is None:
            return [None, 'Ese cliente no existe o no es tuyo (con los que tuviste una agenda).']
    datos = {'autor_id': user.id, 'cliente_id': cliente.id if cliente else None}
    if tipo == 'comentario':
        if cliente is None:
            return [None, 'Un comentario va en la ficha de un cliente: falta su cliente_id (buscar_cliente).']
        detalle = [f'En la ficha de {_nombre_cliente(cliente)}.']
        nombre = _nombre_cliente(cliente)
    else:
        para, error = _destinatario(e.get('para'))
        if error:
            return [None, error]
        datos['para_id'] = para.id
        nombre = para.username or para.email
        detalle = [f'Para: {nombre}', *([f'Sobre {_nombre_cliente(cliente)}.'] if cliente else []),
                   'Le llega como notificación en Work.']
    return [{'tipo': tipo, 'titulo': ACCIONES[tipo], 'nombre': nombre, 'texto': texto, 'estado': 'propuesta',
             'datos': datos, 'detalle': detalle}, None]


def execute_action(user, accion, texto):
    """Hace la acción que la persona confirmó (`texto`, el que quedó después de editarla). Devuelve qué se hizo."""
    a = accion if isinstance(accion, dict) else {}
    datos = a.get('datos') or {}
    if getattr(user, 'id', None) is None or datos.get('autor_id') != user.id:
        raise ConectorError('Esa acción es de otra persona.')
    texto = (str(texto or '').strip() or str(a.get('texto') or '').strip())[:2000]
    if not texto:
        raise ConectorError('El texto está vacío.')
    cliente = _cliente(user, datos['cliente_id']) if datos.get('cliente_id') else None
    if datos.get('cliente_id') and cliente is None:
        raise ConectorError('Ese cliente ya no está entre los tuyos.')
    autor = user.username or user.email
    if a.get('tipo') == 'comentario':
        db.session.add(ClientComment(client_id=cliente.id, author_id=user.id, text=texto))
        db.session.commit()
        return f'Comentario guardado en la ficha de {_nombre_cliente(cliente)}.'
    if a.get('tipo') == 'aviso':
        para = db.session.get(User, int(datos.get('para_id') or 0))
        if para is None or not para.is_active:
            raise ConectorError('Esa persona ya no está activa en Work.')
        sobre = f' sobre {_nombre_cliente(cliente)}' if cliente else ''
        db.session.add(Notification(subject=f'Aviso de {autor}{sobre}'[:100], content=texto, target_users=[para.id],
                                    associated_id=cliente.id if cliente else None,
                                    associated_type='lead' if cliente else None))
        db.session.commit()
        return f'Aviso enviado a {para.username or para.email}.'
    raise ConectorError('Tipo de acción desconocido.')


# --- Las operaciones --------------------------------------------------------------------------------------------

def handle(op, args, quien=None):
    """El valor de una operación del contrato. ConectorError si el pedido está mal armado."""
    a = args if isinstance(args, dict) else {}
    user = usuario(a.get('quien') or quien)
    ops = {
        'guide': guide,
        'examples': lambda: EJEMPLOS,
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
        'card': lambda: card(user, a.get('plan')),
        'findPeople': lambda: find_people(user, a.get('texto')),
        'peopleById': lambda: people_by_id(user, a.get('ids')),
        'peopleNamed': lambda: people_named(user, a.get('palabras'), a.get('max') or 4),
        'person': lambda: person(user, a.get('id')),
        'dossier': lambda: dossier(user, a.get('id'), 'completo' if a.get('tipo') == 'completo' else 'ficha'),
        'team': team,
        'proposeAction': lambda: propose_action(user, a.get('entrada')),
        'executeAction': lambda: execute_action(user, a.get('accion'), a.get('texto')),
        'actionLabel': lambda: ACCIONES.get(str(a.get('tipo') or '')),
        'openGoals': lambda: [],
        'findMaterial': lambda: {'results': [], 'more': []},
    }
    if op not in ops:
        raise ConectorError(f'Operación desconocida: {op}.')
    return ops[op]()
