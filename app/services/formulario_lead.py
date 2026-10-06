"""El formulario de calificación de un lead, venga del modelo viejo o del nuevo (híbrido).

- Viejo (Calendly + n8n): `Client.form_data`, UN JSON por cliente con claves fijas (examen, puntaje,
  inversion…) que cada envío pisa. Ver POST /public/financial-agendas-form.
- Nuevo (Agendas 2.0): cada agenda guarda su formulario en `Appointment.agenda_payload` (preguntas y
  respuestas de ese momento) y el cliente una copia del último en `Client.formulario_payload`.

`form_data_de` devuelve siempre la forma vieja (un dict pregunta → respuesta, con `fuente_form` y
`submitted_at`), así que quien ya lee `form_data` (la ficha, el mazo, las estadísticas del workshop)
sigue igual: una agenda nueva se lee de su payload; una vieja, de `form_data`.
"""

from app import db


def es_payload(p):
    return isinstance(p, dict) and isinstance(p.get('respuestas'), list) and 'version' in p


def _fuente(payload):
    """Lo mismo que la «Fuente» de la agenda (operacion._fuente): el setter si entró por su link; si no,
    según el tipo del funnel (workshop, vsl…)."""
    from app.agendas_v2.operacion import _fuente as fuente_de_agenda
    from app.models import User

    setter_id = payload.get('setter_user_id')
    return fuente_de_agenda(payload, db.session.get(User, setter_id) if setter_id else None)


def desde_payload(payload, enviado=None):
    """El payload de Agendas 2.0 con la forma de `form_data`."""
    lead = payload.get('lead') or {}
    fd = {r['pregunta']: r['respuesta'] for r in payload.get('respuestas') or [] if r.get('respuesta')}
    fd.update({
        'nombre': lead.get('nombre'),
        'telefono': lead.get('telefono'),
        'mail': lead.get('email'),
        'instagram': lead.get('instagram'),
        'fuente_form': _fuente(payload),
        'submitted_at': payload.get('enviado') or (enviado.isoformat() if enviado else None),
    })
    return fd


def form_data_de(client, appt=None):
    """El formulario a mostrar: el de esa agenda si es de Agendas 2.0; si no, el último de Agendas
    2.0 del cliente; si no, el viejo `form_data`."""
    if appt is not None and es_payload(appt.agenda_payload):
        return desde_payload(appt.agenda_payload, appt.created_at)
    if client is not None and es_payload(getattr(client, 'formulario_payload', None)):
        return desde_payload(client.formulario_payload)
    return client.form_data if (client is not None and isinstance(client.form_data, dict)) else {}
