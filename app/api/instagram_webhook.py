"""/api/webhooks/instagram: el webhook de la app propia de Meta para Instagram.

Por ahora SOLO escucha: verifica la suscripción, comprueba la firma y guarda cada evento en
`instagram_webhook_eventos`. No responde mensajes ni toca leads; ManyChat y Kommo siguen
atendiendo la cuenta. Ver docs de Meta: Instagram Platform > Webhooks.

Variables de entorno (sin ellas la ruta queda CERRADA, nunca abierta):
  · IG_WEBHOOK_VERIFY_TOKEN: el «token de verificación» que se carga en el panel de Meta.
  · IG_APP_SECRET: la «clave secreta de la app de Instagram» con la que Meta firma cada POST.
    META_APP_SECRET (la de la app de Meta) se acepta además, por si Meta firma con esa.
"""
import hashlib
import hmac
import os

from flask import Blueprint, current_app, jsonify, request
from flask_login import login_required

from app import db
from app.decorators import LARGO_MINIMO_DE_SECRETO, _iguales_en_tiempo_constante, admin_required
from app.models.instagram import InstagramWebhookEvento

bp = Blueprint('instagram_webhook', __name__)

PREFIJO_DE_FIRMA = 'sha256='


def _secreto(nombre):
    """El valor de la variable, o None si falta o es demasiado corto para ser un secreto."""
    valor = (os.environ.get(nombre) or '').strip()
    return valor if len(valor) >= LARGO_MINIMO_DE_SECRETO else None


def _firma_valida(cuerpo, cabecera):
    """X-Hub-Signature-256 = 'sha256=' + HMAC-SHA256 del cuerpo crudo con la clave secreta."""
    if not cabecera or not cabecera.startswith(PREFIJO_DE_FIRMA):
        return False
    provista = cabecera[len(PREFIJO_DE_FIRMA):].strip()
    for nombre in ('IG_APP_SECRET', 'META_APP_SECRET'):
        secreto = _secreto(nombre)
        if secreto:
            esperada = hmac.new(secreto.encode('utf-8'), cuerpo, hashlib.sha256).hexdigest()
            if _iguales_en_tiempo_constante(provista, esperada):
                return True
    return False


def _tipos(payload):
    """'messages', 'comments', 'messages,echo'... sin repetir y en orden de aparición."""
    tipos = []
    for entry in payload.get('entry') or []:
        for evento in entry.get('messaging') or []:
            if (evento.get('message') or {}).get('is_echo'):
                tipos.append('echo')
            elif 'message' in evento:
                tipos.append('messages')
            elif 'postback' in evento:
                tipos.append('postback')
            elif 'read' in evento:
                tipos.append('read')
            elif 'reaction' in evento:
                tipos.append('reaction')
            else:
                tipos.append('messaging')
        for cambio in entry.get('changes') or []:
            tipos.append(cambio.get('field') or 'changes')
    return ','.join(dict.fromkeys(tipos))[:200]


@bp.route('', methods=['GET'])
def verificar_suscripcion():
    """Meta llama con hub.mode=subscribe, hub.verify_token y hub.challenge al «Verificar y guardar»."""
    esperado = _secreto('IG_WEBHOOK_VERIFY_TOKEN')
    if not esperado:
        return jsonify({'error': 'Integración no configurada (falta IG_WEBHOOK_VERIFY_TOKEN)'}), 503

    provisto = request.args.get('hub.verify_token') or ''
    if request.args.get('hub.mode') != 'subscribe' or not _iguales_en_tiempo_constante(provisto, esperado):
        return jsonify({'error': 'Verificación rechazada'}), 403

    return request.args.get('hub.challenge') or '', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bp.route('', methods=['POST'])
def recibir_evento():
    if not (_secreto('IG_APP_SECRET') or _secreto('META_APP_SECRET')):
        return jsonify({'error': 'Integración no configurada (falta IG_APP_SECRET)'}), 503

    cuerpo = request.get_data(cache=True)
    if not _firma_valida(cuerpo, request.headers.get('X-Hub-Signature-256')):
        current_app.logger.warning('[IG WEBHOOK] Firma inválida: evento descartado')
        return jsonify({'error': 'Firma inválida'}), 401

    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return jsonify({'error': 'El cuerpo debe ser un objeto JSON'}), 400

    evento = InstagramWebhookEvento(tipos=_tipos(payload), payload=payload)
    db.session.add(evento)
    db.session.commit()
    current_app.logger.info('[IG WEBHOOK] Evento %s guardado (%s)', evento.id, evento.tipos or 'sin tipo')
    # Meta solo necesita un 200 rápido; si no lo recibe reintenta y termina desactivando el webhook.
    return 'EVENT_RECEIVED', 200, {'Content-Type': 'text/plain; charset=utf-8'}


@bp.route('/eventos', methods=['GET'])
@login_required
@admin_required
def listar_eventos():
    """Los últimos eventos recibidos (para la prueba de qué entrega Meta). ?limite=1..200, por defecto 20."""
    limite = min(max(request.args.get('limite', 20, type=int) or 20, 1), 200)
    eventos = (InstagramWebhookEvento.query
               .order_by(InstagramWebhookEvento.id.desc())
               .limit(limite).all())
    return jsonify({'eventos': [e.to_dict() for e in eventos]})
