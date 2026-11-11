"""El envío a Discord, uno solo para todos los avisos: un webhook o el bot del equipo, según el canal.

Canales (variables de entorno):
  · agendas: DISCORD_AGENDAS_WEBHOOK.
  · no_califica / abandonos: DISCORD_NO_CALIFICA_WEBHOOK / DISCORD_ABANDONOS_WEBHOOK (sin ellas, el de agendas).
  · onboarding (#onboardings de fulfillment) y wins (#wins): el bot (DISCORD_BOT_TOKEN; el canal, BOT) o, sin
    bot, DISCORD_ONBOARDING_WEBHOOK / DISCORD_WINS_WEBHOOK.
  · reportes: DISCORD_REPORTS_WEBHOOK.
  · reportes_ventas (#📋-reportes de adquisitions, el resultado de cada llamada): solo el bot.

El mensaje va con la imagen adjunta; si la imagen no se pudo armar, con el embed de texto. Discord o Chromium
nunca frenan lo que dispara el aviso: los errores quedan en el log.
"""
import json
import os
import threading

import requests
from flask import current_app

API = 'https://discord.com/api/v10'
WEBHOOKS = {
    'agendas': ('DISCORD_AGENDAS_WEBHOOK',),
    'no_califica': ('DISCORD_NO_CALIFICA_WEBHOOK', 'DISCORD_AGENDAS_WEBHOOK'),
    'abandonos': ('DISCORD_ABANDONOS_WEBHOOK', 'DISCORD_AGENDAS_WEBHOOK'),
    'onboarding': ('DISCORD_ONBOARDING_WEBHOOK',),
    'wins': ('DISCORD_WINS_WEBHOOK',),
    'reportes': ('DISCORD_REPORTS_WEBHOOK',),
}
# Los canales que publica el bot (si hay token): {canal: (variable con el ID del canal, ID por defecto)}.
# Los IDs no son secretos: el del servidor Learnation Team.
BOT = {
    'onboarding': ('DISCORD_ONBOARDINGS_CHANNEL_ID', '1318622160951971922'),  # #🙌-onboardings (fulfillment)
    'wins': ('DISCORD_WINS_CHANNEL_ID', '1232723653032935464'),  # #🏆-wins (adquisitions)
    'reportes_ventas': ('DISCORD_REPORTES_VENTAS_CHANNEL_ID', '1342945225890336910'),  # #📋-reportes (adquisitions)
}


def destino(canal):
    """('bot', id_de_canal) | ('webhook', url) | None si el canal no está configurado."""
    token = os.environ.get('DISCORD_BOT_TOKEN')
    if canal in BOT and token:
        variable, por_defecto = BOT[canal]
        return 'bot', os.environ.get(variable) or por_defecto
    for variable in WEBHOOKS.get(canal, ()):
        if os.environ.get(variable):
            return 'webhook', os.environ[variable]
    return None


def configurado(canal):
    return destino(canal) is not None


def _post(lugar, cuerpo, imagen, archivo):
    tipo, valor = lugar
    url = f'{API}/channels/{valor}/messages' if tipo == 'bot' else valor
    headers = {'Authorization': f"Bot {os.environ['DISCORD_BOT_TOKEN']}"} if tipo == 'bot' else {}
    if imagen is None:
        return requests.post(url, json=cuerpo, headers=headers, timeout=10)
    return requests.post(url, headers=headers, timeout=20, data={'payload_json': json.dumps(cuerpo)},
                         files={'files[0]': (archivo, imagen, 'image/png')})


def enviar(canal, cuerpo, armar_imagen=None, embed=None, color=None, archivo='aviso.png', etiqueta='DISCORD'):
    """Manda `cuerpo` ({content, allowed_mentions}) al canal con la imagen de `armar_imagen()` o, si falla,
    con el `embed` de texto. True si Discord lo aceptó. Nunca lanza."""
    lugar = destino(canal)
    if not lugar:
        current_app.logger.warning(f'[{etiqueta}] Canal «{canal}» sin configurar: no se avisa a Discord.')
        return False
    imagen = None
    if armar_imagen:
        try:
            imagen = armar_imagen()
        except Exception as e:  # noqa: BLE001  (sin imagen el aviso sale igual)
            current_app.logger.error(f'[{etiqueta}] Sin imagen para Discord: {e}')
    cuerpo = dict(cuerpo)
    if imagen is not None:
        cuerpo['embeds'] = [{**({'color': color} if color is not None else {}), 'image': {'url': f'attachment://{archivo}'}}]
    elif embed:
        cuerpo['embeds'] = [embed]
    try:
        r = _post(lugar, cuerpo, imagen, archivo)
        if r.status_code >= 300:
            current_app.logger.error(f'[{etiqueta}] Discord respondió {r.status_code}: {r.text[:300]}')
            return False
        return True
    except Exception as e:  # noqa: BLE001  (Discord nunca frena lo que dispara el aviso)
        current_app.logger.error(f'[{etiqueta}] No se pudo avisar a Discord: {e}')
        return False


def despachar(canal, cuerpo, armar_imagen=None, **kw):
    """`enviar` en un hilo (Chromium tarda segundos). En los tests, en el momento. True si salió o se encoló.
    Lo que arma la imagen no debe tocar la base: los datos se resuelven antes."""
    if not configurado(canal):
        current_app.logger.warning(f"[{kw.get('etiqueta', 'DISCORD')}] Canal «{canal}» sin configurar: no se avisa a Discord.")
        return False
    if current_app.testing:
        return enviar(canal, cuerpo, armar_imagen, **kw)
    app = current_app._get_current_object()

    def correr():
        with app.app_context():
            enviar(canal, cuerpo, armar_imagen, **kw)

    threading.Thread(target=correr, daemon=True, name=f'discord-{canal}').start()
    return True
