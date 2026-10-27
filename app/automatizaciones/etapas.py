"""Etapas de un flujo (27/10/2026): agrupan pasos distintos (`grafo.etapas` y `nodo.etapa`), por ejemplo
Bienvenida, Calificación y Agenda. Al entrar a un paso de una etapa nueva, el motor graba su número (su
posición en la lista, desde 1) igual que la acción «Etapa»: `_etapa` del contacto y `last_stage` del
lead (`registro.etapa`), que usan los tableros. La acción queda para los flujos que ya la usan."""
from app.automatizaciones import registro


def al_entrar(motor, ejecucion, nodo):
    etapa = nodo.get('etapa')
    if not etapa:
        return
    ids = [e.get('id') for e in ejecucion.version.grafo.get('etapas') or [] if isinstance(e, dict)]
    if etapa not in ids:
        return
    numero = ids.index(etapa) + 1
    contacto = ejecucion.contacto
    if (contacto.variables or {}).get('_etapa') == numero:
        return
    motor._guardar(contacto, {'_etapa': numero})
    registro.etapa(ejecucion, numero)
