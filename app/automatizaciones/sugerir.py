"""Learnito sugiere la próxima respuesta del setter en el Inbox (Estrategia 16/11/2026, ADR-W149).

Mario: «Learnito da feedback a los setters con el conocimiento del programa, base de un futuro setter IA».

  · Lo genera Work con una sola llamada a Claude (`ClaudeService`, que registra el gasto), no el cerebro de la
    Academia: tiene que tardar segundos y es la base del setter IA, que va a correr en el motor de Work.
  · El conocimiento del programa es el material de la Academia (Learnation Resources), que se pide por su
    conector (`findMaterial`) con lo último que escribió el lead. Si la Academia no responde, sugiere igual.
  · Lee la conversación (los últimos mensajes, con quién dijo cada uno), las variables del lead y las notas del
    equipo. Devuelve la respuesta sugerida y por qué, para que el setter la edite y la mande él.
  · Tope por persona y por día (`TOPE_DIA_USD`), sobre lo que registra `AiUsage`.
"""
import json
import logging
import re
from datetime import datetime

from app.automatizaciones.acciones import AccionInvalida
from app.automatizaciones.modelos import IgMensaje
from app.services.claude_service import ClaudeService, ClaudeServiceError, gasto_del_mes

logger = logging.getLogger(__name__)

FEATURE = 'inbox_sugerencia'
MODELO = 'claude-opus-5-5'
TOPE_DIA_USD = 2  # ~80 sugerencias por persona por día
MENSAJES = 25
MATERIALES = 4
LARGO_FRAGMENTO = 700
VACIAS = {'para', 'pero', 'como', 'esto', 'esta', 'este', 'que', 'quiero', 'tengo', 'hola', 'gracias', 'buenas',
          'porque', 'cuando', 'donde', 'sobre', 'tambien', 'también', 'muy', 'bien', 'vale', 'okey', 'dale'}

# Estable a propósito (va con caché): nada que cambie por pedido.
GUIA = """Sos Learnito, el asistente del equipo de setting de Learnation. Learnation enseña a médicos a estudiar mejor \
para aprobar su examen de residencia (ENARM, MIR, EUNACOM, etc.) con técnicas basadas en evidencia. Los leads llegan \
por Instagram (anuncios, reels, historias, comentarios) y el setter conversa con ellos para entender su situación y, \
si califican, invitarlos a agendar una llamada con el equipo (el link de agenda lo tiene el setter).

Tu trabajo: proponer la próxima respuesta que el setter le va a mandar al lead, y en una línea explicarle por qué, \
como un compañero con experiencia que le da feedback.

Cómo escribir la respuesta:
- Imitá el tono del equipo en la conversación (cercano, corto, como un DM de Instagram). Nada de textos largos.
- Un solo paso por mensaje: una pregunta, o un dato y una pregunta. Avanzá hacia entender su dolor y su examen y, \
cuando ya calificó, hacia la agenda.
- Usá el material del programa solo si viene a cuento; contalo simple, sin jerga.
- Nunca inventes precios, cupos, descuentos, fechas ni promesas de resultado. Si hace falta un dato que no tenés, \
dejalo entre corchetes para que el setter lo complete, por ejemplo [link de agenda].
- Si el lead no es médico o no busca un examen, sugerí una salida amable sin forzar la venta.
- Si el pedido del setter dice cómo quiere la respuesta, seguilo.

"por_que" es para el setter, no para el lead: qué buscás con ese mensaje o qué señal viste, en una oración."""

FORMATO = {
    'type': 'json_schema',
    'schema': {
        'type': 'object',
        'properties': {
            'respuesta': {'type': 'string', 'description': 'El mensaje para el lead, listo para mandar'},
            'por_que': {'type': 'string', 'description': 'Una oración para el setter'},
        },
        'required': ['respuesta', 'por_que'],
        'additionalProperties': False,
    },
}

QUIEN = {IgMensaje.LEAD: 'Lead', IgMensaje.MOTOR: 'Bot', IgMensaje.OTRO: 'Equipo'}


def _conversacion(contacto_id):
    mensajes = (IgMensaje.query.filter_by(contacto_id=contacto_id)
                .order_by(IgMensaje.enviado_en.desc(), IgMensaje.id.desc()).limit(MENSAJES).all())
    return list(reversed(mensajes))


