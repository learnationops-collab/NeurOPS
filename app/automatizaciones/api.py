"""API del área Inbox (/api/inbox): flujos del motor y conversaciones de Instagram.

Toda ruta exige sesión; la guarda vive en el before_request. Admin y dirección comercial arman y
publican flujos. El setter entra a mirar (solo GET), como en Agendas 2.0.
"""
import json

from flask import Blueprint, jsonify, request
from flask_login import current_user, login_required

from app import db
from app.automatizaciones import bandeja, busqueda, campanas, escribir, fases, metricas, progreso, servicio
from app.automatizaciones.modelos import AutEjecucion, AutEmbudo, AutFlujo, IgContacto, IgMensaje
from app.automatizaciones.nucleo import grafo as g
from app.models.instagram import InstagramWebhookEvento
from app.models.tag import TARGET_IG_CONTACT
from app.services import tags_service
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL, ROLE_OPERATOR, ROLE_SETTER, ROLE_TRIAGE

bp = Blueprint('inbox', __name__)

# El operador es el super admin técnico (17/11/2026): también arma, publica y aprueba propuestas.
ROLES_CON_ACCESO = (ROLE_ADMIN, ROLE_OPERATOR, ROLE_DIRECTOR_COMERCIAL)
# Triage (Dari) atiende lo que le asignan, como un setter: la estrategia de referidos (25/11/2026).
ROLES_DE_LECTURA = (ROLE_SETTER, ROLE_TRIAGE)
# Lo único que el setter puede cambiar: el recorrido y el bot de una conversación (`api_acciones.py`)
# sus etiquetas, incluido crear un grupo (`api_etiquetas.py`), los textos de los flujos (`api_mensajes.py`),
# lo que trabaja sobre la conversación (`api_trabajo.py`), la biblioteca del equipo (`api_biblioteca.py`)
# escribirle al lead (`api_escribir.py`), programar seguimientos (`api_seguimientos.py`), armar la
# pregunta a Learnito (`api_learnito.py`, un GET) y proponer cambios
# de estructura (`api_propuestas.py`), y publicar la Guía o proponerle cambios (`api_guia.py`).
ACCIONES_DEL_SETTER = {'inbox.mover_en_flujo', 'inbox.bot_de_conversacion', 'inbox.crear_grupo_etiquetas',
                       'inbox.escribir_al_lead', 'inbox.proponer_cambios',
                       'inbox.programar_seguimiento', 'inbox.cancelar_seguimiento',
                       'inbox.poner_etiqueta', 'inbox.sacar_etiqueta', 'inbox.guardar_mensajes',
                       'inbox.marcar_leido', 'inbox.marcar_resuelta', 'inbox.cerrar_varias','inbox.asignar_conversacion', 'inbox.mover_etapa', 'inbox.corregir_variable',
                       'inbox.crear_nota', 'inbox.crear_tarea', 'inbox.cambiar_tarea',
                       'inbox.crear_rapida', 'inbox.borrar_rapida', 'inbox.subir_audio', 'inbox.borrar_audio',
                       'inbox.mover_fase', 'inbox.marcar_canal', 'inbox.anotar_cita', 'inbox.etiquetar_varias',
                       'inbox.publicar_guia', 'inbox.proponer_guia', 'inbox.simular_embudo',
                       'inbox.cambiar_actividad', 'inbox.marcar_seguimiento', 'inbox.abrir_en_instagram'}
MAX_BYTES_GRAFO = 300_000
MAX_NODOS = 300
MENSAJES_POR_CONVERSACION = 300

GRAFO_NUEVO = {
    'disparadores': [{'id': 'd1', 'canal': 'dm', 'palabras': [], 'coincidencia': 'exacta'}],
    'inicio': 'n1',
    'nodos': [{'id': 'n1', 'tipo': 'mensaje', 'posicion': {'x': 0, 'y': 0},
               'contenido': [{'tipo': 'texto', 'texto': '¡Hola! 👋'}]}],
    'conexiones': [],
}


@bp.before_request
@login_required
def _guardia():
    if current_user.role in ROLES_CON_ACCESO:
        return None
    if current_user.role in ROLES_DE_LECTURA and (request.method == 'GET' or request.endpoint in ACCIONES_DEL_SETTER):
        return None
    return jsonify({'message': 'Forbidden'}), 403


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def _iso(fecha):
    return fecha.isoformat() + 'Z' if fecha else None


def _flujo_o_404(flujo_id):
    flujo = db.session.get(AutFlujo, flujo_id)
    if flujo is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    return flujo, None


