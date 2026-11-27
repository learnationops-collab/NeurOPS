"""/api/webhooks/whatsapp: el webhook de la app propia de Meta para WhatsApp Cloud API.

Verifica la suscripción, comprueba la firma y guarda cada evento en `whatsapp_webhook_eventos`.
El procesamiento (respuestas al inbox de setters, estados de la difusión) se hace aparte.

Variables de entorno (sin ellas la ruta queda CERRADA, nunca abierta):
  · WA_WEBHOOK_VERIFY_TOKEN: el «token de verificación» que se carga en el panel de Meta.
  · WA_APP_SECRET: la «clave secreta» de la app «Learnation Contacts», con la que Meta firma cada POST.
"""
import hashlib
import hmac
import os

from flask import Blueprint, current_app, jsonify, request
from flask_login import login_required

from app import db
from app.decorators import LARGO_MINIMO_DE_SECRETO, _iguales_en_tiempo_constante, admin_required
from app.models.whatsapp import WhatsappWebhookEvento
from app.automatizaciones import servicio as motor
from app.whatsapp import entrantes

bp = Blueprint('whatsapp_webhook', __name__)

PREFIJO_DE_FIRMA = 'sha256='


def _secreto(nombre):
    valor = (os.environ.get(nombre) or '').strip()
    return valor if len(valor) >= LARGO_MINIMO_DE_SECRETO else None


def _firma_valida(cuerpo, cabecera, secreto):
    if not cabecera or not cabecera.startswith(PREFIJO_DE_FIRMA):
        return False
    esperada = hmac.new(secreto.encode('utf-8'), cuerpo, hashlib.sha256).hexdigest()
    return _iguales_en_tiempo_constante(cabecera[len(PREFIJO_DE_FIRMA):].strip(), esperada)


def _tipos(payload):
    """'messages', 'statuses', 'errors'... sin repetir y en orden de aparición."""
    tipos = []
    for entry in payload.get('entry') or []:
        for cambio in entry.get('changes') or []:
            valor = cambio.get('value') or {}
            encontrados = [k for k in ('messages', 'statuses', 'errors') if valor.get(k)]
            tipos.extend(encontrados or [cambio.get('field') or 'changes'])
    return ','.join(dict.fromkeys(tipos))[:200]


@bp.route('', methods=['GET'])
def verificar_suscripcion():
    """Meta llama con hub.mode=subscribe, hub.verify_token y hub.challenge al «Verificar y guardar»."""
    esperado = _secreto('WA_WEBHOOK_VERIFY_TOKEN')
    if not esperado:
        return jsonify({'error': 'Integración no configurada (falta WA_WEBHOOK_VERIFY_TOKEN)'}), 503

    provisto = request.args.get('hub.verify_token') or ''
    if request.args.get('hub.mode') != 'subscribe' or not _iguales_en_tiempo_constante(provisto, esperado):
        return jsonify({'error': 'Verificación rechazada'}), 403

    return request.args.get('hub.challenge') or '', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bp.route('', methods=['POST'])
def recibir_evento():
    secreto = _secreto('WA_APP_SECRET')
    if not secreto:
        return jsonify({'error': 'Integración no configurada (falta WA_APP_SECRET)'}), 503

    cuerpo = request.get_data(cache=True)
    if not _firma_valida(cuerpo, request.headers.get('X-Hub-Signature-256'), secreto):
        current_app.logger.warning('[WA WEBHOOK] Firma inválida: evento descartado')
        return jsonify({'error': 'Firma inválida'}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'El cuerpo debe ser un objeto JSON'}), 400

    evento = WhatsappWebhookEvento(tipos=_tipos(payload), payload=payload)
    db.session.add(evento)
    db.session.commit()
    current_app.logger.info('[WA WEBHOOK] Evento %s guardado (%s)', evento.id, evento.tipos or 'sin tipo')
    if motor.modo() != motor.APAGADO:
        # Lo procesa el reloj del motor, con su candado: un botón puede avanzar un flujo.
        motor.avisar(current_app._get_current_object())
    else:
        try:
            entrantes.procesar(evento)
        except Exception:  # el evento ya está guardado: se reprocesa después
            db.session.rollback()
            current_app.logger.exception('[WA WEBHOOK] No se pudo procesar el evento %s', evento.id)
    # Meta solo necesita un 200 rápido; si no lo recibe reintenta y termina desactivando el webhook.
    return 'EVENT_RECEIVED', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bp.route('/l/<token>', methods=['GET'])
def abrir_link(token):
    """El botón con link de una respuesta que manda otro mensaje al abrirse (ADR-W261): anota y redirige."""
    from flask import redirect
    from app.whatsapp import links
    try:
        destino = links.abrir(token)
    except Exception as error:  # el lead tiene que llegar al recurso aunque falle el registro
        db.session.rollback()
        current_app.logger.error(f'[WHATSAPP] Link de respuesta: {error}')
        destino = None
    if not destino:
        return 'Este link ya no está disponible.', 404
    return redirect(destino, code=302)


@bp.route('/eventos', methods=['GET'])
@login_required
@admin_required
def listar_eventos():
    """Los últimos eventos recibidos. ?limite=1..200, por defecto 20."""
    limite = min(max(request.args.get('limite', 20, type=int) or 20, 1), 200)
    eventos = WhatsappWebhookEvento.query.order_by(WhatsappWebhookEvento.id.desc()).limit(limite).all()
    return jsonify({'eventos': [e.to_dict() for e in eventos]})
