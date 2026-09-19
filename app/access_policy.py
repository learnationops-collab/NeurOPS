"""Quien puede llamar a cada ruta de la herramienta interna que antes respondia a CUALQUIERA en internet.

Todo el blueprint `public` (y varias rutas de conversational, manychat-webhook, marketing, triage y
workshop) estaba sin autenticacion y exento de CSRF: cualquiera podia leer ventas, nomina y clientes,
crear, editar y BORRAR agendas, ventas, campanas y reportes, lanzar tareas de mantenimiento (repair-db,
cleanup-*, migrate, records/clear) e inyectar ventas y agendas falsas por la ingesta de n8n.

Aca se declara, para cada una de esas rutas, quien puede llamarla:

  - un usuario logueado con uno de los roles de la tabla (`admin` siempre entra). Los roles salen de un
    analisis del frontend: para cada pantalla de App.jsx, que endpoints llama y con que roles se llega a
    ella (ver tests/security/test_frontend_role_contract.py, que impide dejar a un rol sin una pantalla
    que ya usa); y/o
  - un sistema externo (n8n, Apps Script) con el secreto INGEST_API_TOKEN, solo en las rutas de ingesta
    y de consulta que esos sistemas usan (`ingesta=True`).

Una sola guarda (`guardia`, registrada con before_request en create_app) aplica la tabla: mirar una
regla de aca no exige leer 90 vistas y una ruta nueva sin declarar la ve el test de la superficie
anonima. Las rutas que NO estan en la tabla no se tocan (ya tienen su propio decorador o son publicas
por diseno: formularios de captacion, reservas, telemetria y callbacks de terceros).

Modo de migracion (INTEGRATIONS_AUTH_MODE=log_only): lo que se habria rechazado pasa y se registra, para
desplegar sin cortar flujos que todavia no mandan su secreto (y revertir sin un despliegue).
"""
import os
from collections import namedtuple

from flask import jsonify, request
from flask_login import current_user

from app.decorators import (
    LARGO_MINIMO_DE_SECRETO, _iguales_en_tiempo_constante, avisar_llamada_sin_credencial, en_modo_de_migracion,
)
from app.models.user import (
    ROLE_ADMIN, ROLE_CLOSER, ROLE_DIRECTOR_COMERCIAL, ROLE_DIRECTOR_MARKETING, ROLE_OPERATOR, ROLE_SETTER,
    ROLE_TRIAGE,
)

Politica = namedtuple('Politica', ['roles', 'ingesta'])


def _p(*roles, ingesta=False):
    """Politica: los roles indicados MAS admin (que entra siempre); `ingesta` admite ademas el secreto de
    los sistemas externos (n8n, Apps Script)."""
    return Politica(frozenset((ROLE_ADMIN, *roles)), ingesta)


COMERCIAL, MARKETING, CLOSER, SETTER, TRIAGE, OPERATOR = (
    ROLE_DIRECTOR_COMERCIAL, ROLE_DIRECTOR_MARKETING, ROLE_CLOSER, ROLE_SETTER, ROLE_TRIAGE, ROLE_OPERATOR)

