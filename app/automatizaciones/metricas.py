"""Cómo le va a cada flujo en los últimos días: cuánta gente entra, cuánta termina y dónde se cae.

Se arma con lo que ya guarda el motor: cada mensaje saliente lleva su ejecución y su nodo, así que
«llegó al paso N» es «le mandamos el mensaje del nodo N». Las esperas, condiciones y acciones no
dejan mensaje: no tienen alcance propio y se atraviesan para ver qué mensaje vino después.

Caída de un paso que espera respuesta: de los que lo recibieron (menos los que todavía están
esperando ahí), cuántos no llegaron a ningún mensaje por una salida de respuesta. La rama «sin
respuesta» no cuenta como seguir: es justamente el que no contestó.
"""
from collections import defaultdict
from datetime import timedelta

from app import db
from app.automatizaciones.modelos import AutEjecucion, AutFlujoVersion, IgMensaje
from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import pasos

DIAS = 7
# Con menos entradas los porcentajes engañan: la tarjeta dice «muestra insuficiente».
MUESTRA_MINIMA = 20
BASE_MINIMA_CAIDA = 10


def _ejecuciones(flujo_id, desde):
    filas = (db.session.query(AutEjecucion.id, AutEjecucion.estado, AutEjecucion.nodo_actual)
             .join(AutFlujoVersion, AutEjecucion.version_id == AutFlujoVersion.id)
             .filter(AutFlujoVersion.flujo_id == flujo_id, AutEjecucion.iniciada_en >= desde).all())
    alcance = defaultdict(set)
    if filas:
        mensajes = (db.session.query(IgMensaje.nodo_id, IgMensaje.ejecucion_id)
                    .join(AutEjecucion, IgMensaje.ejecucion_id == AutEjecucion.id)
                    .join(AutFlujoVersion, AutEjecucion.version_id == AutFlujoVersion.id)
                    .filter(AutFlujoVersion.flujo_id == flujo_id, AutEjecucion.iniciada_en >= desde,
                            IgMensaje.nodo_id.isnot(None))
                    .distinct().all())
        for nodo_id, ejecucion_id in mensajes:
            alcance[nodo_id].add(ejecucion_id)
    return filas, alcance


def _paso(grafo, nid, nodo, alcance, abiertas):
    """Alcance, caída y reparto entre salidas de un mensaje."""
    llegaron = alcance.get(nid, set())
    base = llegaron - abiertas.get(nid, set())
    reparto, siguen, completo = {}, set(), True
    for salida in g.salidas(nodo):
        if salida == 'sin_respuesta':
            continue
        hacia = g.destino(grafo, nid, salida)
        if hacia is None:
            completo = False  # una salida suelta: quien la toca termina el flujo, no es caída
            continue
        mensajes, intermedios = pasos.mensajes_siguientes(grafo, hacia)
        por_salida = set().union(*(alcance.get(m, set()) for m in mensajes),
                                 *(abiertas.get(m, set()) for m in intermedios)) & llegaron
        reparto[salida] = len(por_salida)
        siguen |= por_salida
    total = sum(reparto.values())
    caida = None
    if completo and reparto and base:
        caida = round(max(0.0, 1 - len(siguen & base) / len(base)), 3)
    return {
        'alcance': len(llegaron),
        'base': len(base),
        'caida': caida,
        'salidas': {s: round(n / total, 3) for s, n in reparto.items()} if total else {},
    }


def de_flujo(flujo, ahora, detalle=False):
    """Las métricas de los últimos DIAS. Con `detalle`, también las de cada paso (para el lienzo)."""
    grafo = flujo.grafo or {}
    ejecuciones, alcance = _ejecuciones(flujo.id, ahora - timedelta(days=DIAS))
    abiertas = defaultdict(set)
    for e in ejecuciones:
        if e.estado in AutEjecucion.ABIERTOS:
            abiertas[e.nodo_actual].add(e.id)
    entradas = len(ejecuciones)
    terminadas = sum(1 for e in ejecuciones if e.estado == AutEjecucion.TERMINADA)
    suficiente = entradas >= MUESTRA_MINIMA

    nodos = g.nodos_por_id(grafo)
    numeros = pasos.orden(grafo)
    por_nodo = {nid: {'numero': n, **_paso(grafo, nid, nodos[nid], alcance, abiertas)}
                for nid, n in numeros.items() if nodos[nid].get('tipo') == 'mensaje'}

    mayor = None
    if suficiente:
        candidatos = [(nid, d) for nid, d in por_nodo.items() if d['caida'] and d['base'] >= BASE_MINIMA_CAIDA]
        if candidatos:
            nid, d = max(candidatos, key=lambda x: x[1]['caida'])
            mayor = {'id': nid, 'numero': d['numero'], 'nombre': nodos[nid].get('nombre'), 'caida': d['caida']}

    resultado = {
        'dias': DIAS,
        'entradas': entradas,
        'completan': round(terminadas / entradas, 3) if entradas else None,
        'suficiente': suficiente,
        'embudo': [{'id': nid, 'numero': d['numero'], 'alcance': d['alcance']}
                   for nid, d in sorted(por_nodo.items(), key=lambda x: x[1]['numero'])],
        'mayor_caida': mayor,
    }
    if detalle:
        resultado['nodos'] = por_nodo
    return resultado
