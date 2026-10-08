"""Formularios de postulación editables (panel de Hiring → Forms).

`PREGUNTAS_BASE` es copia fiel del `PREGUNTAS_BASE` del formulario público de
Asistente (institute-site, vacante-assistant/formulario/index.html, la versión
que lee sus preguntas de la API): mismas claves, mismos textos y mismas opciones
—texto suelto o {t} con sus marcas (`ko`, `pts`, `correcta`, `reexplica`,
`bloquea`, `nota`)—. Allá ya es JSON puro:
  · el texto que cambia según el país va en `t_pais` / `h_pais`
    ({"Brasil": "..."});
  · la condición de una pregunta va en `si: {id, es}` (también `igual`,
    `valor`, `en` o `valores`; ver `cumple_condicion`);
  · la equivalencia en reales de `remuneracion` va en `ref: 'brl'` (la tasa sale
    de la configuración de la búsqueda, ver HiringConfig).
Cada pregunta suma `on` (si se pregunta) y `base` (una de las originales: se
puede apagar pero no borrar, porque tiene columna y la usan el score y el panel).

El primer formulario no lo siembra la migración: lo crea `asegurar_semilla()` la
primera vez que alguien lo pide (los endpoints del editor y el GET público).
"""
import copy
import json
import re

from app import db
from app.models import AssistantApplication, HiringForm

NOMBRE_BASE = 'Asistente Administrativa y Personal'

NIVEL5 = [
    'Nunca lo usé', 'Básico, me defiendo con lo esencial', 'Intermedio, lo uso seguido sin ayuda',
    'Avanzado, resuelvo cosas complejas sola/o', 'Experta/o, se lo podría enseñar a otra persona',
]
IDIOMA4 = ['No lo hablo', 'Básico', 'Intermedio', 'Avanzado o nativo']


def _o(*textos):
    """Opciones sin marcas: texto suelto, como en el formulario (que acepta
    texto suelto o {t})."""
    return list(textos)


