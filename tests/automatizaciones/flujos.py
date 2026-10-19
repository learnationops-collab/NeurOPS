"""Flujos y payloads de Meta para los tests, con la forma del flujo «OBTENER GUÍA» que hoy corre en ManyChat."""
import copy

CUENTA = '17841445369883582'
LEAD = '2992679577752642'

GUIA = {
    'disparadores': [{'id': 'd1', 'canal': 'dm', 'palabras': ['OBTENER GUIA'], 'coincidencia': 'exacta'}],
    'inicio': 'perfil',
    'nodos': [
        {'id': 'perfil', 'tipo': 'mensaje', 'contenido': [{'tipo': 'texto', 'texto': '¿Cuál es tu perfil?'}],
         'botones': [{'id': 'medico', 'titulo': 'Médico graduado'}, {'id': 'estudiante', 'titulo': 'Estudiante'}],
         'sin_respuesta': {'minutos': 60}},
        {'id': 'genial', 'tipo': 'mensaje', 'contenido': [{'tipo': 'texto', 'texto': 'Genial ya te lo mando 🙌'}]},
        {'id': 'examen', 'tipo': 'mensaje',
         'contenido': [{'tipo': 'texto', 'texto': 'Antes, para qué examen te estás preparando?'}],
         'espera': {'guardar_en': 'examen'}, 'sin_respuesta': {'minutos': 30}},
        {'id': 'es_enarm', 'tipo': 'condicion', 'reglas': [{'campo': 'examen', 'operador': 'contiene', 'valor': 'enarm'}]},
        {'id': 'enarm', 'tipo': 'mensaje', 'contenido': [{'tipo': 'texto', 'texto': 'Recursos para {{examen}}'}]},
        {'id': 'general', 'tipo': 'mensaje', 'contenido': [{'tipo': 'texto', 'texto': 'Recursos generales'},
                                                            {'tipo': 'imagen', 'url': 'https://x.com/guia.png'}]},
        {'id': 'seguimiento', 'tipo': 'mensaje', 'contenido': [{'tipo': 'texto', 'texto': 'Estas por ahi?'}]},
        {'id': 'fin', 'tipo': 'fin'},
    ],
    'conexiones': [
        {'id': 'c1', 'desde': 'perfil', 'salida': 'medico', 'hacia': 'genial'},
        {'id': 'c2', 'desde': 'perfil', 'salida': 'estudiante', 'hacia': 'general'},
        {'id': 'c3', 'desde': 'perfil', 'salida': 'sin_respuesta', 'hacia': 'seguimiento'},
        {'id': 'c4', 'desde': 'genial', 'salida': 'siguiente', 'hacia': 'examen'},
        {'id': 'c5', 'desde': 'examen', 'salida': 'respuesta', 'hacia': 'es_enarm'},
        {'id': 'c6', 'desde': 'es_enarm', 'salida': 'si', 'hacia': 'enarm'},
        {'id': 'c7', 'desde': 'es_enarm', 'salida': 'no', 'hacia': 'general'},
        {'id': 'c8', 'desde': 'enarm', 'salida': 'siguiente', 'hacia': 'fin'},
    ],
}


def guia(**cambios):
    grafo = copy.deepcopy(GUIA)
    grafo.update(cambios)
    return grafo


def _messaging(item, ms):
    return {'object': 'instagram', 'entry': [{'id': CUENTA, 'time': ms, 'messaging': [{'timestamp': ms, **item}]}]}


def dm(texto, mid, ms, lead=LEAD, quick_reply=None, anuncio=None):
    mensaje = {'mid': mid, 'text': texto}
    if quick_reply:
        mensaje['quick_reply'] = {'payload': quick_reply}
    if anuncio:  # tocó la pregunta de un anuncio de Conversaciones
        mensaje['referral'] = {'source': 'ADS', 'type': 'OPEN_THREAD', 'ad_id': anuncio,
                               'ads_context_data': {'ad_title': 'Anuncio'}}
    return _messaging({'sender': {'id': lead}, 'recipient': {'id': CUENTA}, 'message': mensaje}, ms)


def postback(titulo, payload, mid, ms, lead=LEAD):
    return _messaging({'sender': {'id': lead}, 'recipient': {'id': CUENTA},
                       'postback': {'title': titulo, 'payload': payload, 'mid': mid}}, ms)


def eco(texto, mid, ms, lead=LEAD):
    return _messaging({'sender': {'id': CUENTA}, 'recipient': {'id': lead},
                       'message': {'mid': mid, 'text': texto, 'is_echo': True}}, ms)


def lectura(ms):
    return _messaging({'read': {'mid': 'x'}}, ms)


def comentario(texto, comentario_id, ms, lead=LEAD, publicacion='1790000', username='ana'):
    return {'object': 'instagram', 'entry': [{'id': CUENTA, 'time': ms // 1000, 'changes': [
        {'field': 'comments', 'value': {'id': comentario_id, 'text': texto, 'media': {'id': publicacion},
                                        'from': {'id': lead, 'username': username}}}]}]}
