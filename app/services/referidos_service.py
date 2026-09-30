"""Crear un referido: el lead nuevo que deja alguien con quien ya se hablo.

Vive aca y no en la ruta porque lo usan dos puertas: el mazo del closer
(`POST /closer/deck/referrals/manual`) y la ficha del lead, que al declarar una venta o reportar una
llamada pregunta "¿le pediste referidos?". Con dos copias, el referido que entra por una terminaria
con otro dueno, u otro origen, que el que entra por la otra — y el origen `Referido de ...` es lo
que cuentan las metricas de referidos del closer.
"""
from datetime import datetime

from app import db


class ReferidoInvalido(ValueError):
    """Falta el lead de origen o el nombre: el pedido no alcanza para crear a nadie."""


def _separar_contacto(contacto):
    """(telefono, instagram) de un campo de contacto libre.

    El flujo rapido de "¿le pediste referidos?" manda un unico texto (un instagram o un telefono)
    sin obligar nada: si tiene arroba o letras es un instagram, y si son solo numeros, un telefono.
    """
    contacto = (contacto or '').strip()
    if not contacto:
        return None, None
    solo_numeros = contacto.replace('+', '').replace(' ', '').replace('-', '')
    if '@' in contacto or not solo_numeros.isdigit():
        return None, contacto.replace('@', '').strip() or None
    return contacto, None


def crear_referido(usuario, from_lead_id, nombre, contacto='', phone=None, instagram=None,
                   email=None, notas=''):
    """Crea el cliente y la agenda del referido, y deja el aviso en el perfil de quien lo refirio.

    NO comitea: la ficha crea los referidos en el mismo guardado que la venta o el reporte, y es
    quien la llama la que cierra la transaccion.

    `contacto` es el campo libre del flujo rapido; solo se mira si no llego ninguno de los tres
    explicitos (`phone`, `instagram`, `email`), que son los del modal "Referido manual".
    """
    from app.models import Appointment, Client, Comment, User
    from app.services.booking_service import BookingService

    nombre = (nombre or '').strip()
    contacto = (contacto or '').strip()
    phone = (phone or '').strip() or None
    instagram = (instagram or '').strip().replace('@', '') or None
    email = (email or '').strip() or None
    notas = (notas or '').strip()

    if not from_lead_id:
        raise ReferidoInvalido('Selecciona el lead origen del referido')
    if not nombre:
        raise ReferidoInvalido('El nombre del referido es obligatorio')

    origen = Appointment.query.get(from_lead_id)
    if origen and origen.client:
        quien_refiere = origen.client
    else:
        quien_refiere = Client.query.get(from_lead_id)
    nombre_de_quien_refiere = quien_refiere.full_name if quien_refiere else f'Lead #{from_lead_id}'

    if not phone and not instagram and contacto:
        phone, instagram = _separar_contacto(contacto)

    contacto_visible = contacto or ', '.join(filter(None, [
        phone, f'@{instagram}' if instagram else None, email])) or 'N/A'

    cliente = BookingService.find_or_create_client(nombre=nombre, email=email,
                                                   instagram=instagram, phone=phone)

    # closer_id es NOT NULL en la base: un admin, un setter o la direccion comercial creando el
    # referido a nombre de otro no pueden dejarlo sin dueno (quedaria huerfano, invisible en
    # cualquier pool de Seguimientos). Hereda el closer del lead que lo refirio, y si tampoco
    # tiene, cae al mismo respaldo que `BookingService.sync_financial_agenda_to_appointment`.
    closer_id = usuario.id if usuario.role == 'closer' else (origen.closer_id if origen else None)
    if not closer_id:
        respaldo = (User.query.filter_by(role='closer').first()
                    or User.query.filter_by(role='admin').first())
        closer_id = respaldo.id if respaldo else usuario.id

    agenda = Appointment(
        closer_id=closer_id,
        client_id=cliente.id,
        start_time=datetime.utcnow(),
        origin=f'Referido de {nombre_de_quien_refiere}',
        last_stage='Nueva',
        closer_notes=(f'Referido por {nombre_de_quien_refiere}. Contacto: {contacto_visible}. '
                      f'Notas: {notas}'),
        closer_processed=False,
    )
    db.session.add(agenda)

    if quien_refiere:
        db.session.add(Comment(
            text=(f"💡 Referencia otorgada: creó un nuevo referido '{nombre}' "
                  f'({contacto_visible}). Contexto: {notas}'),
            comment_type='client',
            associated_id=quien_refiere.id,
            author_id=usuario.id,
        ))
    return agenda
