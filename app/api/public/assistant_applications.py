"""Alta pública de postulaciones al puesto de Asistente Administrativa y
Personal, desde el formulario de institute.thelearnation.com/vacante-assistant.

Mismo patrón que job_applications.py:
  · va en el blueprint `public_api`, exento de CSRF (ver app/__init__.py);
  · institute.thelearnation.com ya está en la lista blanca de CORS;
  · upsert por dedupe_key: el formulario postea en CADA pregunta respondida,
    así que sin esto cada respuesta generaría una fila nueva.
"""
import logging

from flask import request, jsonify

from app import db
from app.models import AssistantApplication
from app.api.public import bp

MAX_CORTO = 300
MAX_LARGO = 4000

# {campo del formulario: largo máximo}. El orden es el de las 41 preguntas
# (ver app/models/assistant_application.py). Los largos son los mismos que
# declaran las columnas — recortar acá evita que una respuesta pegada de más
# haga fallar el INSERT entero en Postgres.
CAMPOS = {
    # Bloque 1 · Identificación ('nombre' se trata aparte: es obligatorio)
    'pais': 60, 'email': 160, 'whatsapp': 40, 'edad': 40,
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
    'sheets': 120, 'ia_nivel': 120, 'ia_avanzado': 300,
    'ia_construido': MAX_LARGO, 'ia_uso': MAX_LARGO,
    'meta': 200, 'meta_presupuesto': MAX_LARGO,
    'notion': 200, 'wa_tools': 200, 'automatizaciones': 200,
    'automatizacion_ejemplo': MAX_LARGO, 'diseno': 300, 'diseno_link': 500,
    # Bloque 7 · Organización
    'pendientes': 200, 'instrucciones': MAX_LARGO,
    # Bloque 8 · Cómo resolvés
    'retraso': MAX_LARGO, 'monitor': 300, 'martes': MAX_LARGO,
    # Bloque 9 · Video y CV
    'video': 500, 'video_verificado': 60, 'cv': 500,
}


def _texto(valor, largo=MAX_CORTO):
    if valor is None:
        return None
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


@bp.route('/public/assistant-applications', methods=['POST'])
def crear_assistant_application():
    """Alta/actualización de una postulación a Asistente.

    Guardado progresivo: el formulario llama esto en CADA pregunta respondida
    (no solo al final), así que la mayoría de los POST llegan a medio
    completar. Solo el nombre es obligatorio — es la segunda pregunta, así que
    ya está contestado en el primer autosave con datos.

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
        for campo, largo in CAMPOS.items():
            _set_si_presente(app_row, campo, _texto(data.get(campo), largo))

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
