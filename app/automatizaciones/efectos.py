"""Qué activó en el flujo cada mensaje del lead, anotado en el mensaje entrante (`contenido['efecto']`).

La bandeja lo muestra debajo de la respuesta: arrancó un flujo (y con qué palabra clave), tocó un
botón, guardó un dato, y a qué paso llevó. Se anota desde el 27/10/2026: los mensajes anteriores no
lo tienen (el botón elegido sí se recupera, del payload: ver `bandeja.elegidos`).
"""
from app.automatizaciones import bandeja


def anotar(mensaje, ejecucion, **datos):
    """`tipo`: inicio · boton · respuesta. `nodo`: el mensaje del bot que contestó (para marcar el botón)."""
    if mensaje is None:
        return
    efecto = {k: v for k, v in datos.items() if v not in (None, '', {})}
    if ejecucion is not None:
        efecto.update(flujo=ejecucion.version.flujo.nombre, estado=ejecucion.estado, paso=bandeja.paso(ejecucion))
    # Diccionario nuevo: la columna JSON no detecta cambios adentro del que ya tenía.
    mensaje.contenido = {**(mensaje.contenido or {}), 'efecto': efecto}