def _lineas(mensajes):
    salida = []
    for m in mensajes:
        texto = ' '.join((m.texto or '').split())
        if not texto:
            continue
        quien = m.autor.username if m.origen == IgMensaje.OTRO and m.autor else QUIEN.get(m.origen, 'Equipo')
        salida.append(f'[{m.enviado_en:%d/%m %H:%M}] {quien}: {texto}')
    return salida


def _palabras(textos):
    vistas = []
    for t in textos:
        for p in re.findall(r'[a-záéíóúñü]{4,}', (t or '').lower()):
            if p not in VACIAS and p not in vistas:
                vistas.append(p)
    return vistas[:8]


def material_de(textos):
    """Lo del programa que viene a cuento, del material de la Academia. [] si no hay o no responde."""
    tema = ' '.join(textos)[-400:]
    if not tema.strip():
        return []
    from app.services.learnation_service import LearnationService
    try:
        r = LearnationService._request('POST', '/learnito/connector', timeout=8,
                                       json={'op': 'findMaterial', 'args': {'tema': tema, 'palabras': _palabras(textos)}})
    except Exception as e:  # sin material la sugerencia sale igual
        logger.error(f'[SUGERIR] Material de la Academia: {e}')
        return []
    resultados = ((r or {}).get('valor') or {}).get('results') or []
    return [{'titulo': x.get('title'), 'tipo': x.get('type'),
             'texto': ' '.join(str(x.get('summary') or '').split() + ['…'] + str(x.get('fragment') or '').split())[:LARGO_FRAGMENTO]}
            for x in resultados[:MATERIALES]]


def _pedido(contacto, mensajes, material, notas, pedido):
    variables = {k: v for k, v in (contacto.variables or {}).items() if not str(k).startswith('_') and v not in (None, '')}
    partes = [
        f'Lead: {contacto.nombre or "sin nombre"} (@{contacto.username or "?"})',
        'Lo que sabemos: ' + (json.dumps(variables, ensure_ascii=False) if variables else 'nada todavía'),
    ]
    if notas:
        partes.append('Notas internas del equipo:\n' + '\n'.join(f'- {n}' for n in notas))
    partes.append('Conversación (de la más vieja a la última):\n' + ('\n'.join(_lineas(mensajes)) or '(sin mensajes)'))
    if material:
        partes.append('Material del programa que puede servir:\n' + '\n'.join(
            f'- {m["titulo"]} ({m["tipo"]}): {m["texto"]}' for m in material))
    partes.append(f'Pedido del setter: {pedido}' if pedido else 'Proponé la próxima respuesta.')
    return '\n\n'.join(partes)


def sugerir(contacto, user_id, pedido=None, notas=()):
    """{'respuesta', 'por_que', 'fuentes'}. Lanza `AccionInvalida` con un mensaje para mostrar."""
    hoy = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    if gasto_del_mes(user_id, FEATURE, desde=hoy) >= TOPE_DIA_USD:
        raise AccionInvalida('Llegaste al tope de sugerencias de hoy: mañana se renueva')
    mensajes = _conversacion(contacto.id)
    del_lead = [m.texto for m in mensajes if m.origen == IgMensaje.LEAD and m.texto][-3:]
    material = material_de(del_lead)
    pedido = (pedido or '').strip()[:500] or None
    try:
        r = ClaudeService.create_message(
            FEATURE, user_id, model=MODELO, max_tokens=2000,
            system=[{'type': 'text', 'text': GUIA, 'cache_control': {'type': 'ephemeral'}}],
            messages=[{'role': 'user', 'content': _pedido(contacto, mensajes, material, list(notas)[-5:], pedido)}],
            output_config={'effort': 'low', 'format': FORMATO},
        )
    except ClaudeServiceError as e:
        raise AccionInvalida(f'Learnito no pudo sugerir: {e}')
    if r.stop_reason == 'refusal':
        raise AccionInvalida('Learnito no quiso sugerir sobre esta conversación')
    texto = next((b.text for b in r.content if b.type == 'text'), '')
    try:
        datos = json.loads(texto)
    except ValueError:
        raise AccionInvalida('Learnito respondió algo que no se pudo leer: probá de nuevo')
    return {'respuesta': datos['respuesta'].strip(), 'por_que': datos['por_que'].strip(),
            'fuentes': [m['titulo'] for m in material if m.get('titulo')]}
