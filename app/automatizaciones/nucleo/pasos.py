"""El orden de lectura de un flujo: qué número de paso es cada nodo y qué mensaje viene después.

El número sale de recorrer el grafo a lo ancho desde `inicio`, salida por salida en el orden del
nodo (los botones en el orden en que se ven). Los «fin» y los nodos sueltos no llevan número. El
lienzo numera igual (frontend/src/pages/inbox/editor/pasos.js): si cambia acá, cambia allá.
"""
from app.automatizaciones.nucleo import grafo as g


def orden(grafo):
    """{id del nodo: número de paso}, empezando en 1."""
    nodos = g.nodos_por_id(grafo)
    numeros, cola, vistos = {}, [grafo.get('inicio')], set()
    while cola:
        nid = cola.pop(0)
        if nid in vistos or nid not in nodos:
            continue
        vistos.add(nid)
        nodo = nodos[nid]
        if nodo.get('tipo') != 'fin':
            numeros[nid] = len(numeros) + 1
        cola += [g.destino(grafo, nid, s) for s in g.salidas(nodo)]
    return numeros


def mensajes_siguientes(grafo, desde_nodo):
    """Los mensajes a los que se llega desde ese nodo sin pasar por otro mensaje, y los nodos del
    medio (esperas, condiciones y acciones, que no dejan rastro en la conversación)."""
    nodos = g.nodos_por_id(grafo)
    mensajes, intermedios, pila, vistos = [], [], [desde_nodo], set()
    while pila:
        nid = pila.pop()
        if nid in vistos or nid not in nodos:
            continue
        vistos.add(nid)
        if nodos[nid].get('tipo') == 'mensaje':
            mensajes.append(nid)
            continue
        intermedios.append(nid)
        pila += [g.destino(grafo, nid, s) for s in g.salidas(nodos[nid])]
    return mensajes, intermedios
