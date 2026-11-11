"""Prueba A/B de un mensaje del flujo (07/11/2026).

Un nodo «mensaje» puede tener `variantes` [{id, contenido}]: textos alternativos al suyo. El contenido
propio del nodo es la variante «A». Los botones, la espera y las salidas son de todas: solo cambia lo
que se lee, así la comparación mide el texto y el resto del flujo sigue igual.

El sorteo se hace al mandar el mensaje, cuando el reparto ya eligió setter (no lo toca), y se equilibra
dentro de cada setter: le toca la variante que ese setter lleva menos veces en esta versión del flujo
(empate: al azar). Así cada setter recibe parejo de todas y la diferencia entre setters no se confunde
con la diferencia entre textos. Dentro de una misma ejecución, el nodo repite la variante que ya mandó.
"""
import random

from app import db
from app.automatizaciones.modelos import AutEjecucion, IgMensaje

PRIMERA = 'A'


def ids(nodo):
    """Las variantes del nodo, la propia primero; vacío si no está en prueba."""
    extra = [v.get('id') for v in nodo.get('variantes') or []]
    return [PRIMERA, *extra] if extra else []


def aplicar(nodo, variante):
    """El nodo con el contenido de esa variante (el mismo nodo si es la «A» o no tiene variantes)."""
    elegida = next((v for v in nodo.get('variantes') or [] if v.get('id') == variante), None)
    return {**nodo, 'contenido': elegida['contenido']} if elegida else nodo


def elegir(ejecucion, nodo):
    """La variante que le toca a esta ejecución en ese nodo, o None si el nodo no está en prueba."""
    opciones = ids(nodo)
    if not opciones:
        return None
    ya = (db.session.query(IgMensaje.variante)
          .filter(IgMensaje.ejecucion_id == ejecucion.id, IgMensaje.nodo_id == nodo['id'],
                  IgMensaje.variante.isnot(None)).first())
    if ya and ya[0] in opciones:
        return ya[0]
    del_setter = (AutEjecucion.setter_id == ejecucion.setter_id if ejecucion.setter_id
                  else AutEjecucion.setter_id.is_(None))
    filas = (db.session.query(IgMensaje.variante, db.func.count(db.distinct(IgMensaje.ejecucion_id)))
             .join(AutEjecucion, AutEjecucion.id == IgMensaje.ejecucion_id)
             .filter(AutEjecucion.version_id == ejecucion.version_id, IgMensaje.nodo_id == nodo['id'],
                     IgMensaje.variante.in_(opciones), del_setter)
             .group_by(IgMensaje.variante).all())
    carga = dict(filas)
    menor = min(carga.get(v, 0) for v in opciones)
    return random.choice([v for v in opciones if carga.get(v, 0) == menor])
