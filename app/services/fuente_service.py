"""Clasificacion de la fuente de una agenda / cliente.

Existe porque habia dos embudos distintos cayendo en la misma bolsa:

  · WORKSHOP EN VIVO  -> la clase en vivo (fuente 'workshop')
  · WORKSHOP LANDING  -> la grabacion en /replay/ (fuente 'workshop landing')

La deteccion original era `'workshop' in fuente`, un substring, asi que
'workshop landing' tambien matcheaba y las agendas de la grabacion se sumaban
dentro de las metricas del workshop en vivo.

No dependemos del texto exacto a proposito: la fuente la escribe n8n / el
formulario y ya conviven variantes ('workshop manychat', mayusculas, guiones).
Normalizamos y decidimos por palabras, no por igualdad.
"""
import re
import unicodedata

FUENTE_WORKSHOP_VIVO = 'workshop'
FUENTE_WORKSHOP_LANDING = 'workshop_landing'

# Setters activos: sus agendas se atribuyen a la persona, no a un embudo.
SETTERS = ['Elias', 'Paula', 'Ivan']

# Catalogo oficial de fuentes (20/08/2026). Es lo que ofrece el selector del
# tablero y el panel de edicion masiva; en la base pueden convivir valores
# historicos ('Sin asignar', 'workshop manychat', ...) que se siguen mostrando
# como estan pero ya no se proponen para valores nuevos.
FUENTES_CANONICAS = [FUENTE_WORKSHOP_VIVO, FUENTE_WORKSHOP_LANDING] + SETTERS


def normalizar(texto):
    """Minusculas, sin acentos y con cualquier separador como espacio simple."""
    if not texto:
        return ''
    t = unicodedata.normalize('NFKD', str(texto))
    t = ''.join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = re.sub(r'[_\-./|]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def es_workshop_landing(*textos):
    """True si la fuente es la grabacion.

    Pide las dos palabras, en cualquier orden y con cualquier separador, para
    cubrir 'workshop landing', 'workshop-landing', 'Landing Workshop', etc.
    """
    for texto in textos:
        t = normalizar(texto)
        if not t:
            continue
        if 'workshop' in t and ('landing' in t or 'replay' in t or 'grabacion' in t):
            return True
    return False


def es_workshop_vivo(*textos):
    """True si la fuente es el workshop en vivo, EXCLUYENDO la grabacion."""
    if es_workshop_landing(*textos):
        return False
    for texto in textos:
        if 'workshop' in normalizar(texto):
            return True
    return False


def clasificar(*textos):
    """Devuelve 'workshop_landing', 'workshop' u 'otro'."""
    if es_workshop_landing(*textos):
        return FUENTE_WORKSHOP_LANDING
    if es_workshop_vivo(*textos):
        return FUENTE_WORKSHOP_VIVO
    return 'otro'