_PREGUNTAS = [
    # Antes de empezar
    {'id': 'listo', 'bloque': 'Antes de empezar', 'tipo': 'intro', 'req': False, 't': 'Antes de empezar',
     'h': 'Recomendaciones para que tu postulación\nsea considerada en la selección.',
     'reqs': [
         {'ic': 'clock', 'c': 'info', 't': 'Ten 15 minutos disponibles', 'd': 'Requerido para completar todo'},
         {'ic': 'edit', 'c': 'warning', 't': 'Hazlo desde la computadora', 'd': 'Para tener cámara y micrófono'},
         {'ic': 'check-circle', 'c': 'success', 't': 'Completa todos los apartados', 'd': 'Si uno falta, tu postulación se descarta'},
     ]},

    # Bloque 1 · Identificación
    {'id': 'pais', 'bloque': 'Identificación', 'tipo': 'radio', 'req': True, 't': '¿En qué país vivís?',
     'o': _o('🇦🇷  Argentina', '🇧🇷  Brasil', '🇻🇪  Venezuela')},
    {'id': 'ciudad', 'bloque': 'Identificación', 'tipo': 'buscable', 'req': True, 't': '¿En qué provincia vivís?',
     't_pais': {'Brasil': '¿En qué estado vivís?'}, 'h': 'Escribí para filtrar y elegí una de la lista.'},
    {'id': 'nombre', 'bloque': 'Identificación', 'tipo': 'texto', 'req': True, 't': '¿Cómo te llamás?',
     'h': 'Nombre y apellido, como figura en tus documentos.'},
    {'id': 'email', 'bloque': 'Identificación', 'tipo': 'texto', 'req': True, 'mail': True, 't': '¿Cuál es tu email?',
     'h': 'Ahí te avisamos si avanzás en el proceso.'},
    {'id': 'whatsapp', 'bloque': 'Identificación', 'tipo': 'tel', 'req': True, 't': '¿Cuál es tu WhatsApp?',
     'h': 'El código de país ya está puesto. Escribí el resto del número.'},
    {'id': 'edad', 'bloque': 'Identificación', 'tipo': 'numero', 'req': True, 'unidad': 'años', 'min': 16, 'max': 80,
     'ph': '32', 't': '¿Qué edad tenés?', 'guarda': True},

    # Bloque 2 · Excluyentes
    {'id': 'equipo', 'bloque': 'Requisitos', 'tipo': 'radio', 'req': True, 't': '¿Tenés el equipo para trabajar?',
     'h': 'Computadora propia, internet estable y celular con WhatsApp.', 'o': [
         {'t': 'Sí, las tres cosas'},
         {'t': 'Tengo computadora y celular, pero mi internet falla seguido', 'ko': True},
         {'t': 'Me falta alguna de las tres', 'ko': True},
     ]},
    {'id': 'disponibilidad', 'bloque': 'Requisitos', 'tipo': 'radio', 'req': True,
     't': '¿Tenés la disponibilidad que pide el puesto?',
     'h': 'Arranca con 4 horas diarias los primeros dos meses y desde el tercer mes pasa a 8 horas diarias, de lunes a sábados.', 'o': [
         {'t': 'Sí, las 4 horas ahora y las 8 desde el tercer mes'},
         {'t': 'Solo podría las 4 horas, no podría escalar a 8', 'ko': True},
         {'t': 'No tengo esa disponibilidad', 'ko': True},
     ]},
    {'id': 'horario', 'bloque': 'Requisitos', 'tipo': 'radio', 'req': True, 't': '¿Podés trabajar sin horario fijo?',
     'h': 'Vos organizás tus horas dentro de una franja amplia, aproximadamente entre las 8:00 y las 22:00. En momentos puntuales aparece algo urgente que hay que resolver ese mismo día.', 'o': [
         {'t': 'Sí, me organizo sin problema'},
         {'t': 'No, necesito un horario fijo y cerrado', 'ko': True},
     ]},
    {'id': 'empleo', 'bloque': 'Requisitos', 'tipo': 'radio', 'req': True,
     't': '¿Estás trabajando actualmente en otro empleo?', 'o': [
         {'t': 'No'},
         {'t': 'Sí, medio tiempo o freelance, y podría acomodarlo'},
         {'t': 'Sí, tiempo completo, y lo mantendría', 'ko': True},
     ]},

    # Bloque 3 · Remuneración
    {'id': 'confirma', 'bloque': 'Remuneración', 'tipo': 'radio', 'req': True, 'pre': 'sueldo',
     't': '¿Cómo arranca el puesto?', 'h': 'Una sola pregunta para confirmar que quedó claro.', 'o': [
         {'t': 'Arranco con 4 horas diarias y desde el tercer mes paso a 8 horas', 'correcta': True},
         {'t': 'Arranco con 8 horas diarias desde el primer día', 'reexplica': True},
         {'t': 'Son 4 horas diarias siempre, no cambia', 'reexplica': True},
         {'t': 'Son 8 horas los primeros dos meses y después bajan a 4', 'reexplica': True},
     ]},
    {'id': 'remuneracion', 'bloque': 'Remuneración', 'tipo': 'numero', 'req': True, 'unidad': 'USD por mes',
     't': '¿Cuánto pedís por mes?',
     'h': 'Pon tu remuneración mensual en dólares pretendida por un trabajo de 4 horas diarias.',
     'ph': '300', 'ref': 'brl'},

    # Bloque 4 · Experiencia
    {'id': 'experiencia', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': '¿Cuántos años de experiencia tenés?',
     'h': 'Como asistente ejecutiva, asistente personal, administración u operaciones.',
     'o': _o('No tengo experiencia en este tipo de puesto', 'Menos de 1 año', 'Entre 1 y 2 años',
             'Entre 3 y 5 años', 'Más de 5 años')},
    {'id': 'digital', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': '¿Trabajaste en un negocio digital?',
     'h': 'Infoproducto, agencia o e-commerce.',
     'o': _o('Nunca', 'Sí, menos de 1 año', 'Sí, entre 1 y 3 años', 'Sí, más de 3 años')},
    {'id': 'remoto', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': '¿Cuánto trabajaste 100 % remoto?',
     'h': 'Organizando vos misma/o tu día, sin nadie encima.',
     'o': _o('Nunca trabajé remoto', 'Menos de 1 año', 'Entre 1 y 3 años', 'Más de 3 años')},
    {'id': 'dinero', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': '¿Manejaste dinero de la empresa?',
     'h': 'Pagos, comisiones, gastos o proveedores.',
     'o': _o('No, nunca', 'Cargaba datos que otra persona revisaba', 'Preparaba pagos o liquidación de comisiones',
             'Era responsable del control financiero')},
    {'id': 'pm', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': '¿Hiciste de project manager?',
     'h': 'Coordinar el trabajo de otras personas, asignar tareas y perseguir deadlines.',
     'o': _o('No', 'Informalmente, sin que fuera mi rol', 'Sí, con 2 a 5 personas', 'Sí, con más de 5 personas')},
    {'id': 'educacion', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': 'Nivel educativo alcanzado',
     'o': _o('Secundario completo', 'Terciario o técnico', 'Universitario en curso', 'Universitario completo', 'Posgrado')},
    {'id': 'area', 'bloque': 'Experiencia', 'tipo': 'radio', 'req': True, 't': '¿En qué área es tu formación?',
     'o': _o('Administración, contabilidad o finanzas', 'Marketing, comunicación o publicidad',
             'Psicología, recursos humanos o educación', 'Ingeniería, sistemas o datos', 'Otra área',
             'No tengo formación terciaria ni universitaria')},

    # Bloque 5 · Idiomas
    {'id': 'idioma2', 'bloque': 'Idiomas', 'tipo': 'radio', 'req': True, 'o': _o(*IDIOMA4),
     't': '¿Qué nivel de portugués tenés?', 't_pais': {'Brasil': '¿Qué nivel de español tenés?'}},
    {'id': 'ingles', 'bloque': 'Idiomas', 'tipo': 'radio', 'req': True, 't': '¿Qué nivel de inglés tenés?',
     'o': _o(*IDIOMA4)},

    # Bloque 6 · Herramientas
    {'id': 'sheets', 'bloque': 'Herramientas', 'tipo': 'radio', 'req': True, 'apps': ['google-sheets'],
     't': 'Tu nivel de Google Sheets',
     'h': 'Es la herramienta donde viven los reportes, las liquidaciones y el seguimiento diario.', 'o': _o(*NIVEL5)},
    {'id': 'ia_nivel', 'bloque': 'Herramientas', 'tipo': 'radio', 'req': True, 'apps': ['chatgpt', 'claude'],
     't': 'Tu nivel usando ChatGPT y Claude', 'h': 'Son las dos que usamos todos los días acá.', 'o': _o(*NIVEL5)},
    {'id': 'ia_avanzado', 'bloque': 'Herramientas', 'tipo': 'check', 'req': True, 'puntua': True,
     'apps': ['chatgpt', 'claude'],
     't': '¿Qué es lo más avanzado que hiciste con ChatGPT, Claude o similares?', 'h': 'Podés marcar más de una.', 'o': [
         {'t': 'Construí herramientas o automatizaciones con IA que después funcionan solas: un dashboard, un script, un flujo conectado con otras aplicaciones', 'pts': 6},
         {'t': 'Creé mis propios GPTs o asistentes personalizados para tareas que repito', 'pts': 5},
         {'t': 'Uso asistentes que ya existen con prompts propios, con contexto y ejemplos, y los voy corrigiendo hasta que sale lo que quiero', 'pts': 4},
         {'t': 'La uso para redactar, resumir, corregir textos y hacer consultas puntuales', 'pts': 2},
         {'t': 'Casi no la uso', 'pts': 0},
     ]},
    {'id': 'meta', 'bloque': 'Herramientas', 'tipo': 'radio', 'req': True, 'apps': ['meta'],
     't': 'Tu nivel con Meta Business Suite / Administrador de Anuncios',
     'o': _o('Nunca entré', 'Entré pero no publiqué anuncios', 'Publiqué anuncios siguiendo instrucciones',
             'Monto y publico campañas sola/o', 'Gestioné cuentas publicitarias de forma habitual')},
    {'id': 'meta_presupuesto', 'bloque': 'Herramientas', 'tipo': 'parrafo', 'req': True, 'filas': 3, 'largo': 400,
     't': '¿Qué presupuesto mensual manejabas, aproximadamente, y en qué tipo de negocio?',
     'si': {'id': 'meta', 'es': 'Gestioné cuentas publicitarias de forma habitual'}},
    {'id': 'notion', 'bloque': 'Herramientas', 'tipo': 'radio', 'req': True, 'apps': ['notion'], 't': 'Tu nivel con Notion',
     'o': _o('Nunca lo usé', 'Lo usé como bloc de notas', 'Creo páginas y bases de datos simples',
             'Creo bases de datos con vistas, filtros y propiedades',
             'Creo bases de datos relacionadas y sistemas completos')},
    {'id': 'wa_tools', 'bloque': 'Herramientas', 'tipo': 'radio', 'req': True, 'apps': ['whatsapp'],
     't': '¿Usaste WhatsApp para mensajes masivos o flujos?', 'h': 'ManyChat, Wati, Kommo, Chatfuel, Zenvia u otras.',
     'o': _o('Sí, armé flujos automáticos y campañas', 'Sí, mandé difusiones o campañas simples',
             'Las conozco pero no las usé', 'No')},
    {'id': 'automatizacion_ejemplo', 'bloque': 'Herramientas', 'tipo': 'texto', 'req': False, 'apps': ['zapier'],
     't': 'Contá una automatización que hayas armado, en una línea.',
     'h': 'Zapier, Make, n8n o similares. Si nunca armaste una, seguí de largo.'},

    # Bloque 7 · Criterio
    {'id': 'aporte', 'bloque': 'Criterio', 'tipo': 'parrafo', 'req': True, 'filas': 4, 'largo': 500,
     't': '¿Qué le podés aportar al equipo que casi nadie tenga?',
     'h': 'Algo concreto y verificable, no una cualidad genérica.'},

    # Bloque 8 · Organización
    {'id': 'pendientes', 'bloque': 'Organización', 'tipo': 'radio', 'req': True,
     't': '¿Cómo manejás tus pendientes cuando tenés muchas cosas a la vez?',
     'o': _o('Tengo un sistema propio (tablero o lista priorizada) y lo actualizo todos los días',
             'Uso una lista de tareas simple', 'Lo anoto cuando me acuerdo', 'Voy resolviendo lo que va apareciendo')},

    # Bloque 9 · Cómo resolvés
    {'id': 'retraso', 'bloque': 'Cómo resolvés', 'tipo': 'parrafo', 'req': True, 'filas': 7, 'largo': 1200,
     't': 'Una entrega se está atrasando: ¿qué hacés?',
     'h': 'Le pediste a alguien del equipo una entrega para hoy. A media tarde te escribe: «estoy retrasado, no sé si llego». La pieza tiene que publicarse mañana a primera hora. Contá qué hacés ahora y qué harías para que no se repita. Máximo 10 líneas.'},

    # Bloque 10 · Video y CV
    {'id': 'video', 'bloque': 'Video y CV', 'tipo': 'link', 'req': True, 'destaca': True, 't': 'Video de presentación',
     'h': 'Grabá un video de máximo 2 minutos explicando por qué sos la mejor persona para este puesto.',
     'criterios': [
         {'ic': 'inbox', 'c': 'info', 't': 'Comunicación', 'd': 'Cómo te explicás en vivo.'},
         {'ic': 'target', 'c': 'success', 't': 'Interés', 'd': 'Cuánto te importa este puesto.'},
     ],
     'notaPie': 'Sin el video no revisamos la postulación.',
     'chips': [{'t': 'Loom'}, {'t': 'Drive'}]},
    {'id': 'video_verificado', 'bloque': 'Video y CV', 'tipo': 'radio', 'req': True, 't': '¿Probaste el link en incógnito?', 'o': [
        {'t': 'Sí, lo verifiqué'},
        {'t': 'No lo verifiqué todavía', 'bloquea': True,
         'nota': 'Verificalo antes de seguir. Un link que no abre es una postulación descartada.'},
    ]},
    {'id': 'cv', 'bloque': 'Video y CV', 'tipo': 'link', 'req': True, 't': 'Link a tu CV',
     'h': 'PDF con link público, en Drive, Dropbox o LinkedIn.',
     'reglas': ['Incluí dos referencias laborales con contacto. Las llamamos.']},
]

