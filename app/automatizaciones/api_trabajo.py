"""Lo que el setter trabaja sobre una conversación, como en Kommo (27/10/2026): leerla, reasignarla,
moverla de sub-etapa, corregir sus variables, notas internas y tareas. Cada cambio deja un evento en el
historial del chat. Colgado del blueprint del Inbox; el setter llega por `ACCIONES_DEL_SETTER`."""
from datetime import datetime, timezone

from flask import jsonify, request
from flask_login import current_user

from app import db
from app.automatizaciones import progreso, reparto, servicio
from app.automatizaciones.api import bp
from app.automatizaciones.modelos import IgContacto
from app.automatizaciones.registro import PREFIJO
from app.models import Conversation, User
from app.models.inbox_work import EVENT, NOTE, InboxRead, Note, Task
from app.models.tag import TARGET_IG_CONTACT

LARGO_NOTA = 2000
LARGO_VARIABLE = 200
# En las variables del contacto: quién corrigió cada una a mano ({campo: username}).
EDITADAS = '_editadas'
NOMBRES_ETAPA = {'con_bot': 'Con el bot', 'conversando': 'En conversación', 'link': 'Link enviado', 'agendo': 'Agendó'}


def _cuerpo():
    datos = request.get_json(silent=True)
    return datos if isinstance(datos, dict) else {}


def _iso(fecha):
    return fecha.isoformat() + 'Z' if fecha else None


def _contacto_o_404(contacto_id):
    contacto = db.session.get(IgContacto, contacto_id)
    if contacto is None:
        return None, (jsonify({'message': 'Not found'}), 404)
    return contacto, None


def evento(contacto_id, texto):
    db.session.add(Note(target_type=TARGET_IG_CONTACT, target_id=str(contacto_id), kind=EVENT, body=texto[:LARGO_NOTA],
                        created_by=current_user.id))


def nota_json(n):
    return {'id': n.id, 'tipo': n.kind, 'texto': n.body, 'autor': n.author.username if n.author else None, 'en': _iso(n.created_at)}


def tarea_json(t, contacto=None):
    salida = {'id': t.id, 'titulo': t.title, 'vence': _iso(t.due_at), 'hecha': t.done_at is not None,
              'asignada': {'id': t.assignee.id, 'username': t.assignee.username} if t.assignee else None,
              'contacto_id': int(t.target_id), 'en': _iso(t.created_at)}
    if contacto is not None:
        salida['contacto'] = {'username': contacto.username, 'nombre': contacto.nombre}
    return salida


def historial(contacto_id):
    """Notas, eventos y tareas de la conversación, para intercalar con los mensajes del chat."""
    notas = (Note.query.filter_by(target_type=TARGET_IG_CONTACT, target_id=str(contacto_id))
             .order_by(Note.created_at).limit(300).all())
    tareas = (Task.query.filter_by(target_type=TARGET_IG_CONTACT, target_id=str(contacto_id))
              .order_by(Task.created_at).limit(100).all())
    return [nota_json(n) for n in notas], [tarea_json(t) for t in tareas]


@bp.route('/conversaciones/<int:contacto_id>/leido', methods=['POST'])
def marcar_leido(contacto_id):
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    lectura = db.session.get(InboxRead, (current_user.id, contacto.id))
    if lectura is None:
        db.session.add(InboxRead(user_id=current_user.id, contact_id=contacto.id, read_at=servicio.ahora()))
    else:
        lectura.read_at = servicio.ahora()
    db.session.commit()
    return '', 204


@bp.route('/conversaciones/<int:contacto_id>/asignar', methods=['POST'])
def asignar_conversacion(contacto_id):
    """`setter_id`: a quién pasa (null: sin asignar). Manda sobre el reparto hasta una entrada nueva."""
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    setter_id = _cuerpo().get('setter_id')
    setter = None
    if setter_id is not None:
        setter = next((u for u in reparto.setters_activos() if u.id == setter_id), None)
        if setter is None:
            return jsonify({'message': 'Elegí un setter activo'}), 400
    contacto.setter_id = setter.id if setter else None
    contacto.asignado_en = servicio.ahora()
    lead = Conversation.query.filter_by(external_id=f'{PREFIJO}{contacto.igsid}').first()
    if lead is not None:
        lead.setter = setter.username if setter else None
    evento(contacto.id, f'Reasignada a {setter.username}' if setter else 'Quedó sin asignar')
    db.session.commit()
    return jsonify({'asignado': {'id': setter.id, 'username': setter.username, 'a_mano': True} if setter else None})


