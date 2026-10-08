"""Alta pública de postulaciones al puesto de Asistente Administrativa y
Personal, desde el formulario de institute.thelearnation.com/vacante-assistant.

Mismo patrón que job_applications.py:
  · va en el blueprint `public_api`, exento de CSRF (ver app/__init__.py);
  · institute.thelearnation.com ya está en la lista blanca de CORS;
  · upsert por dedupe_key: el formulario postea en CADA pregunta respondida,
    así que sin esto cada respuesta generaría una fila nueva.

Desde que las preguntas se editan en el panel (Hiring → Forms), el formulario
las pide acá (`GET /public/assistant-form`) y manda con qué formulario contestó
(`form_id`). Las respuestas a preguntas nuevas, sin columna, van a
`respuestas_extra`.
"""
import logging

from flask import request, jsonify

from app import db
from app.models import AssistantApplication, HiringConfig, HiringForm
from app.models.assistant_application import pais_limpio
from app.api.public import bp
from app.services import hiring_forms

MAX_CORTO = 300
MAX_LARGO = 4000

# {campo del formulario: largo máximo}. El orden es el del formulario actual
# (ver BLOQUES en app/models/assistant_application.py). Los largos son los
# mismos que declaran las columnas — recortar acá evita que una respuesta
# pegada de más haga fallar el INSERT entero en Postgres.
CAMPOS = {
    # Bloque 1 · Identificación ('nombre' se trata aparte: es obligatorio).
    # La provincia/estado llega como `ciudad` (ver ALIAS).
    'pais': 60, 'provincia': 80, 'email': 160, 'whatsapp': 40, 'edad': 40,
    # Bloque 2 · Requisitos
    'equipo': 200, 'disponibilidad': 200, 'horario': 200, 'empleo': 200,
    # Bloque 3 · Remuneración
    'confirma': 200, 'remuneracion': 40,
    # Bloque 4 · Experiencia
    'experiencia': 120, 'digital': 120, 'remoto': 120, 'dinero': 200,
    'pm': 120, 'educacion': 120, 'area': 200,
    # Bloque 5 · Idiomas
    'idioma2': 60, 'ingles': 60,
    # Bloque 6 · Herramientas
    'sheets': 120, 'ia_nivel': 120, 'ia_avanzado': MAX_LARGO,
    'meta': 200, 'meta_presupuesto': MAX_LARGO,
    'notion': 200, 'wa_tools': 200, 'automatizacion_ejemplo': MAX_LARGO,
    # Bloque 7 · Criterio
    'aporte': MAX_LARGO,
    # Bloque 8 · Organización
    'pendientes': 200,
    # Bloque 9 · Cómo resolvés
    'retraso': MAX_LARGO,
    # Bloque 10 · Video y CV
    'video': 500, 'video_verificado': 60, 'cv': 500,
    # Preguntas de la versión anterior del formulario. Ya no se hacen, pero se
    # siguen aceptando por si una pestaña vieja todavía las manda.
    'ia_construido': MAX_LARGO, 'ia_uso': MAX_LARGO, 'automatizaciones': 200,
    'diseno': 300, 'diseno_link': 500, 'instrucciones': MAX_LARGO,
    'monitor': 300, 'martes': MAX_LARGO,
}

# {campo que manda el formulario: columna donde se guarda}. El formulario
# llama `ciudad` a la pregunta «¿en qué provincia/estado vivís?»; la columna
# (y todo el panel: modalidad híbrida/online) la llama `provincia`.
ALIAS = {'ciudad': 'provincia'}

# Separador de las opciones de una pregunta multi-select (ia_avanzado).
SEPARADOR_MULTIPLE = ' | '

# Claves del payload que no son respuestas: nunca van a `respuestas_extra`
# aunque una pregunta nueva se llame igual.
RESERVADAS = {'nombre', 'dedupe_key', 'completo', 'descartado', 'motivo_descarte', 'form_id'}


def _texto(valor, largo=MAX_CORTO):
    if valor is None:
        return None
    if isinstance(valor, (list, tuple)):
        # Multi-select: un str(lista) guardaría los corchetes y las comillas.
        partes = [str(v).strip() for v in valor if str(v).strip()]
        valor = SEPARADOR_MULTIPLE.join(partes)
    texto = str(valor).strip()
    if not texto:
        return None
    return texto[:largo]


def _set_si_presente(app_row, campo, valor):
    """Asigna solo si el valor viene con algo. El guardado progresivo manda el
    formulario acumulado en CADA pregunta, y esas peticiones pueden llegarle al
    servidor desordenadas (red móvil, reintentos); si una más vieja (con menos
    campos contestados todavía) llega después de una más nueva, no debe borrar
    lo que esa más nueva ya había guardado."""
    if valor is None:
        return
    setattr(app_row, campo, valor)


