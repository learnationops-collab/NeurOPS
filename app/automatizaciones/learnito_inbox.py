"""La pregunta a Learnito desde una conversación del Inbox (Estrategia 16/11/2026, ADR-W150).

El setter no necesita que le redacten el mensaje: necesita información para responder. El botón del chat abre el
Learnito de siempre (el cerebro de la Academia, con sus reglas de costo, tope y calificación) con una pregunta que
lleva el contexto del lead: lo que se sabe, las notas del equipo y los últimos mensajes. El material del programa
lo busca el cerebro con `buscar_material`, que Work le pide a la Academia (`learnito_material.py`).

Del lado del setter se ve solo `muestra` («Ayudame con @usuario…»); el contexto viaja en `pregunta`.
"""
import json

from app.automatizaciones.modelos import IgMensaje

MENSAJES = 20
LARGO_MENSAJE = 300
QUIEN = {IgMensaje.LEAD: 'Lead', IgMensaje.MOTOR: 'Bot', IgMensaje.OTRO: 'Equipo'}
PEDIDO = ('Soy setter de Learnation y estoy conversando por Instagram con este lead. No me redactes el mensaje: '
          'decime en pocas líneas qué información del programa o del material me sirve para responderle, y qué '
          'conviene preguntarle o evitar.')


def _lineas(contacto_id):
    mensajes = (IgMensaje.query.filter_by(contacto_id=contacto_id)
                .order_by(IgMensaje.enviado_en.desc(), IgMensaje.id.desc()).limit(MENSAJES).all())
    salida = []
    for m in reversed(mensajes):
        texto = ' '.join((m.texto or '').split())[:LARGO_MENSAJE]
        if texto:
            quien = m.autor.username if m.origen == IgMensaje.OTRO and m.autor else QUIEN.get(m.origen, 'Equipo')
            salida.append(f'{quien}: {texto}')
    return salida


def pregunta(contacto, notas=(), pedido=None):
    """{'pregunta': lo que va al cerebro, 'muestra': lo que ve el setter en el chat de Learnito}."""
    pedido = ' '.join((pedido or '').split())[:300]
    quien = f'@{contacto.username}' if contacto.username else (contacto.nombre or 'este lead')
    variables = {k: v for k, v in (contacto.variables or {}).items() if not str(k).startswith('_') and v not in (None, '')}
    partes = [PEDIDO]
    if pedido:
        partes.append(f'En especial: {pedido}')
    partes.append(f'Lead: {contacto.nombre or "sin nombre"} ({quien}). Lo que sabemos: '
                  + (json.dumps(variables, ensure_ascii=False) if variables else 'nada todavía') + '.')
    if notas:
        partes.append('Notas del equipo: ' + ' · '.join(' '.join(str(n).split())[:200] for n in list(notas)[-3:]))
    partes.append('Conversación (de la más vieja a la última):\n' + ('\n'.join(_lineas(contacto.id)) or '(sin mensajes)'))
    return {'pregunta': '\n\n'.join(partes), 'muestra': f'Ayudame con {quien}' + (f': {pedido}' if pedido else '')}
