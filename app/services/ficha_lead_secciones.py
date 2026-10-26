"""Las secciones de la ficha del lead que son puro repaso del pasado: Historial, Formulario y
Comunicacion.

Viven aparte de `ficha_lead_service.py` por el limite de 500 lineas por archivo, y el corte no es
arbitrario: estas tres secciones son de solo lectura del pasado del lead y no participan de ninguna
decision (ni del estado, ni de las pestanas, ni de los permisos). Las que si —identidad, estado,
confirmacion, resultado y cobro— se quedaron juntas, porque comparten la deuda, las ventas y el
estado de la agenda que se calculan una sola vez.
"""
from app import db
from app.models import LeadEventLog, SurveyAnswer, SurveyQuestion, User
from app.services.estado_lead import estado_de_agenda
from app.services.ficha_vocabulario import etiqueta_de_fuente

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
    'archivada_sin_reporte': ('Archivada sin reporte', 'idle'),
    'descalificada': ('Descalificada', 'error'),
    'sin_reportar': ('Sin reportar', 'error'),
    'reportada_sin_resultado': ('Reportada · sin resultado', 'warning'),
    'por_confirmar': ('Por confirmar', 'idle'),
    'confirmada': ('Confirmada', 'info'),
}


def _chip_de_agenda(label, tono, estado):
    """El chip de la fila, con su tooltip (`ayuda`) en los estados que hay que explicar: los mismos
    del vocabulario del libro de registros, para que la ficha y la tabla digan lo mismo."""
    from app.services.closer_agendas_service import AYUDA_ESTADO

    chip = {'label': label, 'tone': tono}
    if estado in AYUDA_ESTADO:
        chip['ayuda'] = AYUDA_ESTADO[estado]
    return chip


def tiene_seguimiento(appt):
    """Si esta agenda tiene un seguimiento registrado.

    Un seguimiento no es una fila propia: vive en columnas de `Appointment`, UNO por agenda (ver
    `ficha_seguimientos_service`). Cuenta como registrado si tiene fecha, nota o tipo. El tipo
    solo, sin fecha ni nota, es un seguimiento de verdad: es lo que deja «Programar seguimiento»
    sin fecha, y el closer lo ve en el pool de su pestaña Seguimientos como «Asignar fecha».

    La misma regla decide qué filas lista el historial y sobre qué agenda hay algo que corregir:
    si fueran dos, la ficha podría mostrar un seguimiento que la corrección dice que no existe.
    """
    return bool(appt.fecha_seguimiento or appt.seguimiento_sub or appt.seguimiento_tipo)