POLITICA = {
    # --- Mensajes y estadisticas conversacionales (panel del setter y de la direccion comercial) -------
    ('GET', '/api/conversational/messages'): _p(COMERCIAL, SETTER),
    ('POST', '/api/conversational/messages'): _p(COMERCIAL, SETTER),
    ('DELETE', '/api/conversational/messages/<int:msg_id>'): _p(COMERCIAL, SETTER),
    ('PUT', '/api/conversational/messages/<int:msg_id>'): _p(COMERCIAL, SETTER),
    # Borra TODOS los registros de interaccion de todo el panel: mantenimiento global. El boton esta en el
    # gestor de mensajes del setter, pero un setter no debe poder poner las estadisticas en cero.
    ('DELETE', '/api/conversational/records/clear'): _p(COMERCIAL),
    ('GET', '/api/conversational/stats/conversational'): _p(COMERCIAL, SETTER),

    # --- ManyChat: monitor de leads entrantes, limpieza y reasignacion (marketing) ----------------------
    ('GET', '/api/manychat-webhook/ad-details/<int:ad_id>'): _p(MARKETING),
    ('PUT', '/api/manychat-webhook/answer/<int:answer_id>'): _p(COMERCIAL, MARKETING, SETTER),
    ('POST', '/api/manychat-webhook/bulk-reassign'): _p(MARKETING),
    ('POST', '/api/manychat-webhook/bulk-reassign/preview'): _p(MARKETING),
    ('POST', '/api/manychat-webhook/cleanup-cuf'): _p(MARKETING),
    ('POST', '/api/manychat-webhook/cleanup-duplicates'): _p(MARKETING),
    ('GET', '/api/manychat-webhook/log'): _p(COMERCIAL, MARKETING, SETTER),
    ('POST', '/api/manychat-webhook/migrate'): _p(MARKETING),
    ('GET', '/api/manychat-webhook/stats'): _p(MARKETING),
    ('GET', '/api/manychat-webhook/stats/dashboard'): _p(MARKETING),
    ('GET', '/api/manychat-webhook/stats/segmentation'): _p(MARKETING),
    ('POST', '/api/marketing/ads/<int:ad_id>/adjust-leads'): _p(MARKETING),

    # --- Marketing: anuncios, conjuntos, campanas y gasto por periodo -----------------------------------
    ('GET', '/api/public/ads'): _p(MARKETING, CLOSER, SETTER),
    ('POST', '/api/public/ads'): _p(MARKETING),
    ('PUT', '/api/public/ads/<int:ad_id>'): _p(MARKETING),
    ('DELETE', '/api/public/ads/<int:ad_id>'): _p(MARKETING),
    ('GET', '/api/public/ads/period-spend'): _p(MARKETING),
    ('POST', '/api/public/ads/period-spend'): _p(MARKETING),
    ('PUT', '/api/public/ads/period-spend/<int:spend_id>'): _p(MARKETING),
    ('DELETE', '/api/public/ads/period-spend/<int:spend_id>'): _p(MARKETING),
    ('POST', '/api/public/adsets'): _p(MARKETING),
    ('PUT', '/api/public/adsets/<int:adset_id>'): _p(MARKETING),
    ('DELETE', '/api/public/adsets/<int:adset_id>'): _p(MARKETING),
    ('GET', '/api/public/campaigns'): _p(MARKETING),
    ('POST', '/api/public/campaigns'): _p(MARKETING),
    ('PUT', '/api/public/campaigns/<int:campaign_id>'): _p(MARKETING),
    ('DELETE', '/api/public/campaigns/<int:campaign_id>'): _p(MARKETING),
    ('POST', '/api/public/marketing/manual-attribution'): _p(CLOSER, SETTER),
    ('POST', '/api/public/marketing/manual-attribution-agenda'): _p(CLOSER, SETTER),
    ('GET', '/api/public/marketing/unattributed-leads'): _p(CLOSER, SETTER),
    ('GET', '/api/public/reports/sales-attribution'): _p(),

    # --- Equipos: listas de closers, setters y triage; reportes diarios y estadisticas ------------------
    ('GET', '/api/public/active-closers'): _p(CLOSER, COMERCIAL, OPERATOR),
    ('GET', '/api/public/active-setters'): _p(SETTER, COMERCIAL, OPERATOR),
    ('GET', '/api/public/active-triage'): _p(TRIAGE),
    ('POST', '/api/public/closer-report'): _p(CLOSER),
    ('GET', '/api/public/closer-report/prefill'): _p(CLOSER),
    ('GET', '/api/public/closer-reports'): _p(COMERCIAL),
    ('PUT', '/api/public/closer-reports/<int:report_id>'): _p(CLOSER),
    ('DELETE', '/api/public/closer-reports/<int:report_id>'): _p(COMERCIAL),
    ('GET', '/api/public/closer-stats'): _p(COMERCIAL),
    ('GET', '/api/public/setter-questions'): _p(SETTER),
    ('POST', '/api/public/setter-report'): _p(SETTER),
    ('GET', '/api/public/setter-report/prefill'): _p(SETTER),
    ('GET', '/api/public/setter-reports'): _p(COMERCIAL, SETTER),
    ('PUT', '/api/public/setter-reports/<int:report_id>'): _p(COMERCIAL, SETTER),
    ('DELETE', '/api/public/setter-reports/<int:report_id>'): _p(COMERCIAL, SETTER),
    ('GET', '/api/public/setter-stats'): _p(COMERCIAL, SETTER),
    ('POST', '/api/public/triage-report'): _p(TRIAGE),
    ('GET', '/api/public/triage-report/prefill'): _p(TRIAGE),
    ('GET', '/api/public/triage-reports'): _p(COMERCIAL, TRIAGE),
    ('PUT', '/api/public/triage-reports/<int:report_id>'): _p(COMERCIAL, TRIAGE),
    ('DELETE', '/api/public/triage-reports/<int:report_id>'): _p(COMERCIAL, TRIAGE),
    ('GET', '/api/public/triage-stats'): _p(COMERCIAL, TRIAGE),
    ('GET', '/api/triage/tracker'): _p(COMERCIAL),
    ('POST', '/api/triage/tracker'): _p(COMERCIAL),
    ('DELETE', '/api/triage/tracker/<int:report_id>'): _p(COMERCIAL),
    ('GET', '/api/triage/tracker/stats'): _p(COMERCIAL),

    # --- Agendas (registro de llamadas). Las que reciben datos de n8n admiten su secreto ----------------
    ('GET', '/api/public/financial-agendas'): _p(COMERCIAL, OPERATOR, TRIAGE),
    ('POST', '/api/public/financial-agendas'): _p(COMERCIAL, OPERATOR, ingesta=True),
    ('POST', '/api/public/financial-agendas-form'): _p(OPERATOR, ingesta=True),
    ('PUT', '/api/public/financial-agendas/<int:agenda_id>'): _p(COMERCIAL, OPERATOR, TRIAGE),
    ('DELETE', '/api/public/financial-agendas/<int:agenda_id>'): _p(COMERCIAL, OPERATOR, TRIAGE),
    ('POST', '/api/public/financial-agendas/repair-db'): _p(),  # correccion historica: solo admin
    ('POST', '/api/public/financial-agendas/sync'): _p(OPERATOR),  # deshabilitada en favor de n8n
    ('POST', '/api/public/financial-agendas/sync-appointments'): _p(OPERATOR),
    ('POST', '/api/public/financial-agendas/verificar-hora'): _p(OPERATOR, ingesta=True),  # prueba en seco desde n8n

    # --- Ventas (pagos). El webhook de la hoja de calculo (Apps Script) admite su secreto ---------------
    ('GET', '/api/public/financial-sales'): _p(COMERCIAL, OPERATOR),
    ('POST', '/api/public/financial-sales'): _p(OPERATOR, ingesta=True),
    ('PUT', '/api/public/financial-sales/<int:sale_id>'): _p(COMERCIAL, OPERATOR),
    ('DELETE', '/api/public/financial-sales/<int:sale_id>'): _p(COMERCIAL, OPERATOR),
    ('POST', '/api/public/financial-sales/<int:sale_id>/resend-webhook'): _p(COMERCIAL, OPERATOR),
    ('POST', '/api/public/financial-sales/<int:sale_id>/toggle-payroll-exclusion'): _p(),  # nomina: solo admin
    ('POST', '/api/public/financial-sales/new'): _p(COMERCIAL, OPERATOR),
    ('GET', '/api/public/financial-sales/payroll'): _p(),  # nomina: solo admin
    ('POST', '/api/public/financial-sales/sync'): _p(COMERCIAL, OPERATOR),

    # --- Clientes y roadmap del lead. Los de consulta documentados para "otra pagina" admiten el secreto -
    ('GET', '/api/public/clients/search'): _p(CLOSER, SETTER, ingesta=True),
    ('POST', '/api/public/clients/follow-up'): _p(COMERCIAL, ingesta=True),
    ('GET', '/api/public/new-clients'): _p(COMERCIAL, ingesta=True),
    ('GET', '/api/public/lead-roadmap'): _p(CLOSER, COMERCIAL, OPERATOR, SETTER, TRIAGE),
    ('POST', '/api/public/lead-roadmap/relate-event'): _p(CLOSER, COMERCIAL, OPERATOR, SETTER, TRIAGE),
    ('POST', '/api/public/lead-roadmap/update-client'): _p(CLOSER, COMERCIAL, OPERATOR, SETTER, TRIAGE),

    # --- Workshops ------------------------------------------------------------------------------------
    ('GET', '/api/workshop/stats/summary'): _p(OPERATOR, MARKETING),
}


