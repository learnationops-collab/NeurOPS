"""Avisos a Discord que pide la Academia (Onboarding, reactivación, Momentum, upsell, tours): salen por el mismo
servicio que los de Work (app/services/discord_avisos/, ADR-W121), con la misma tarjeta.

POST /api/external/academy/discord/aviso (token ACADEMY_INBOUND_API_TOKEN)
  {canal: onboarding|reportes, emoji, titulo, nombre, telefono?, evento?, estado?, tono?,
   chips?: [{icono|marca, texto}], cajas?: [{titulo, valor, sub?, color?, icono?}], tiles?: [{icono?, titulo, sub?}],
   pie?, menciones?: [id de Discord], texto_extra?}
En el texto del mensaje va solo emoji, título, nombre y teléfono (y las menciones); el resto, en la imagen.
Responde 202: la imagen se arma en segundo plano.
"""
from flask import jsonify, request

from app.api.external import bp
from app.decorators import require_academy_token
from app.services.discord_avisos import envio
from app.services.discord_avisos.tarjeta import TONOS, Aviso, avisar, corto

CANALES = ('onboarding', 'reportes')
ICONOS = {'check', 'x', 'meta', 'billetera', 'pin', 'maletin', 'personas', 'cal', 'reloj', 'bandeja', 'antes',
          'dinero', 'nota', 'flecha'}
COLORES = {'azul', 'verde', 'rojo', 'rosa'}


def _lista(valor, maximo):
    return [x for x in valor if isinstance(x, dict)][:maximo] if isinstance(valor, list) else []


def _icono(v):
    return v if v in ICONOS else None


def _limpiar(d):
    chips = [{'icono': _icono(c.get('icono')), 'marca': corto(c.get('marca'), 4), 'texto': corto(c.get('texto'), 60)}
             for c in _lista(d.get('chips'), 6) if c.get('texto')]
    cajas = [{'titulo': corto(b.get('titulo'), 40), 'valor': corto(b.get('valor'), 80), 'sub': corto(b.get('sub'), 60),
              'color': b.get('color') if b.get('color') in COLORES else 'azul', 'icono': _icono(b.get('icono')) or 'check'}
             for b in _lista(d.get('cajas'), 6) if b.get('titulo')]
    tiles = [{'icono': _icono(t.get('icono')) or 'check', 'titulo': corto(t.get('titulo'), 80), 'sub': corto(t.get('sub'), 220)}
             for t in _lista(d.get('tiles'), 8) if t.get('titulo')]
    menciones = [str(m) for m in (d.get('menciones') or []) if str(m).isdigit()][:5]
    return Aviso(emoji=corto(d.get('emoji') or '📌', 4), titulo=corto(d.get('titulo'), 80), nombre=corto(d.get('nombre'), 80),
                 telefono=corto(d.get('telefono'), 30), evento=corto(d.get('evento'), 60), estado=corto(d.get('estado'), 30),
                 tono=d.get('tono') if d.get('tono') in TONOS else 'gris', chips=chips, cajas=cajas, tiles=tiles,
                 pie=corto(d.get('pie') or 'Academia', 80), menciones=menciones, texto_extra=corto(d.get('texto_extra'), 1500))


@bp.route('/discord/aviso', methods=['POST'])
@require_academy_token
def discord_aviso():
    d = request.get_json(silent=True) or {}
    canal = d.get('canal')
    if canal not in CANALES:
        return jsonify({'error': f'canal tiene que ser uno de {", ".join(CANALES)}'}), 400
    if not d.get('titulo') or not d.get('nombre'):
        return jsonify({'error': 'titulo y nombre son obligatorios'}), 400
    if not envio.configurado(canal):
        return jsonify({'error': 'canal_sin_configurar'}), 503
    avisar(canal, _limpiar(d), etiqueta=f'ACADEMIA {canal.upper()}')
    return jsonify({'en_curso': True}), 202
