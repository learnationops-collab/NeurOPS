"""Las secciones de la ficha del lead que son puro repaso del pasado: Historial, Formulario y
Comunicacion.

Viven aparte de `ficha_lead_service.py` por el limite de 500 lineas por archivo, y el corte no es
arbitrario: estas tres secciones son de solo lectura del pasado del lead y no participan de ninguna
decision (ni del estado, ni de las pestanas, ni de los permisos). Las que si —identidad, estado,
confirmacion, resultado y cobro— se quedaron juntas, porque comparten la deuda, las ventas y el
estado de la agenda que se calculan una sola vez.
"""
from datetime import datetime

from app import db
from app.models import ClientComment, Comment, CommentNotification, LeadEventLog, SurveyAnswer, SurveyQuestion, User
from app.services.estado_lead import estado_de_agenda

# Etiquetas de `Client.form_data` (el formulario de calificacion que llega por n8n). Estaban solo
# en el JS (`CloserWorkflowPage.jsx` y `FormsManagementPage`): el orden de este dict es el orden en
# que se muestran las respuestas.
ETIQUETAS_FORMULARIO = {
    'examen': 'Examen / Dolor principal',
    'puntaje': 'Puntaje / Calificación',
    'profesion': 'Profesión',
    'empleo': 'Empleo actual',
    'formacion': 'Formación requerida / Meta',
    'interes': 'Interés',
    'inversion': 'Capacidad de inversión',
    'apoyo': 'Apoyo / Red familiar',
}
# Claves de `form_data` que no son respuestas: contacto ya visible en la cabecera, o metadata.
FORMULARIO_OCULTO = frozenset({'nombre', 'telefono', 'instagram', 'fuente_form', 'submitted_at'})

# Roles cuyas personas aparecen en el selector "Notificar a" del hilo de notas.
ROLES_EQUIPO_NOTAS = ('closer', 'setter', 'triage')


def _iso(valor):
    return valor.isoformat() if valor else None


# --- Historial --------------------------------------------------------------------------------

# Chip de cada fila de la seccion "Agendas" del historial. Sale del estado del libro de agendas
# (`derivar_estado`), no de un vocabulario nuevo: la ficha y la tabla dicen lo mismo de la misma
# agenda.
_CHIP_AGENDA = {
    'show_up': ('Asistió', 'success'),
    'no_show': ('No show', 'error'),
    'segunda_llamada': ('2da llamada', 'info'),
    'reagendada': ('Reprogramó', 'warning'),
    'cancelada': ('Canceló', 'warning'),
    'lead_perdido': ('Lead perdido', 'error'),
    'no_lead': ('No lead', 'error'),
    'sin_reportar': ('Sin reportar', 'error'),
    'reportada_sin_resultado': ('Reportada · sin resultado', 'warning'),
    'por_confirmar': ('Por confirmar', 'idle'),
    'confirmada': ('Confirmada', 'info'),
    'otro': ('Otro estado', 'idle'),
}


def historial(appts, ahora):
    agendas, seguimientos = [], []
    for a in appts:
        estado = estado_de_agenda(a, ahora)
        if a.start_time and a.start_time > ahora and estado in ('por_confirmar', 'confirmada'):
            label, tono = 'Próxima', 'info'
        else:
            label, tono = _CHIP_AGENDA.get(estado, (str(estado), 'idle'))
        detalle = ' · '.join(p for p in (a.origin, a.closer.username if a.closer else None) if p)
        agendas.append({'id': a.id, 'fecha': _iso(a.start_time), 'detalle': detalle or 'Sin detalle',
                        'chip': {'label': label, 'tone': tono}})
        if a.fecha_seguimiento or a.seguimiento_sub:
            seguimientos.append({
                'fecha': a.fecha_seguimiento,
                # No hay columna de canal: los seguimientos se registran sin medio. Se devuelve
                # None en vez de inventar "WhatsApp", que es lo que mas se usa pero no es un dato.
                'canal': None,
                'nota': a.seguimiento_sub or None,
                'realizado': bool(a.seguimiento_realizado),
                'intento': a.seguimiento_intento or 1,
            })

    ids = [a.id for a in appts]
    eventos = []
    if ids:
        eventos = [e.to_dict() for e in LeadEventLog.query
                   .filter(LeadEventLog.appointment_id.in_(ids))
                   .order_by(LeadEventLog.created_at.desc()).all()]
    return {'agendas': agendas, 'seguimientos': seguimientos, 'eventos': eventos}