def _secreto_de_ingesta():
    """El secreto presentado por un sistema externo: header X-Api-Token o, si no, Authorization Bearer.
    (Un Bearer tambien puede ser el JWT de un usuario: se compara primero con el secreto y, si no coincide,
    se trata como credencial de usuario.)"""
    presentado = request.headers.get('X-Api-Token', '').strip()
    if not presentado:
        cabecera = request.headers.get('Authorization', '')
        if cabecera.startswith('Bearer '):
            presentado = cabecera[len('Bearer '):].strip()
    return presentado


def es_llamada_de_ingesta():
    """True si la peticion trae el secreto INGEST_API_TOKEN (n8n, Apps Script). Sin la variable, o con un
    valor demasiado corto para ser un secreto, nadie califica: no hay valor por defecto."""
    esperado = os.environ.get('INGEST_API_TOKEN', '')
    if len(esperado) < LARGO_MINIMO_DE_SECRETO:
        return False
    presentado = _secreto_de_ingesta()
    return bool(presentado) and _iguales_en_tiempo_constante(presentado, esperado)


def es_llamada_de_confianza():
    """Usuario logueado o sistema externo con su secreto: quien puede ver los datos completos de un cliente
    (las rutas publicas de reservas devuelven menos a un anonimo)."""
    return bool(current_user.is_authenticated) or es_llamada_de_ingesta()


def guardia():
    """before_request: aplica POLITICA a las rutas de la tabla. None deja pasar; una tupla es la respuesta."""
    regla = request.url_rule
    if regla is None:  # 404 o 405: no hay ruta que proteger
        return None
    metodo = 'GET' if request.method == 'HEAD' else request.method  # HEAD ejecuta la vista de GET
    politica = POLITICA.get((metodo, regla.rule))
    if politica is None:
        return None

    if politica.ingesta and es_llamada_de_ingesta():
        return None
    if current_user.is_authenticated:
        if current_user.role in politica.roles:
            return None
        rechazo, motivo = (jsonify({"message": "Forbidden"}), 403), f'el rol {current_user.role} no esta permitido'
    else:
        rechazo, motivo = (jsonify({"message": "Unauthorized"}), 401), 'sin sesion ni secreto de ingesta'

    if en_modo_de_migracion():
        avisar_llamada_sin_credencial(motivo)
        return None
    return rechazo