PREGUNTAS_BASE = [{**p, 'on': True, 'base': True} for p in _PREGUNTAS]
IDS_BASE = [p['id'] for p in PREGUNTAS_BASE]
PREGUNTAS_BASE_POR_ID = {p['id']: p for p in PREGUNTAS_BASE}

# --- Validación del editor ----------------------------------------------------

TIPOS = ('radio', 'check', 'buscable', 'texto', 'parrafo', 'numero', 'tel', 'link', 'intro')
TIPOS_CON_OPCIONES = ('radio', 'check')
RE_ID = re.compile(r'^[a-z][a-z0-9_]{1,40}$')
MAX_TITULO = 300
MAX_AYUDA = 600
MAX_OPCION = 240
MAX_OPCIONES = 20
MAX_BYTES = 200_000
# Claves que el editor agrega y el formulario público no necesita.
CLAVES_DEL_EDITOR = ('on', 'base')


class PreguntasInvalidas(ValueError):
    """El mensaje es el que ve quien edita: en castellano y diciendo qué tocar."""


def _rotulo(p, pos):
    return f"«{p.get('id')}»" if p.get('id') else f'la pregunta {pos + 1}'


def validar_preguntas(lista):
    """Revisa la lista que manda el editor. Levanta PreguntasInvalidas con un
    mensaje claro si algo no sirve; las claves que no conoce las deja pasar
    (son del editor o del formulario público)."""
    if not isinstance(lista, list) or not lista:
        raise PreguntasInvalidas('Las preguntas tienen que ser una lista no vacía.')
    if len(json.dumps(lista, ensure_ascii=False).encode('utf-8')) > MAX_BYTES:
        raise PreguntasInvalidas('El formulario es demasiado grande (más de 200 KB). Acortá textos u opciones.')

    vistos = set()
    for pos, p in enumerate(lista):
        if not isinstance(p, dict):
            raise PreguntasInvalidas(f'La pregunta {pos + 1} no tiene el formato esperado.')
        rotulo = _rotulo(p, pos)
        pid = p.get('id')
        if not isinstance(pid, str) or not RE_ID.match(pid):
            raise PreguntasInvalidas(
                f'{rotulo}: el id tiene que empezar con una letra minúscula y llevar solo minúsculas, '
                'números o guion bajo (2 a 41 caracteres).')
        if pid in vistos:
            raise PreguntasInvalidas(f'El id «{pid}» está repetido: cada pregunta necesita uno propio.')
        vistos.add(pid)

        if p.get('tipo') not in TIPOS:
            raise PreguntasInvalidas(f'{rotulo}: el tipo tiene que ser uno de {", ".join(TIPOS)}.')
        if not isinstance(p.get('t', ''), str) or len(p.get('t', '')) > MAX_TITULO:
            raise PreguntasInvalidas(f'{rotulo}: el enunciado es texto de hasta {MAX_TITULO} caracteres.')
        if p.get('h') is not None and (not isinstance(p['h'], str) or len(p['h']) > MAX_AYUDA):
            raise PreguntasInvalidas(f'{rotulo}: la ayuda es texto de hasta {MAX_AYUDA} caracteres.')

        if p['tipo'] in TIPOS_CON_OPCIONES:
            opciones = p.get('o')
            if not isinstance(opciones, list) or not 1 <= len(opciones) <= MAX_OPCIONES:
                raise PreguntasInvalidas(f'{rotulo}: necesita entre 1 y {MAX_OPCIONES} opciones.')
            for opcion in opciones:
                texto = opcion.get('t') if isinstance(opcion, dict) else opcion
                if not isinstance(texto, str) or not texto.strip() or len(texto) > MAX_OPCION:
                    raise PreguntasInvalidas(
                        f'{rotulo}: cada opción necesita un texto de hasta {MAX_OPCION} caracteres.')

        si = p.get('si')
        if si is not None and not (isinstance(si, dict) and isinstance(si.get('id'), str)):
            raise PreguntasInvalidas(f'{rotulo}: la condición tiene que decir de qué pregunta depende.')

        if p.get('base') and pid not in IDS_BASE:
            raise PreguntasInvalidas(f'{rotulo}: una pregunta nueva no puede marcarse como base.')

    faltan = [pid for pid in IDS_BASE if pid not in vistos]
    if faltan:
        raise PreguntasInvalidas(
            'No se pueden borrar las preguntas originales del formulario (se pueden apagar): '
            f'faltan {", ".join(faltan)}.')

    nombre = next(p for p in lista if p['id'] == 'nombre')
    if nombre.get('on') is False or nombre.get('req') is False:
        raise PreguntasInvalidas('«nombre» tiene que quedar prendida y obligatoria: sin el nombre no se guarda la postulación.')