# --- Formulario de origen ---------------------------------------------------------------------

def formulario(client):
    from app.api.closer import _form_data_has_useful_answers, _recover_form_data_by_contact

    form_data = client.form_data if (client and isinstance(client.form_data, dict)) else {}
    if client and not _form_data_has_useful_answers(form_data):
        # Mismo rescate que hace el modal del mazo: el formulario a veces quedo en otro Client con
        # el mismo contacto. Solo para una ficha puntual (en una lista seria un N+1).
        form_data = _recover_form_data_by_contact(client) or form_data

    respuestas = []
    vistas = set()
    for clave, pregunta in ETIQUETAS_FORMULARIO.items():
        if form_data.get(clave) not in (None, '', 'n/a'):
            respuestas.append({'clave': clave, 'pregunta': pregunta, 'respuesta': form_data[clave]})
            vistas.add(clave)
    # Cualquier campo nuevo que n8n empiece a mandar se muestra igual, con su clave como pregunta:
    # perderlo por no estar en la tabla de etiquetas seria perder la respuesta.
    for clave, valor in (form_data or {}).items():
        if clave in vistas or clave in FORMULARIO_OCULTO or valor in (None, '', 'n/a'):
            continue
        respuestas.append({'clave': clave, 'pregunta': clave, 'respuesta': valor})

    encuesta = []
    if client:
        filas = (db.session.query(SurveyAnswer, SurveyQuestion)
                 .join(SurveyQuestion).filter(SurveyAnswer.client_id == client.id).all())
        encuesta = [{'pregunta': q.text, 'respuesta': a.answer} for a, q in filas]

    return {'fuente_form': (form_data or {}).get('fuente_form'),
            'respuestas': respuestas, 'encuesta': encuesta}


# --- Comunicacion -----------------------------------------------------------------------------

def notas(client, appt):
    """El hilo del equipo, juntando las tres tablas donde hoy viven las notas de un lead.

    `ClientComment` (hilo del cliente, con notificaciones), `Comment` type 'client' (lo que escribe
    el mazo al guardar `closer_notes`) y `Comment` type 'appointment' (el hilo de la agenda). Estan
    separadas por historia, no por diseno: el modal las muestra como una sola conversacion.
    """
    filas = []
    if client:
        notificados = {}
        for n in CommentNotification.query.filter_by(client_id=client.id).all():
            notificados.setdefault(n.comment_id, []).append(n.user.username if n.user else None)
        comentarios = ClientComment.query.filter_by(client_id=client.id).all()
        # `ClientComment` no tiene relacion con User: se resuelven todos los autores de una vez en
        # vez de una consulta por comentario.
        autores = {u.id: u for u in User.query.filter(
            User.id.in_({c.author_id for c in comentarios})).all()} if comentarios else {}
        for c in comentarios:
            autor = autores.get(c.author_id)
            filas.append((c.created_at, {
                'id': f'cc-{c.id}', 'autor': autor.username if autor else 'Sistema',
                'rol': autor.role if autor else 'system',
                'fecha': _iso(c.created_at), 'texto': c.text,
                'notificados': [u for u in notificados.get(c.id, []) if u]}))

    objetivos = []
    if client:
        objetivos.append(('client', client.id))
    if appt:
        objetivos.append(('appointment', appt.id))
    for tipo, oid in objetivos:
        for c in Comment.query.filter_by(comment_type=tipo, associated_id=oid).all():
            filas.append((c.created_at, {
                'id': f'{tipo}-{c.id}', 'autor': c.author.username if c.author else 'Sistema',
                'rol': c.author.role if c.author else 'system',
                'fecha': _iso(c.created_at), 'texto': c.text, 'notificados': []}))

    filas.sort(key=lambda f: f[0] or datetime.min)
    return [nota for _, nota in filas]


def equipo():
    usuarios = (User.query.filter(User.role.in_(ROLES_EQUIPO_NOTAS), User.is_active.isnot(False))
                .order_by(User.username).all())
    return [{'id': u.id, 'nombre': u.username, 'rol': u.role} for u in usuarios]
