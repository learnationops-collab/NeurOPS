"""Cómo le va a cada variante de un mensaje en prueba A/B (`variantes.py`), en la versión publicada.

Por variante, de las ejecuciones que la recibieron:
  · **Respondieron**: el lead escribió o tocó un botón después de recibirla (y antes de su siguiente entrada).
  · **Siguieron**: el flujo le mandó otro mensaje después de ese (pasó al paso siguiente).
  · **Calificados**: `AutEjecucion.califica`.
  · **Agendas**: agendas en su tramo, como en las métricas de campañas.
Y el cruce setter × variante, para ver que el reparto quedó parejo.

Solo mira la versión publicada: editar el texto publica otra versión, y mezclarlas compararía textos
distintos bajo la misma letra. Cada comparación contra la «A» dice si la diferencia en «respondieron»
ya es clara (prueba de dos proporciones, 95 %) o todavía puede ser azar.
"""
import math
from collections import defaultdict

from app import db
from app.automatizaciones import variantes as v
from app.automatizaciones.metricas_campanas import _agendas, _tramos
from app.automatizaciones.modelos import AutEjecucion, IgMensaje
from app.automatizaciones.nucleo import pasos
from app.models import User

MUESTRA_MINIMA = 20
Z_95 = 1.96


def _tasa(n, total):
    return round(n / total, 3) if total else None


def _clara(a, na, b, nb):
    """¿La diferencia entre las proporciones a/na y b/nb ya no es azar (95 %)?"""
    if min(na, nb) < MUESTRA_MINIMA:
        return None
    p = (a + b) / (na + nb)
    error = math.sqrt(p * (1 - p) * (1 / na + 1 / nb))
    return bool(error) and abs(a / na - b / nb) / error >= Z_95


def _de_nodo(version, nodo, ahora):
    enviados = (db.session.query(IgMensaje.ejecucion_id, IgMensaje.variante, db.func.min(IgMensaje.enviado_en))
                .join(AutEjecucion, AutEjecucion.id == IgMensaje.ejecucion_id)
                .filter(AutEjecucion.version_id == version.id, IgMensaje.nodo_id == nodo['id'],
                        IgMensaje.variante.isnot(None))
                .group_by(IgMensaje.ejecucion_id, IgMensaje.variante).all())
    recibio = {eid: (variante, momento) for eid, variante, momento in enviados}
    ejecuciones = AutEjecucion.query.filter(AutEjecucion.id.in_(recibio)).all() if recibio else []
    contactos = {e.contacto_id for e in ejecuciones}
    # Los tramos se cortan con cualquier entrada siguiente de la persona, aunque sea de otro flujo.
    todas = AutEjecucion.query.filter(AutEjecucion.contacto_id.in_(contactos)).all() if contactos else []
    tramos = _tramos(todas, ahora)
    agendas = _agendas(ejecuciones, {e.id: tramos[e.id] for e in ejecuciones})
    setters = {e.setter_id for e in ejecuciones if e.setter_id}
    nombres = {u.id: u.username for u in User.query.filter(User.id.in_(setters)).all()} if setters else {}

    entrantes, salientes = defaultdict(list), defaultdict(list)
    if ejecuciones:
        for contacto_id, momento in db.session.query(IgMensaje.contacto_id, IgMensaje.enviado_en).filter(
                IgMensaje.contacto_id.in_(contactos), IgMensaje.direccion == IgMensaje.ENTRANTE):
            entrantes[contacto_id].append(momento)
        for eid, momento in db.session.query(IgMensaje.ejecucion_id, IgMensaje.enviado_en).filter(
                IgMensaje.ejecucion_id.in_(recibio), IgMensaje.direccion == IgMensaje.SALIENTE,
                IgMensaje.nodo_id != nodo['id']):
            salientes[eid].append(momento)

    filas = {vid: {'id': vid, 'recibieron': 0, 'respondieron': 0, 'siguieron': 0, 'calificados': 0, 'agendas': 0}
             for vid in v.ids(nodo)}
    por_setter = defaultdict(lambda: defaultdict(int))
    for e in ejecuciones:
        variante, momento = recibio[e.id]
        fila = filas.setdefault(variante, {'id': variante, 'recibieron': 0, 'respondieron': 0, 'siguieron': 0,
                                           'calificados': 0, 'agendas': 0})
        fin = tramos[e.id][1]
        fila['recibieron'] += 1
        fila['respondieron'] += any(momento < m <= fin for m in entrantes[e.contacto_id])
        fila['siguieron'] += any(m > momento for m in salientes[e.id])
        fila['calificados'] += e.califica is True
        fila['agendas'] += bool(agendas.get(e.id))
        por_setter[nombres.get(e.setter_id, 'Sin setter')][variante] += 1

    base = filas.get(v.PRIMERA)
    for fila in filas.values():
        n = fila['recibieron']
        fila.update({f'tasa_{k}': _tasa(fila[k], n) for k in ('respondieron', 'siguieron', 'calificados', 'agendas')})
        fila['suficiente'] = n >= MUESTRA_MINIMA
        if base and fila is not base:
            fila['clara_vs_a'] = _clara(fila['respondieron'], n, base['respondieron'], base['recibieron'])
    return {'id': nodo['id'], 'nombre': nodo.get('nombre'), 'variantes': list(filas.values()),
            'por_setter': {s: dict(c) for s, c in sorted(por_setter.items())}}


def de_flujo(flujo, ahora):
    """[{id, nombre, numero, variantes, por_setter}] de los mensajes en prueba de la versión publicada."""
    version = flujo.version_publicada
    if version is None:
        return []
    grafo = version.grafo or {}
    en_prueba = [n for n in grafo.get('nodos') or [] if n.get('tipo') == 'mensaje' and v.ids(n)]
    if not en_prueba:
        return []
    numeros = pasos.orden(grafo)
    resultado = [{**_de_nodo(version, n, ahora), 'numero': numeros.get(n['id'])} for n in en_prueba]
    return sorted(resultado, key=lambda r: r['numero'] or 0)

