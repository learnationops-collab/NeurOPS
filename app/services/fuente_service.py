"""Clasificacion de la fuente de una agenda / cliente.

Existe porque habia dos embudos distintos cayendo en la misma bolsa:

  · WORKSHOP EN VIVO  -> la clase en vivo (fuente 'workshop')
  · WORKSHOP LANDING  -> la grabacion en /replay/ (fuente 'workshop landing')

La deteccion original era `'workshop' in fuente`, un substring, asi que
'workshop landing' tambien matcheaba y las agendas de la grabacion se sumaban
dentro de las metricas del workshop en vivo.

No dependemos del texto exacto a proposito: la fuente la escribe n8n / el
formulario y ya conviven variantes ('workshop manychat', mayusculas, guiones,
y hasta 'worshop_landing' sin la k). Normalizamos y decidimos por palabras, no
por igualdad.
"""
import re
import unicodedata

FUENTE_WORKSHOP_VIVO = 'workshop'
FUENTE_WORKSHOP_LANDING = 'workshop_landing'
FUENTE_VSL = 'vsl'
FUENTE_SETTING = 'setting'
FUENTE_DESCONOCIDA = 'Desconocido'

# Setters activos: sus agendas se atribuyen a la persona, no a un embudo.
SETTERS = ['Elias', 'Paula', 'Ivan']

# Catalogo oficial de fuentes (20/08/2026). Es lo que ofrece el selector del
# tablero y el panel de edicion masiva; en la base pueden convivir valores
# historicos ('Sin asignar', 'workshop manychat', ...) que se siguen mostrando
# como estan pero ya no se proponen para valores nuevos.
FUENTES_CANONICAS = [
    FUENTE_WORKSHOP_VIVO, FUENTE_WORKSHOP_LANDING, FUENTE_VSL,
    FUENTE_SETTING, FUENTE_DESCONOCIDA,
] + SETTERS

# Fuentes que significan "no sabemos que setter trajo esta agenda".
#
# El enrutamiento de Calendly manda 'setting' cuando el lead vino por el link de
# un setter, pero el evento es el mismo para los tres, asi que el nombre solo
# esta en el formulario. Si el formulario no llego, o llego con 'No identificado',
# la agenda queda sin dueño y hay que preguntarle al equipo de setting de quien
# es (ver `app/api/setter_agendas.py`).
FUENTES_SIN_DUENO = {
    'setting', 'desconocido', 'no identificado', 'sin asignar', 'sin identificar', '',
}


def es_sin_dueno(texto):
    """True si la fuente no identifica a nadie y hay que preguntarle a los setters."""
    return normalizar(texto) in FUENTES_SIN_DUENO


def es_vsl(*textos):
    """True si la fuente es el embudo de la VSL."""
    return any(normalizar(t) == FUENTE_VSL for t in textos)


# Como se escribe cada fuente del formulario de Calendly en la agenda. El
# formulario y el webhook usan vocabularios distintos ('Workshop' vs 'workshop',
# 'workshop landing' vs 'workshop_landing'), asi que se normaliza a uno solo.
def fuente_canonica(texto):
    """Valor canonico de una fuente escrita de cualquier forma, o None.

    Devuelve None para lo que no identifica nada ('No identificado', vacio), que
    es justamente lo que dispara el flujo de reclamo por parte de los setters.
    """
    t = normalizar(texto)
    if not t or t in FUENTES_SIN_DUENO:
        return None
    if es_workshop_landing(texto):
        return FUENTE_WORKSHOP_LANDING
    if es_workshop_vivo(texto):
        return FUENTE_WORKSHOP_VIVO
    if t == FUENTE_VSL:
        return FUENTE_VSL
    return None


def normalizar(texto):
    """Minusculas, sin acentos y con cualquier separador como espacio simple."""
    if not texto:
        return ''
    t = unicodedata.normalize('NFKD', str(texto))
    t = ''.join(c for c in t if not unicodedata.combining(c))
    t = t.lower()
    t = re.sub(r'[_\-./|]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


# Como llega escrita la palabra 'workshop' en la practica. La ultima ('worshop')
# entro por el webhook de agendas el 05/09/2026 y sin esto caia en 'otro'.
VARIANTES_WORKSHOP = ('workshop', 'worshop', 'workshp', 'wokshop')


def menciona_workshop(texto_normalizado):
    """True si el texto (ya normalizado) nombra al workshop, con o sin typo."""
    return any(v in texto_normalizado for v in VARIANTES_WORKSHOP)


def es_workshop_landing(*textos):
    """True si la fuente es la grabacion.

    Pide las dos palabras, en cualquier orden y con cualquier separador, para
    cubrir 'workshop landing', 'workshop-landing', 'Landing Workshop', etc.
    """
    for texto in textos:
        t = normalizar(texto)
        if not t:
            continue
        if menciona_workshop(t) and ('landing' in t or 'replay' in t or 'grabacion' in t):
            return True
    return False


def es_workshop_vivo(*textos):
    """True si la fuente es el workshop en vivo, EXCLUYENDO la grabacion."""
    if es_workshop_landing(*textos):
        return False
    for texto in textos:
        if menciona_workshop(normalizar(texto)):
            return True
    return False


def clasificar(*textos):
    """Devuelve 'workshop_landing', 'workshop' u 'otro'."""
    if es_workshop_landing(*textos):
        return FUENTE_WORKSHOP_LANDING
    if es_workshop_vivo(*textos):
        return FUENTE_WORKSHOP_VIVO
    return 'otro'
