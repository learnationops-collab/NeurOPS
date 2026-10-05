"""Agendas 2.0 (Learnation Thalamus): agendamiento propio que va a reemplazar a Calendly + n8n.

Paso 2 del plan: modulo aislado con tablas sched_*. No escribe en la operacion (FinancialAgenda,
Appointment) ni llama a terceros; volcar las reservas al sistema actual es el paso 3.
Contrato de la API: docs/agendas_v2_api.md. La logica pura (nucleo/) es el port 1:1 del frontend.
"""


def registrar(app, csrf):
    """Registra las dos APIs. La publica queda exenta de CSRF: la usa un visitante sin sesion."""
    from app.agendas_v2 import modelos  # noqa: F401  (que alembic y create_all vean las tablas)
    from app.agendas_v2.api_admin import bp as admin_bp
    from app.agendas_v2.api_publico import bp as publico_bp

    app.register_blueprint(publico_bp, url_prefix='/api/agendas-v2/publico')
    csrf.exempt(publico_bp)
    app.register_blueprint(admin_bp, url_prefix='/api/agendas-v2')