def _resumen_flujo(flujo, detalle=False):
    publicada = flujo.version_publicada
    palabras = [p for d in (flujo.grafo or {}).get('disparadores') or [] for p in d.get('palabras') or []]
    return {
        'id': flujo.id,
        'nombre': flujo.nombre,
        'estado': flujo.estado,
        'version': publicada.numero if publicada else None,
        'publicada_en': _iso(publicada.publicada_en) if publicada else None,
        'cambios_sin_publicar': publicada is None or publicada.grafo != flujo.grafo,
        'palabras_clave': palabras,
        # Dónde vive en Embudos (ADR-W204): sin embudo, Conversión; sin fase, la primera.
        'embudo_id': flujo.embudo_id,
        'fase': flujo.fase,
        'nodos': len((flujo.grafo or {}).get('nodos') or []),
        'ejecuciones_abiertas': AutEjecucion.query.join(AutEjecucion.version).filter(
            AutEjecucion.estado.in_(AutEjecucion.ABIERTOS), AutEjecucion.version.has(flujo_id=flujo.id)).count(),
        'actualizado_en': _iso(flujo.actualizado_en),
        'metricas': metricas.de_flujo(flujo, servicio.ahora(), detalle=detalle),
    }


def _flujo_completo(flujo):
    """Lo que abre el lienzo: el resumen, el borrador, sus errores y las métricas de cada paso."""
    return {**_resumen_flujo(flujo, detalle=True), 'grafo': flujo.grafo, 'errores': g.validar(flujo.grafo)}


def _ubicar(flujo, datos):
    """Aplica `embudo` (slug) y `fase` del cuerpo. Devuelve un mensaje de error o None."""
    from app.automatizaciones import embudos
    if 'embudo' in datos:
        e = embudos.por_slug(datos.get('embudo'))
        if e is None:
            return 'Ese embudo no existe'
        flujo.embudo_id = embudos.id_guardado(e)
    if 'fase' in datos:
        e = db.session.get(AutEmbudo, flujo.embudo_id) if flujo.embudo_id else None
        fase = datos.get('fase') or None
        if fase and fase not in embudos.ids_de(e):
            return 'Esa fase no es del embudo'
        flujo.fase = fase
    return None


def _error_de_grafo(grafo):
    if not isinstance(grafo, dict):
        return 'El flujo no es un documento válido'
    if len(json.dumps(grafo)) > MAX_BYTES_GRAFO:
        return 'El flujo es demasiado grande'
    if len(grafo.get('nodos') or []) > MAX_NODOS:
        return f'Un flujo admite hasta {MAX_NODOS} nodos'
    return None


# --- Estado -----------------------------------------------------------------------------------

@bp.route('/estado', methods=['GET'])
def estado():
    return jsonify({
        'modo': servicio.modo(),
        'puede_editar': current_user.role in ROLES_CON_ACCESO,
        'flujos_activos': AutFlujo.query.filter_by(estado=AutFlujo.ACTIVO).count(),
        'contactos': IgContacto.query.count(),
        'eventos_sin_procesar': InstagramWebhookEvento.query.filter(InstagramWebhookEvento.procesado_en.is_(None)).count(),
    })


# --- Flujos -----------------------------------------------------------------------------------

@bp.route('/flujos', methods=['GET'])
def listar_flujos():
    flujos = AutFlujo.query.order_by(AutFlujo.actualizado_en.desc()).all()
    return jsonify({'flujos': [_resumen_flujo(f) for f in flujos]})


@bp.route('/flujos', methods=['POST'])
def crear_flujo():
    datos = _cuerpo()
    nombre = (datos.get('nombre') or '').strip()[:150]
    if not nombre:
        return jsonify({'message': 'El flujo necesita un nombre'}), 400
    grafo = datos.get('grafo') or json.loads(json.dumps(GRAFO_NUEVO))
    error = _error_de_grafo(grafo)
    if error:
        return jsonify({'message': error}), 400
    flujo = AutFlujo(nombre=nombre, grafo=grafo)
    problema = _ubicar(flujo, datos)
    if problema:
        return jsonify({'message': problema}), 400
    db.session.add(flujo)
    db.session.commit()
    return jsonify(_flujo_completo(flujo)), 201


@bp.route('/flujos/<int:flujo_id>', methods=['GET'])
def ver_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    return jsonify(_flujo_completo(flujo))