# --- Semilla, resumen y serialización ----------------------------------------

def asegurar_semilla():
    """Si todavía no hay ningún formulario, crea el de las 35 preguntas actuales
    (activo) y le asigna las postulaciones que ya existían. Devuelve el creado o
    None. Una consulta barata en el caso normal: se llama en cada endpoint."""
    if db.session.query(HiringForm.id).first() is not None:
        return None
    form = HiringForm(nombre=NOMBRE_BASE, activo=True, preguntas=copy.deepcopy(PREGUNTAS_BASE))
    db.session.add(form)
    db.session.flush()
    AssistantApplication.query.filter(AssistantApplication.form_id.is_(None)).update(
        {AssistantApplication.form_id: form.id}, synchronize_session=False)
    db.session.commit()
    return form


def form_activo():
    return HiringForm.query.filter_by(activo=True).order_by(HiringForm.id).first()


def respuestas_por_form():
    """{form_id: postulaciones COMPLETAS}, en una sola consulta."""
    filas = (db.session.query(AssistantApplication.form_id, db.func.count(AssistantApplication.id))
             .filter(AssistantApplication.completo.is_(True), AssistantApplication.form_id.isnot(None))
             .group_by(AssistantApplication.form_id).all())
    return dict(filas)


def resumen(form, respuestas=None):
    """Lo que muestra la tarjeta del formulario. `respuestas` es el resultado de
    `respuestas_por_form()` cuando se resumen varios de una vez."""
    preguntas = [p for p in (form.preguntas or []) if isinstance(p, dict) and p.get('tipo') != 'intro']
    activas = [p for p in preguntas if p.get('on') is not False]
    if respuestas is None:
        respuestas = respuestas_por_form()
    return {
        "activas": len(activas),
        "total": len(preguntas),
        "excluyentes": sum(
            1 for p in activas
            if any(isinstance(o, dict) and o.get('ko') for o in (p.get('o') or []))
        ),
        "respuestas": respuestas.get(form.id, 0),
    }


def form_dict(form, respuestas=None, con_preguntas=False):
    data = {
        "id": form.id,
        "nombre": form.nombre,
        "activo": bool(form.activo),
        "created_at": form.created_at.isoformat() if form.created_at else None,
        "updated_at": form.updated_at.isoformat() if form.updated_at else None,
        "resumen": resumen(form, respuestas),
    }
    if con_preguntas:
        data["preguntas"] = form.preguntas or []
    return data


def preguntas_publicas(form):
    """Las preguntas prendidas, en orden, sin las claves del editor.

    `req` va siempre explícito: el backend toma una pregunta sin `req` como
    obligatoria (completitud) y el formulario público, como opcional (`q.req
    && vacio`). Así los dos piden lo mismo."""
    return [
        {**{k: v for k, v in p.items() if k not in CLAVES_DEL_EDITOR}, 'req': bool(p.get('req', True))}
        for p in (form.preguntas or [])
        if isinstance(p, dict) and p.get('on') is not False
    ]
