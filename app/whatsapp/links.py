"""El link de un botón que, al abrirse, manda otro mensaje (ADR-W261), como hace ManyChat.

WhatsApp no avisa cuando alguien toca un botón con link. Si la respuesta tiene «cuando abre el link», el botón no
apunta al destino sino a `/api/webhooks/whatsapp/l/<token>`: esa ruta anota la apertura, deja el mensaje siguiente
(solo la primera vez) y redirige al destino. El token lleva el contacto y la regla firmados; el destino sale siempre
de la regla, así la ruta no redirige a cualquier lado.
"""
import os
from datetime import datetime

from flask import current_app
from itsdangerous import BadSignature, URLSafeSerializer

from app import db
from app.automatizaciones.modelos import IgContacto
from app.models.whatsapp import WaRespuestaBoton

SAL = 'wa-link-despues'


def _firma():
    return URLSafeSerializer(current_app.config['SECRET_KEY'], salt=SAL)


def url_de(contacto_id, regla_id):
    base = (os.environ.get('FRONTEND_URL') or 'https://work.thelearnation.com').rstrip('/')
    return f"{base}/api/webhooks/whatsapp/l/{_firma().dumps({'c': contacto_id, 'r': regla_id})}"


def abrir(token, ahora=None):
    """El destino del link (o None si el token no vale). La primera apertura deja el mensaje de «después»."""
    try:
        datos = _firma().loads(token)
    except BadSignature:
        return None
    contacto, regla = db.session.get(IgContacto, datos.get('c')), db.session.get(WaRespuestaBoton, datos.get('r'))
    boton = ((regla.botones or [None])[0] if regla else None) or {}
    if not (contacto and boton.get('url')):
        return None
    ahora = ahora or datetime.utcnow()
    variables = dict(contacto.variables or {})
    abiertos = dict(variables.get('links_abiertos') or {})
    if str(regla.id) not in abiertos:
        abiertos[str(regla.id)] = ahora.isoformat() + 'Z'
        variables['links_abiertos'] = abiertos
        contacto.variables = variables
        if boton.get('despues'):
            from app.whatsapp import respuestas
            respuestas.programar_despues(contacto, regla, ahora)
    db.session.commit()
    return boton['url']