def historial(appts, ahora, tiene_venta=False, cerro=False):
    """Agendas, seguimientos y bitácora de TODAS las agendas del cliente.

    `tiene_venta` es el «¿este cliente ya compró?» que la ficha resolvió una sola vez con su cruce
    de ventas. Con él se clasifica cada seguimiento como lo clasifica la pestaña Seguimientos del
    closer (`CloserFollowUpService._effective_tipo`) sin una consulta a las ventas por agenda.
    `cerro` es más estricto: una venta de verdad (completo o split pay) o una seña, la cuenta del
    hito de Cierre. Decide a qué agenda se le puede agregar la objeción de un «No cerró».
    """
    from app.services import objeciones_service
    from app.services.closer_followup_service import CloserFollowUpService
    from app.services.comercial_service import post_call_de, pre_call_de

    objeciones = objeciones_service.objeciones_por_agenda([a.id for a in appts])
    agendas, seguimientos = [], []
    for a in appts:
        # El tipo con el que un seguimiento de esta agenda cae en la pestaña Seguimientos: el que
        # tiene escrito o, si nunca se le programó uno, el que se deduce de cómo fue la llamada.
        tipo_efectivo = CloserFollowUpService._effective_tipo(a, has_sale=tiene_venta)
        estado = estado_de_agenda(a, ahora)
        if a.start_time and a.start_time > ahora and estado in ('por_confirmar', 'confirmada'):
            label, tono = 'Próxima', 'info'
        else:
            label, tono = _CHIP_AGENDA.get(estado, (str(estado), 'idle'))
        detalle = ' · '.join(p for p in (a.origin, a.closer.username if a.closer else None) if p)
        # `pre_call` y `post_call` son las dos CLAVES con las que se corrige el estado de esta
        # agenda desde el historial (mismo vocabulario que el libro de registros, para que una
        # correccion diga lo mismo desde las dos pantallas). El chip se queda: es el estado
        # derivado, que no siempre coincide con ninguno de los dos campos sueltos.
        agendas.append({'id': a.id, 'fecha': _iso(a.start_time), 'detalle': detalle or 'Sin detalle',
                        'chip': _chip_de_agenda(label, tono, estado),
                        'pre_call': pre_call_de(a),
                        'post_call': post_call_de(estado, False),
                        'closer': a.closer.username if a.closer else None,
                        # El id y no solo el nombre: es con lo que la fila arranca elegido el
                        # closer cuando se corrige la agenda (`PATCH /ficha/<id>/agenda`).
                        'closer_id': a.closer_id,
                        'fuente': a.origin or None,
                        # Como se lee, igual que en la cabecera. La lista de fuentes que viaja en
                        # el vocabulario ya no trae todas (la grabación del workshop, el setting
                        # sin setter y «Desconocido» no se ofrecen), y sin esto la fila de una
                        # agenda que tiene una de esas mostraba la clave cruda.
                        'fuente_label': etiqueta_de_fuente(a.origin),
                        # Con qué tipo arranca «Agendar seguimiento» sobre esta agenda. Si la
                        # llamada no dice nada (todavía no pasó, o fue una venta), un cliente
                        # que ya compró es cobranza y el resto, recuperación.
                        'tipo_seguimiento': tipo_efectivo
                        or ('cerrada' if tiene_venta else 'no_tomada'),
                        # La objeción vigente de esta llamada ({texto, autor, fecha}) y si se le
                        # puede agregar una: asistió y no cerró (ver `objeciones_service`).
                        'objecion': objeciones.get(a.id),
                        'admite_objecion': objeciones_service.admite_objecion(a, estado, cerro)})
        if tiene_seguimiento(a):
            seguimientos.append({
                # De qué agenda es: con ese id se corrige (`PATCH /ficha/<id>/seguimiento`), y
                # la fecha es para que la fila diga de cuál de las llamadas del cliente cuelga.
                'agenda_id': a.id,
                'agenda_fecha': _iso(a.start_time),
                'fecha': a.fecha_seguimiento or None,
                # No hay columna de canal: los seguimientos se registran sin medio. Se devuelve
                # None en vez de inventar "WhatsApp", que es lo que mas se usa pero no es un dato.
                'canal': None,
                'nota': a.seguimiento_sub or None,
                # None cuando no lo dicen ni la columna ni la llamada; la fila lo muestra «sin
                # tipo» en vez de adivinar uno.
                'tipo': tipo_efectivo,
                'realizado': bool(a.seguimiento_realizado),
                'intento': a.seguimiento_intento or 1,
            })

    ids = [a.id for a in appts]
    eventos = []
    if ids:
        # `to_dict()` habla en `description` / `action_type` / `created_at`, y el historial lee
        # `detalle` / `fecha` como en las otras tres secciones. Mandando el dict crudo, la columna
        # del detalle salia VACIA en los 1.573 eventos de la base —ninguno tiene la descripcion
        # vacia— y el registro parecia una lista de fechas sueltas.
        eventos = [{'id': e.id,
                    'fecha': _iso(e.created_at),
                    'tipo': e.action_type,
                    'detalle': e.description,
                    'autor': (e.user.username if e.user else 'Sistema')}
                   for e in LeadEventLog.query
                   .filter(LeadEventLog.appointment_id.in_(ids))
                   .order_by(LeadEventLog.created_at.desc()).all()]
    return {'agendas': agendas, 'seguimientos': seguimientos, 'eventos': eventos}


# --- Formulario de origen ---------------------------------------------------------------------

def formulario(client, appt=None):
    """Las respuestas del formulario: las de esa agenda si es de Agendas 2.0, si no las del viejo
    `form_data` (ver app/services/formulario_lead.py)."""
    from app.api.closer import _form_data_has_useful_answers, _recover_form_data_by_contact
    from app.services.formulario_lead import form_data_de

    form_data = form_data_de(client, appt)
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
    """El hilo del equipo: las notas del log de la persona (docs/plan_notas_avisos_settings.md), de todas sus
    agendas y de la persona misma, con a quién se le avisó de cada una."""
    from app.services import avisos_service, lead_log_service

    entradas = lead_log_service.notas_de(client.person_uuid if client else getattr(appt, 'person_uuid', None))
    notificados = avisos_service.destinatarios_de_log([e.id for e in entradas])
    return [{'id': f'log-{e.id}', 'autor': e.user.username if e.user else 'Sistema',
             'rol': e.user.role if e.user else 'system', 'fecha': _iso(e.created_at),
             'texto': e.description, 'notificados': notificados.get(e.id, [])} for e in entradas]


def equipo():
    usuarios = (User.query.filter(User.role.in_(ROLES_EQUIPO_NOTAS), User.is_active.isnot(False))
                .order_by(User.username).all())
    return [{'id': u.id, 'nombre': u.username, 'rol': u.role} for u in usuarios]