@bp.route('/conversaciones/<int:contacto_id>/etapa', methods=['PUT'])
def mover_etapa(contacto_id):
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    etapa = _cuerpo().get('etapa')
    if etapa not in progreso.ETAPAS:
        return jsonify({'message': 'Etapa desconocida'}), 400
    contacto.etapa = etapa
    evento(contacto.id, f'Sub-etapa: {NOMBRES_ETAPA[etapa]}')
    db.session.commit()
    return jsonify(progreso.uno(contacto, servicio.ahora(), current_user.id))


@bp.route('/conversaciones/<int:contacto_id>/variables', methods=['PUT'])
def corregir_variable(contacto_id):
    """Corrige una variable que guardó el flujo (o carga una que falta). El bot usa el valor nuevo."""
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    datos = _cuerpo()
    campo = str(datos.get('campo') or '').strip()
    valor = str(datos.get('valor') or '').strip()[:LARGO_VARIABLE]
    if not campo or campo.startswith('_') or len(campo) > 60:
        return jsonify({'message': 'Variable inválida'}), 400
    variables = dict(contacto.variables or {})
    if valor:
        variables[campo] = valor
    else:
        variables.pop(campo, None)
    variables[EDITADAS] = {**(variables.get(EDITADAS) or {}), campo: current_user.username}
    contacto.variables = variables
    evento(contacto.id, f'{{{campo}}} = {valor or "—"}')
    db.session.commit()
    return jsonify({'variables': variables})


@bp.route('/conversaciones/<int:contacto_id>/notas', methods=['POST'])
def crear_nota(contacto_id):
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    texto = str(_cuerpo().get('texto') or '').strip()
    if not texto:
        return jsonify({'message': 'La nota está vacía'}), 400
    nota = Note(target_type=TARGET_IG_CONTACT, target_id=str(contacto.id), kind=NOTE, body=texto[:LARGO_NOTA],
                created_by=current_user.id)
    db.session.add(nota)
    db.session.commit()
    return jsonify(nota_json(nota)), 201


def _fecha(valor):
    if not valor:
        return None
    try:
        fecha = datetime.fromisoformat(str(valor).replace('Z', '+00:00'))
    except ValueError:
        return False
    return fecha.astimezone(timezone.utc).replace(tzinfo=None) if fecha.tzinfo else fecha


@bp.route('/conversaciones/<int:contacto_id>/tareas', methods=['POST'])
def crear_tarea(contacto_id):
    contacto, error = _contacto_o_404(contacto_id)
    if error:
        return error
    datos = _cuerpo()
    titulo = str(datos.get('titulo') or '').strip()[:200]
    vence = _fecha(datos.get('vence'))
    if not titulo or vence is False:
        return jsonify({'message': 'La tarea necesita un título y una fecha válida'}), 400
    asignada = datos.get('asignada_a') or current_user.id
    if db.session.get(User, asignada) is None:
        return jsonify({'message': 'Elegí a quién se la asignás'}), 400
    tarea = Task(target_type=TARGET_IG_CONTACT, target_id=str(contacto.id), title=titulo, due_at=vence,
                 assigned_to=asignada, created_by=current_user.id)
    db.session.add(tarea)
    db.session.commit()
    return jsonify(tarea_json(tarea)), 201


@bp.route('/tareas/<int:tarea_id>', methods=['PUT'])
def cambiar_tarea(tarea_id):
    tarea = db.session.get(Task, tarea_id)
    if tarea is None:
        return jsonify({'message': 'Not found'}), 404
    hecha = bool(_cuerpo().get('hecha'))
    tarea.done_at = servicio.ahora() if hecha else None
    tarea.done_by = current_user.id if hecha else None
    db.session.commit()
    return jsonify(tarea_json(tarea))


@bp.route('/tareas', methods=['GET'])
def mis_tareas():
    """Las tareas abiertas asignadas a quien pregunta, de la que vence primero a la última."""
    tareas = (Task.query.filter(Task.target_type == TARGET_IG_CONTACT, Task.assigned_to == current_user.id,
                                Task.done_at.is_(None))
              .order_by(Task.due_at.is_(None), Task.due_at).limit(100).all())
    contactos = {c.id: c for c in IgContacto.query.filter(IgContacto.id.in_([int(t.target_id) for t in tareas])).all()} if tareas else {}
    return jsonify({'tareas': [tarea_json(t, contactos.get(int(t.target_id))) for t in tareas]})