def _form_pedido(valor):
    """El HiringForm del `form_id` que manda el formulario, o None si no viene
    o no existe (un id inventado no rompe el guardado: se ignora)."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, str) and valor.strip().isdigit():
        valor = int(valor.strip())
    if not isinstance(valor, int):
        return None
    return db.session.get(HiringForm, valor)


def _puntaje(valor):
    """El `<id>_pts` que manda el formulario (suma de los `pts` de las opciones
    marcadas): un número, o None si no viene o no es un número."""
    if isinstance(valor, bool):
        return None
    if isinstance(valor, (int, float)):
        return valor
    if isinstance(valor, str):
        try:
            numero = float(valor.strip().replace(',', '.'))
        except ValueError:
            return None
        return int(numero) if numero.is_integer() else numero
    return None


def _guardar_extras(app_row, form, data):
    """Se suman a `respuestas_extra`:
      · las respuestas a preguntas de `form` que no tienen columna;
      · el puntaje `<id>_pts` de las preguntas de `form` que puntúan (lo manda
        el formulario en las de opción múltiple con `pts`), tenga o no columna
        la pregunta.
    Mismo criterio que `_set_si_presente`: lo que no viene en este POST no
    borra lo que ya estaba."""
    if form is None:
        return
    extras = dict(app_row.respuestas_extra or {})
    cambio = False
    for pregunta in form.preguntas or []:
        pid = pregunta.get('id') if isinstance(pregunta, dict) else None
        if not pid or pregunta.get('tipo') == 'intro':
            continue
        nuevos = {f'{pid}_pts': _puntaje(data.get(f'{pid}_pts'))}
        if pid not in CAMPOS and pid not in ALIAS and pid not in RESERVADAS:
            nuevos[pid] = _texto(data.get(pid), MAX_LARGO)
        for clave, valor in nuevos.items():
            if valor is not None and extras.get(clave) != valor:
                extras[clave] = valor
                cambio = True
    if cambio:
        # Dict nuevo: db.JSON no se entera de cambios hechos adentro del viejo.
        app_row.respuestas_extra = extras


@bp.route('/public/assistant-form', methods=['GET'])
def ver_assistant_form():
    """Las preguntas que tiene que mostrar el formulario público: las prendidas
    del formulario activo, en orden y sin las claves del editor, más los datos
    de la búsqueda. Sin formulario activo, `activo: false` (el formulario
    público muestra que la búsqueda está cerrada).

    `?preview=<id>` devuelve ese formulario con sus preguntas aunque esté
    inactivo, para que el editor lo pruebe antes de activarlo: `preview: true`
    y `activo` dice si de verdad es el activo. Las preguntas no son secretas: el
    formulario activo las muestra a cualquiera."""
    hiring_forms.asegurar_semilla()
    config = HiringConfig.vigente()
    config_publica = {
        clave: valor for clave, valor in config.to_dict().items()
        if clave in ('puesto', 'cierre', 'tasa_brl', 'presupuesto_min', 'presupuesto_max')
    }

    preview = request.args.get('preview')
    if preview:
        form = _form_pedido(preview)
        if form is None:
            return jsonify({"message": "No existe ese formulario"}), 404
    else:
        form = hiring_forms.form_activo()
        if form is None:
            return jsonify({"activo": False, "config": config_publica}), 200

    data = {
        "activo": bool(form.activo),
        "id": form.id,
        "nombre": form.nombre,
        "preguntas": hiring_forms.preguntas_publicas(form),
        "config": config_publica,
    }
    if preview:
        data["preview"] = True
    return jsonify(data), 200


@bp.route('/public/assistant-applications', methods=['POST'])
def crear_assistant_application():
    """Alta/actualización de una postulación a Asistente.

    Guardado progresivo: el formulario llama esto en CADA pregunta respondida
    (no solo al final), así que la mayoría de los POST llegan a medio
    completar. Solo el nombre es obligatorio — es la segunda pregunta, así que
    ya está contestado en el primer autosave con datos.

    `form_id` (opcional): con qué formulario editable contestó. Las respuestas
    a preguntas de ese formulario que no tienen columna van a
    `respuestas_extra`.

    `completo` lo manda el formulario al llegar a la pantalla final;
    `descartado` + `motivo_descarte` los manda cuando una respuesta excluyente
    (`ko`) corta la postulación, para poder ver por qué se cayó del embudo.
    """
    data = request.get_json(silent=True) or {}

    nombre = _texto(data.get('nombre'), 120)
    if not nombre:
        return jsonify({"status": "error", "message": "El nombre es obligatorio"}), 400

    clave = _texto(data.get('dedupe_key'), 64)

    try:
        app_row = None
        if clave:
            app_row = AssistantApplication.query.filter(
                AssistantApplication.dedupe_key == clave
            ).first()

        if app_row is None:
            app_row = AssistantApplication(dedupe_key=clave, nombre=nombre)
            db.session.add(app_row)

        app_row.nombre = nombre

        # Con qué formulario contestó: se fija una sola vez (el primer POST que
        # lo trae). Para las respuestas extra vale el de la postulación y, si
        # no tiene, el activo.
        form = _form_pedido(data.get('form_id'))
        if app_row.form_id is None and form is not None:
            app_row.form_id = form.id
        if app_row.form_id is not None:
            form = db.session.get(HiringForm, app_row.form_id)
        else:
            form = hiring_forms.form_activo()
        _guardar_extras(app_row, form, data)

        for campo, largo in CAMPOS.items():
            valor = _texto(data.get(campo), largo)
            if campo == 'pais':
                # Sin la bandera de la opción («🇦🇷  Argentina» -> «Argentina»).
                valor = pais_limpio(valor)
            _set_si_presente(app_row, campo, valor)
        for campo_form, columna in ALIAS.items():
            _set_si_presente(app_row, columna, _texto(data.get(campo_form), CAMPOS[columna]))

        # Solo se prenden, nunca se apagan: un request viejo (completo=False)
        # no debe borrar una postulación que otro más nuevo ya marcó terminada,
        # ni deshacer un descarte ya registrado.
        app_row.completo = app_row.completo or bool(data.get('completo'))
        if data.get('descartado'):
            app_row.descartado = True
        _set_si_presente(app_row, 'motivo_descarte', _texto(data.get('motivo_descarte'), MAX_LARGO))

        db.session.commit()

        logging.info("[assistant-application] %s · %s", app_row.nombre, app_row.pais)

        return jsonify({"status": "success", "id": app_row.id}), 201

    except Exception as e:
        db.session.rollback()
        logging.error("[assistant-application] Error al guardar: %s", e)
        return jsonify({"status": "error", "message": "Internal server error"}), 500
