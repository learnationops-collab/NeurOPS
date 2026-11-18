"""El perfil de Instagram del lead: usuario, nombre y si sigue a la cuenta (un DM no los trae).

Como el `lead_ig` y el `follower` de ManyChat: con el usuario los tableros cruzan a la persona con sus agendas y
ventas, y la bandeja lo muestra; «Seguidor» se ve en Entrantes.
  · `completar`: en cada entrada a un flujo por campaña (seguir a la cuenta cambia) o sin usuario todavía.
  · `si_falta`: con el primer mensaje del lead que no tiene usuario, aunque no active ningún flujo (antes quedaba
    «Sin usuario» en la bandeja). Si Instagram no lo da, se reintenta a las 24 h, no en cada mensaje.
"""
from datetime import datetime, timedelta

from app.automatizaciones.registro import SIGUE

REINTENTO = timedelta(hours=24)


def _guardar(contacto, nuevas):
    contacto.variables = {**(contacto.variables or {}), **nuevas}


def completar(transporte, contacto):
    datos = transporte.perfil(contacto.igsid)
    if datos.get('username'):
        contacto.username = datos['username'][:100]
    if datos.get('name') and not contacto.nombre:
        contacto.nombre = datos['name'][:150]
    if 'is_user_follow_business' in datos:
        _guardar(contacto, {SIGUE: bool(datos['is_user_follow_business'])})


def si_falta(transporte, contacto, ahora):
    if contacto.username:
        return
    intento = (contacto.variables or {}).get('_perfil_en')
    if intento and ahora - datetime.fromisoformat(intento) < REINTENTO:
        return
    _guardar(contacto, {'_perfil_en': ahora.isoformat()})
    completar(transporte, contacto)
