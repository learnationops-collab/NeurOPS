"""/api/webhooks/whatsapp: el webhook de la app propia de Meta para WhatsApp (portfolio Learnation).

Verifica la suscripción, comprueba la firma y guarda cada notificación en `whatsapp_webhook_eventos`.
Todavía no procesa nada: primero se mira qué entrega Meta (mismo camino que el de Instagram).

Variables de entorno (sin ellas la ruta queda CERRADA, nunca abierta):
  · WHATSAPP_WEBHOOK_VERIFY_TOKEN: el «token de verificación» que se carga en el panel de Meta.
  · WHATSAPP_APP_SECRET: la clave secreta de la app, con la que Meta firma cada POST.
"""
import hashlib
import hmac
import os

from flask import Blueprint, current_app, jsonify, request
from flask_login import login_required

from app import db
from app.decorators import LARGO_MINIMO_DE_SECRETO, _iguales_en_tiempo_constante, admin_required
from app.models.whatsapp import WhatsappWebhookEvento

bp = Blueprint('whatsapp_webhook', __name__)

PREFIJO_DE_FIRMA = 'sha256='


def _secreto(nombre):
    valor = (os.environ.get(nombre) or '').strip()
    return valor if len(valor) >= LARGO_MINIMO_DE_SECRETO else None


def _firma_valida(cuerpo, cabecera):
    secreto = _secreto('WHATSAPP_APP_SECRET')
    if not secreto or not cabecera or not cabecera.startswith(PREFIJO_DE_FIRMA):
        return False
    esperada = hmac.new(secreto.encode('utf-8'), cuerpo, hashlib.sha256).hexdigest()
    return _iguales_en_tiempo_constante(cabecera[len(PREFIJO_DE_FIRMA):].strip(), esperada)


def _tipos(payload):
    """'messages', 'statuses', 'history'... sin repetir y en orden de aparición."""
    tipos = []
    for entry in payload.get('entry') or []:
        for cambio in entry.get('changes') or []:
            campo = cambio.get('field') or 'changes'
            valor = cambio.get('value') or {}
            if campo == 'messages':
                tipos += [k for k in ('messages', 'statuses', 'errors') if valor.get(k)] or ['messages']
            else:
                tipos.append(campo)
    return ','.join(dict.fromkeys(tipos))[:200]


@bp.route('', methods=['GET'])
def verificar_suscripcion():
    esperado = _secreto('WHATSAPP_WEBHOOK_VERIFY_TOKEN')
    if not esperado:
        return jsonify({'error': 'Integración no configurada (falta WHATSAPP_WEBHOOK_VERIFY_TOKEN)'}), 503

    provisto = request.args.get('hub.verify_token') or ''
    if request.args.get('hub.mode') != 'subscribe' or not _iguales_en_tiempo_constante(provisto, esperado):
        return jsonify({'error': 'Verificación rechazada'}), 403

    return request.args.get('hub.challenge') or '', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bp.route('', methods=['POST'])
def recibir_evento():
    if not _secreto('WHATSAPP_APP_SECRET'):
        return jsonify({'error': 'Integración no configurada (falta WHATSAPP_APP_SECRET)'}), 503

    cuerpo = request.get_data(cache=True)
    if not _firma_valida(cuerpo, request.headers.get('X-Hub-Signature-256')):
        current_app.logger.warning('[WA WEBHOOK] Firma inválida: evento descartado')
        return jsonify({'error': 'Firma inválida'}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'El cuerpo debe ser un objeto JSON'}), 400

    evento = WhatsappWebhookEvento(tipos=_tipos(payload), payload=payload)
    db.session.add(evento)
    db.session.commit()
    current_app.logger.info('[WA WEBHOOK] Evento %s guardado (%s)', evento.id, evento.tipos or 'sin tipo')
    # Meta solo necesita un 200 rápido; si no lo recibe reintenta y termina desactivando el webhook.
    return 'EVENT_RECEIVED', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bp.route('/eventos', methods=['GET'])
@login_required
@admin_required
def listar_eventos():
    """Los últimos eventos recibidos. ?limite=1..200, por defecto 20."""
    limite = min(max(request.args.get('limite', 20, type=int) or 20, 1), 200)
    eventos = WhatsappWebhookEvento.query.order_by(WhatsappWebhookEvento.id.desc()).limit(limite).all()
    return jsonify({'eventos': [e.to_dict() for e in eventos]})
