"""La pregunta a Learnito desde una conversación del Inbox (Estrategia 16/11/2026, ADR-W150).

El setter no necesita que le redacten el mensaje: necesita información para responder. El botón del chat abre el
Learnito de siempre (el cerebro de la Academia, con sus reglas de costo, tope y calificación) con una pregunta que
lleva el contexto del lead: lo que se sabe, las notas del equipo y los últimos mensajes. El material del programa
lo busca el cerebro con `buscar_material`, que Work le pide a la Academia (`learnito_material.py`).

Del lado del setter se ve solo `muestra` («Ayudame con @usuario…»); el contexto viaja en `pregunta`.

Desde el 26/11/2026 (ADR-W253) el botón primero ofrece qué hacer con la conversación leída entera (hasta 80 mensajes):
resumirla, sugerir una respuesta, sugerir un seguimiento, qué info del programa sirve, o una pregunta libre
(`intencion`). Mario pidió que sí sugiera la respuesta: la decide el setter, que la copia o la edita.
"""
import json

from app.automatizaciones.modelos import IgMensaje

MENSAJES = 80
LARGO_MENSAJE = 300
QUIEN = {IgMensaje.LEAD: 'Lead', IgMensaje.MOTOR: 'Bot', IgMensaje.OTRO: 'Equipo'}
PEDIDO = ('Soy setter de Learnation y estoy conversando por Instagram con este lead. No me redactes el mensaje: '
          'decime en pocas líneas qué información del programa o del material me sirve para responderle, y qué '
          'conviene preguntarle o evitar.')
BASE = 'Soy setter de Learnation y estoy conversando por Instagram o WhatsApp con este lead. Leé toda la conversación. '
# intención: (pedido al cerebro, cómo se ve del lado del setter)
INTENCIONES = {
    'info': (PEDIDO, 'Qué info me sirve con {quien}'),
    'resumen': (BASE + 'Resumímela en 4 o 5 viñetas cortas: quién es y qué examen prepara, qué quiere, qué objeciones o '
                'dudas tiene, en qué quedó y qué falta saber. Sin relleno.', 'Resumime la conversación con {quien}'),
    'respuesta': (BASE + 'Sugerime el próximo mensaje para mandarle, en mi tono (rioplatense, cercano, corto, como un '
                  'mensaje de chat). Dame dos opciones distintas, cada una en su bloque, y en una línea por qué. Si no '
                  'hace falta responderle todavía, decilo.', 'Sugerime una respuesta para {quien}'),
    'seguimiento': (BASE + 'Está sin responder o la conversación se enfrió. Sugerime un mensaje de seguimiento corto para '
                    'retomarla (dos opciones) y cuándo conviene mandarlo.', 'Sugerime un seguimiento para {quien}'),
    'pregunta': (BASE + 'Respondé mi pregunta sobre esta conversación con lo que dice la conversación (y el material del '
                 'programa si hace falta).', 'Sobre {quien}'),
}


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


def pregunta(contacto, notas=(), pedido=None, intencion=None):
    """{'pregunta': lo que va al cerebro, 'muestra': lo que ve el setter en el chat de Learnito}."""
    pedido = ' '.join((pedido or '').split())[:300]
    quien = f'@{contacto.username}' if contacto.username else (contacto.nombre or 'este lead')
    variables = {k: v for k, v in (contacto.variables or {}).items() if not str(k).startswith('_') and v not in (None, '')}
    if intencion in INTENCIONES:
        texto, muestra = INTENCIONES[intencion]
        partes = [texto]
        if pedido:
            partes.append(f'Mi pregunta: {pedido}' if intencion == 'pregunta' else f'En especial: {pedido}')
        cuerpo = _contexto(contacto, quien, variables, notas)
        return {'pregunta': '\n\n'.join(partes + cuerpo),
                'muestra': muestra.format(quien=quien) + (f': {pedido}' if pedido else '')}
    partes = [PEDIDO]
    if pedido:
        partes.append(f'En especial: {pedido}')
    partes.append(f'Lead: {contacto.nombre or "sin nombre"} ({quien}). Lo que sabemos: '
                  + (json.dumps(variables, ensure_ascii=False) if variables else 'nada todavía') + '.')
    if notas:
        partes.append('Notas del equipo: ' + ' · '.join(' '.join(str(n).split())[:200] for n in list(notas)[-3:]))
    partes.append('Conversación (de la más vieja a la última):\n' + ('\n'.join(_lineas(contacto.id)) or '(sin mensajes)'))
    return {'pregunta': '\n\n'.join(partes), 'muestra': f'Ayudame con {quien}' + (f': {pedido}' if pedido else '')}


def _contexto(contacto, quien, variables, notas):
    """Lo que se sabe del lead, las notas del equipo y la conversación entera (hasta MENSAJES)."""
    partes = [f'Lead: {contacto.nombre or "sin nombre"} ({quien}). Lo que sabemos: '
              + (json.dumps(variables, ensure_ascii=False) if variables else 'nada todavía') + '.']
    if notas:
        partes.append('Notas del equipo: ' + ' · '.join(' '.join(str(n).split())[:200] for n in list(notas)[-3:]))
    partes.append('Conversación (de la más vieja a la última):\n' + ('\n'.join(_lineas(contacto.id)) or '(sin mensajes)'))
    return partes
