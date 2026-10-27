"""Los textos de los mensajes de un flujo: lo único que el setter puede cambiar (27/10/2026). Los botones,
las conexiones, las esperas y las condiciones quedan como están: cambiarlos movería a la gente de camino."""
import copy

from app.automatizaciones.nucleo import grafo as g
from app.automatizaciones.nucleo import pasos


def _textos(nodo):
    return [c for c in nodo.get('contenido') or [] if c.get('tipo') == 'texto']


def lista(grafo):
    """Los pasos en orden para el editor: los mensajes con sus textos, botones y dónde guardan la
    respuesta, y los demás nodos (fijos) para que se entienda el recorrido."""
    nodos = g.nodos_por_id(grafo)
    etapas = {e.get('id'): e.get('nombre') for e in grafo.get('etapas') or [] if isinstance(e, dict)}
    salida = []
    for nid, numero in sorted(pasos.orden(grafo).items(), key=lambda par: par[1]):
        nodo = nodos[nid]
        paso = {'id': nid, 'numero': numero, 'tipo': nodo.get('tipo'), 'nombre': nodo.get('nombre'),
                'etapa': etapas.get(nodo.get('etapa'))}
        if nodo.get('tipo') == 'mensaje':
            paso.update(textos=[c.get('texto') or '' for c in _textos(nodo)],
                        botones=[b.get('titulo') for b in nodo.get('botones') or []],
                        guarda=(nodo.get('espera') or {}).get('guardar_en'))
        elif nodo.get('tipo') == 'esperar':
            paso['minutos'] = nodo.get('minutos')
        salida.append(paso)
    return salida


def aplicar(grafo, cambios):
    """Una copia del grafo con los textos cambiados. `cambios`: {nodo_id: [textos]}, uno por cada parte
    de texto del mensaje y en su orden. ValueError si se quiere cambiar algo más que el texto."""
    nuevo = copy.deepcopy(grafo)
    nodos = g.nodos_por_id(nuevo)
    for nid, textos in cambios.items():
        nodo = nodos.get(nid)
        if not nodo or nodo.get('tipo') != 'mensaje':
            raise ValueError(f'El paso {nid} no es un mensaje')
        partes = _textos(nodo)
        if not isinstance(textos, list) or len(textos) != len(partes) or not all(isinstance(t, str) for t in textos):
            raise ValueError(f'Paso {nid}: solo se cambia el texto, no la cantidad de partes del mensaje')
        for parte, texto in zip(partes, textos):
            parte['texto'] = texto
    return nuevo