@bp.route('/flujos/<int:flujo_id>', methods=['PUT'])
def guardar_flujo(flujo_id):
    """Guarda el borrador. Lo que corre no cambia hasta publicar."""
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    datos = _cuerpo()
    if 'nombre' in datos:
        nombre = (datos.get('nombre') or '').strip()[:150]
        if not nombre:
            return jsonify({'message': 'El flujo necesita un nombre'}), 400
        flujo.nombre = nombre
    if 'grafo' in datos:
        problema = _error_de_grafo(datos['grafo'])
        if problema:
            return jsonify({'message': problema}), 400
        flujo.grafo = datos['grafo']
    problema = _ubicar(flujo, datos)
    if problema:
        return jsonify({'message': problema}), 400
    db.session.commit()
    return jsonify(_flujo_completo(flujo))


@bp.route('/flujos/<int:flujo_id>/publicar', methods=['POST'])
def publicar_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    errores = servicio.publicar(flujo)
    if errores:
        return jsonify({'message': 'El flujo tiene errores', 'errores': errores}), 422
    return jsonify(_resumen_flujo(flujo))


@bp.route('/flujos/<int:flujo_id>/pausar', methods=['POST'])
def pausar_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    usan = campanas.que_lo_usan(flujo)
    if usan and flujo.estado == AutFlujo.ACTIVO:
        nombres = ', '.join(f'«{c.nombre}»' for c in usan)
        return jsonify({'message': f'Lo usan campañas vigentes ({nombres}): pasá sus palabras a otro flujo '
                                   'o terminá la campaña antes de pausarlo'}), 409
    if flujo.version_publicada_id:
        flujo.estado = AutFlujo.PAUSADO
        db.session.commit()
    return jsonify(_resumen_flujo(flujo))


@bp.route('/flujos/<int:flujo_id>/activar', methods=['POST'])
def activar_flujo(flujo_id):
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    if not flujo.version_publicada_id:
        return jsonify({'message': 'Publicalo primero: no hay ninguna versión para activar'}), 409
    servicio.activar(flujo)
    return jsonify(_resumen_flujo(flujo))


@bp.route('/flujos/<int:flujo_id>', methods=['DELETE'])
def borrar_flujo(flujo_id):
    """Solo un borrador que nunca se publicó: lo publicado deja historia (ejecuciones y mensajes)."""
    flujo, error = _flujo_o_404(flujo_id)
    if error:
        return error
    if flujo.version_publicada_id:
        return jsonify({'message': 'Un flujo publicado no se borra: pausalo'}), 409
    db.session.delete(flujo)
    db.session.commit()
    return '', 204


# --- Conversaciones ---------------------------------------------------------------------------

# Hasta cuántas conversaciones trae la bandeja (de a 500, con «Cargar más»): entran 60 a 100 por día.
TOPE_BANDEJA = 2000


