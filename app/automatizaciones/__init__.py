"""Automatizaciones de Instagram: el motor de flujos propio que va a reemplazar a ManyChat.

Lee los eventos que guarda el webhook (`instagram_webhook_eventos`), lleva a cada contacto por el
grafo del flujo que lo atrapó y manda las respuestas por un transporte intercambiable. Mientras
IG_MOTOR_MODO no diga otra cosa queda APAGADO: no procesa nada ni manda nada.

  · nucleo/: lógica pura (validar el grafo, armar los mensajes de Meta, leer los eventos).
  · motor.py: avanza las ejecuciones (DB + transporte).
  · servicio.py: lo que llaman el cron y la API (procesar pendientes, despertar esperas, publicar).
"""


def registrar(app):
    """Las tablas y la API del área Inbox (/api/inbox, con sesión y CSRF como el resto)."""
    from app.automatizaciones import modelos  # noqa: F401  (que alembic y create_all vean las tablas)
    from app.automatizaciones.api import bp
    from app.automatizaciones import api_campanas  # noqa: F401  (sus rutas se cuelgan de `bp`)
    from app.automatizaciones import api_acciones  # noqa: F401
    from app.automatizaciones import api_etiquetas  # noqa: F401

    app.register_blueprint(bp, url_prefix='/api/inbox')