@bp.route('/conversaciones', methods=['GET'])
def listar_conversaciones():
    limite = min(max(request.args.get('limite', 100, type=int) or 100, 1), TOPE_BANDEJA)
    ultimo = (db.session.query(IgMensaje.contacto_id, db.func.max(IgMensaje.enviado_en).label('ultimo'),
                               db.func.min(IgMensaje.enviado_en).label('primero'),
                               db.func.count(IgMensaje.id).label('cantidad'))
              .group_by(IgMensaje.contacto_id).subquery())
    consulta = (db.session.query(IgContacto, ultimo.c.ultimo, ultimo.c.cantidad, ultimo.c.primero)
                .join(ultimo, ultimo.c.contacto_id == IgContacto.id))
    # «#palabra»: lo que el equipo ya le escribió (buscar una devolución dada a otro lead, ADR-W294).
    consulta, patron = busqueda.filtrar(consulta, request.args.get('buscar'))
    filas = consulta.order_by(ultimo.c.ultimo.desc()).limit(limite).all()
    ahora = servicio.ahora()
    ids = [c.id for c, _, _, _ in filas]
    ejecuciones = bandeja.ultimas_ejecuciones(ids)
    asignados = bandeja.asignaciones(ids)
    etiquetas = tags_service.de(TARGET_IG_CONTACT, ids)
    from app.automatizaciones import seguimientos  # importa el motor (por `escribir`): solo cuando se usa
    proximos = seguimientos.proximos(ids)
    toca = seguimientos.avisos([c for c, _, _, _ in filas])
    from app.automatizaciones import seguimientos_hechos
    # Un setter ve solo sus seguimientos (los suyos y los sin autor); quien no es setter, los de todo el equipo.
    hechos, rachas = seguimientos_hechos.resumen(ids, current_user.id if getattr(current_user, 'role', None) == 'setter' else None)
    avance = progreso.de_contactos([c for c, _, _, _ in filas], ejecuciones, ahora, current_user.id,
                                   {c.id: primero for c, _, _, primero in filas})
    # El último mensaje de cada una, en una sola consulta (antes, una por conversación). En empate, el de id mayor.
    ultimos = {m.contacto_id: m for m in IgMensaje.query.join(ultimo, db.and_(
        ultimo.c.contacto_id == IgMensaje.contacto_id, ultimo.c.ultimo == IgMensaje.enviado_en))
        .filter(IgMensaje.contacto_id.in_(ids)).order_by(IgMensaje.id).all()} if ids else {}
    cerradas = fases.cerradas([c for c, _, _, _ in filas])
    from app.automatizaciones import cliente_del_contacto
    reales = cliente_del_contacto.nombres([c for c, _, _, _ in filas])
    de_funnel = bandeja.funnels(ids)
    coinciden = busqueda.coincidencias(ids, patron)
    salida = []
    for contacto, momento, cantidad, _ in filas:
        variables = contacto.variables or {}
        ejecucion = ejecuciones.get(contacto.id)
        abierta = ejecucion if ejecucion and ejecucion.estado in AutEjecucion.ABIERTOS else None
        mensaje = ultimos.get(contacto.id)
        salida.append({
            'id': contacto.id,
            'igsid': contacto.igsid,
            'username': contacto.username,
            'nombre': contacto.nombre,
            # El nombre con que agendó en Work (ADR-W238): «👻» en WhatsApp se lee como la persona.
            'nombre_real': reales.get(contacto.id),
            'mensajes': cantidad,
            'ultimo_en': _iso(momento),
            'ultimo_texto': (mensaje.texto or '')[:140] if mensaje else '',
            # Sin texto (un audio mandado desde la app): el tipo del adjunto, para la vista previa.
            'ultimo_adjunto': next((a.get('type') for a in (mensaje.contenido or {}).get('adjuntos') or [] if isinstance(a, dict)),
                                   None) if mensaje and not mensaje.texto and isinstance(mensaje.contenido, dict) else None,
            'ultimo_de': mensaje.origen if mensaje else None,
            # Para la ventana de Instagram (24 h / 7 días) y el próximo seguimiento, a la vista en la fila.
            'ultimo_entrante_en': _iso(contacto.ultimo_entrante_en),
            'resuelta_en': _iso(contacto.resuelta_en),
            'seguimiento': proximos.get(contacto.id),
            'toca': toca.get(contacto.id),
            # Los seguimientos que ya le hizo el equipo, por fase ({fase: {n, en, resp}}): el filtro del Inbox (ADR-W254).
            'seguimientos_hechos': hechos.get(contacto.id) or {},
            # Lo que le escribió el equipo desde su última respuesta ({n, desde, ultimo}; None si lo último es del lead):
            # «Les escribiste y no contestan» y cuántos seguimientos van (Mario, 27/11/2026).
            'racha': rachas.get(contacto.id),
            'bot_pausado': bool(contacto.bot_pausado_hasta and contacto.bot_pausado_hasta > ahora),
            # El broadcast de WhatsApp al que respondió (ADR-W259): la etiqueta del taller o «Broadcast».
            'broadcast': variables.get('broadcast_nombre') or ('Broadcast' if variables.get('broadcast') else None),
            'examen': variables.get('examen'),
            # De qué funnel es el anuncio del que vino (ADR-W287): 'direct' (venta directa) o 'lead_magnet'.
            'funnel': de_funnel.get(contacto.id),
            'califica': variables.get('_califica'),
            'flujo': ejecucion.version.flujo.nombre if ejecucion else None,
            'paso': bandeja.paso(abierta),
            # El último recorrido, abierto o no: la bandeja marca los cortados (error, ventana vencida).
            'ejecucion': bandeja.resumen_ejecucion(ejecucion),
            'asignado': asignados.get(contacto.id),
            'canal': fases.canal(contacto, asignados.get(contacto.id)),
            'etiquetas': etiquetas.get(str(contacto.id), []),
            # No lead / In-abrible sin mensajes nuevos del lead: sale de la bandeja (pedido de Mario, 25/11).
            'cerrada': contacto.id in cerradas,
            # Con «#texto»: el mensaje del equipo que coincide, para verlo y copiarlo desde la fila.
            'coincide': coinciden.get(contacto.id),
            **avance.get(contacto.id, {}),
        })
    return jsonify({'conversaciones': salida, 'mediana_respuesta': bandeja.mediana_respuesta(ahora),
                    'medianas_setters': bandeja.medianas_por_setter(ahora),
                    'human_agent': escribir.human_agent_aprobado()})


@bp.route('/conversaciones/<int:contacto_id>', methods=['GET'])
def ver_conversacion(contacto_id):
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return jsonify({'message': 'Not found'}), 404
    mensajes = (IgMensaje.query.filter_by(contacto_id=contacto.id)
                .order_by(IgMensaje.enviado_en.desc(), IgMensaje.id.desc()).limit(MENSAJES_POR_CONVERSACION).all())
    mensajes = list(reversed(mensajes))
    recorrido = bandeja.recorrido(contacto.id)
    elegidos = bandeja.elegidos(mensajes)
    comentarios = bandeja.comentarios(mensajes)
    from app.automatizaciones import seguimientos_hechos
    numeros = seguimientos_hechos.numerados(mensajes)
    from app.whatsapp import medios  # WhatsApp: a qué mensaje responde y el sticker/foto/audio que mandó
    citas = medios.citas(mensajes, contacto.id)
    from app.automatizaciones import cliente_del_contacto
    from app.automatizaciones import api_trabajo  # cuelga de `bp`: importarlo arriba sería circular
    notas, tareas = api_trabajo.historial(contacto.id)
    from app.automatizaciones import api_fases, seguimientos
    asignado = bandeja.asignaciones([contacto.id]).get(contacto.id)
    return jsonify({
        'seguimientos': seguimientos.de_contacto(contacto.id),
        'avance': progreso.uno(contacto, servicio.ahora(), current_user.id),
        'notas': notas,
        'tareas': tareas,
        # Lo del setting (ADR-W184): el canal, los cambios de fase y las citas para la venta.
        'canal': fases.canal(contacto, asignado),
        'fases': fases.historial(contacto.id),
        'citas': api_fases.citas(contacto.id),
        'contacto': {
            'id': contacto.id, 'igsid': contacto.igsid, 'username': contacto.username, 'nombre': contacto.nombre,
            'variables': contacto.variables or {}, 'ultimo_entrante_en': _iso(contacto.ultimo_entrante_en),
            'bot_pausado_hasta': _iso(contacto.bot_pausado_hasta), 'resuelta_en': _iso(contacto.resuelta_en),
        },
        'asignado': asignado,
        # Con qué palabra clave entró (y de qué campaña), para mostrarla arriba de la tarjeta (ADR-W246).
        'entrada': bandeja.entrada(contacto.id),
        'cliente': cliente_del_contacto.de(contacto),
        'etiquetas': tags_service.de(TARGET_IG_CONTACT, [contacto.id]).get(str(contacto.id), []),
        'ejecucion': recorrido[0] if recorrido else None,
        'recorrido': recorrido,
        'mensajes': [{
            'id': m.id, 'direccion': m.direccion, 'origen': m.origen, 'texto': m.texto,
            'adjuntos': [a.get('type') for a in (m.contenido or {}).get('adjuntos') or []]
            if isinstance(m.contenido, dict) else [],
            'botones': _botones(m.contenido), 'en': _iso(m.enviado_en), 'nodo_id': m.nodo_id,
            'autor': m.autor.username if m.autor_id and m.autor else None,
            'autor_id': m.autor_id,
            # Del bot: el botón que tocó el lead. Del lead: qué activó en el flujo (`efectos.py`).
            'elegido': elegidos.get(m.id),
            # Vino de un comentario en una publicación, no de un DM: no siempre se le puede escribir.
            'comentario': comentarios.get(m.id),
            'efecto': (m.contenido or {}).get('efecto') if isinstance(m.contenido, dict) else None,
            'responde_a': citas.get(m.id),
            'medio': medios.para_chat(m, contacto.id),
            # Del equipo: «Seguimiento N» si cuenta como tal, y la marca a mano (ADR-W255).
            'seguimiento': numeros.get(m.id), 'marca': m.seguimiento,
        } for m in mensajes],
    })


def _botones(contenido):
    """Los títulos de los botones de un mensaje que mandó el motor."""
    if not isinstance(contenido, dict):
        return []
    if contenido.get('quick_replies'):
        return [b.get('title') for b in contenido['quick_replies']]
    plantilla = (contenido.get('attachment') or {}).get('payload') or {}
    return [b.get('title') for b in plantilla.get('buttons') or []]
