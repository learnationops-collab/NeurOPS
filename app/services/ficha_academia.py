"""El acceso a la Academia desde la pestaña Fulfillment de la ficha: prórroga, mail y quitar.

Desde el 22/10/2026 Fulfillment no da ni renueva accesos con una fecha elegida: el acceso sale de
la venta (Resultado → suscripción en Work). Acá solo se puede:

  · prorrogar — días sin pago, de un tipo fijo (seña 7 días, cortesía 1 mes) y con motivo; la
                fecha la calcula Work (`subscription_service.PRORROGAS`).
  · corregir el mail — el alumno entra con otro correo que el de la venta. El mail queda como el de
                la Academia de su persona y, si tiene una suscripción vigente que sale de una venta,
                el acceso pasa a la cuenta de ese correo (se crea si no existe) con la fecha de Work.
                Sin venta vigente solo se guarda el mail: no se crea un acceso vacío.
  · quitar    — se le reasigna con vencimiento HOY y la Academia lo da por vencido (no permite
                borrar un acceso: `docs/integracion_learnation_api.md` §6).

El producto es siempre el del programa que pagó (el de Acciones): nunca el curso de bienvenida.
Todo se valida antes de llamar a la Academia (otro sistema, con límite de peticiones).
"""
import logging

from app import db
from app.models import ClientComment
from app.services.academy_access_service import AcademyAccessService
from app.services.closer_followup_service import PROGRAM_CODE_NAMES, CloserFollowUpService
from app.services.ficha_acciones_service import ErrorDeAccion, _texto
from app.services.learnation_service import LearnationAPIError, LearnationService
from app.services.user_time_service import hoy_del_usuario

logger = logging.getLogger(__name__)

def _fecha_legible(dia):
    return dia.strftime('%d/%m/%Y')


def _cliente(appt):
    if not appt.client:
        raise ErrorDeAccion('Este lead todavía no es un cliente: no hay alumno al que darle acceso.')
    return appt.client


def _producto(client):
    """(código de programa, nombre, product_slug) del programa que pagó, o ErrorDeAccion."""
    codigo = CloserFollowUpService._client_program_code(client.id)
    if not codigo:
        raise ErrorDeAccion('NeurOPS no tiene cargado qué programa pagó este cliente: elegilo en '
                            'Acciones, en «Programa», y después dale el acceso.')
    nombre = PROGRAM_CODE_NAMES.get(codigo, codigo)
    slug = (AcademyAccessService.get_product_mapping() or {}).get(codigo)
    if not slug:
        raise ErrorDeAccion(f'El programa {nombre} no está vinculado a ningún producto de la '
                            'Academia. Un admin lo vincula en Configuración de Ventas → Integraciones.')
    return codigo, nombre, slug


def _alumno(client):
    """El id del alumno en la Academia, con el mismo cruce que la pestaña (id guardado o correos)."""
    from app.services.ficha_fulfillment_service import _resolver_alumno
    from app.services.ficha_lead_service import _ventas_del_cliente

    alumno_id, _email, _probados, error = _resolver_alumno(client, _ventas_del_cliente(client))
    if error:
        raise ErrorDeAccion(error['motivo'])
    return alumno_id


def _asignar(alumno_id, slug, dia, closer_email=None):
    """`closer_email` solo al dar o renovar (el alumno pasa a depender de ese closer); quitar no lo cambia."""
    extra = {'closer_email': closer_email} if closer_email else {}
    try:
        LearnationService.assign_product(alumno_id, slug, expires_at=dia.isoformat(), **extra)
    except LearnationAPIError as e:
        raise ErrorDeAccion(f'La Academia no aceptó el cambio: {e}')


def _constancia(appt, usuario, texto):
    """El cambio queda en el historial del lead y en el hilo del cliente: quién, qué y hasta cuándo."""
    from app.services.booking_service import BookingService

    BookingService.log_lead_event(appt.id, usuario.id, 'academia_acceso', texto)
    db.session.add(ClientComment(client_id=appt.client_id, author_id=usuario.id, text=texto))


def quitar(appt, datos, usuario):
    """Corta el acceso: el producto que pagó pasa a vencer hoy (la Academia no permite borrarlo)."""
    if datos.get('confirmo') is not True:
        raise ErrorDeAccion('Falta confirmar que se le quita el acceso.')
    client = _cliente(appt)
    _codigo, nombre, slug = _producto(client)
    alumno_id = _alumno(client)
    if not alumno_id:
        raise ErrorDeAccion('No tiene cuenta en la Academia: no hay acceso que quitar.')

    hoy = hoy_del_usuario(usuario)
    _asignar(alumno_id, slug, hoy)

    motivo = _texto(datos, 'motivo')
    from app.services import subscription_service
    subscription_service.cambiar(client, _codigo, hoy, motivo or 'Acceso quitado desde Fulfillment', usuario,
                                 kind='quitado')
    _constancia(appt, usuario, f'{usuario.username} le quitó el acceso a la Academia ({nombre}): '
                               f'vence hoy, {_fecha_legible(hoy)}.' + (f' Motivo: {motivo}.' if motivo else ''))
    db.session.commit()
    return {'accion': 'quitado', 'vence': hoy.isoformat(), 'programa': nombre}


def prorrogar(appt, datos, usuario):
    """Una prórroga sin pago: de un tipo fijo (`subscription_service.PRORROGAS`) y con motivo. La fecha
    la calcula Work, no el closer (22/10/2026)."""
    from app.services import subscription_service

    client = _cliente(appt)
    _codigo, nombre, slug = _producto(client)
    alumno_id = _alumno(client)
    if not alumno_id:
        raise ErrorDeAccion('No tiene cuenta en la Academia: no hay acceso que prorrogar.')
    motivo = _texto(datos, 'motivo')
    if not motivo:
        raise ErrorDeAccion('Falta el motivo de la prórroga.', 'motivo')
    tipo = datos.get('tipo')
    try:
        dia = subscription_service.fin_de_prorroga(subscription_service.a_prorrogar(client, slug), tipo)
    except (LookupError, ValueError) as e:
        raise ErrorDeAccion(str(e), 'tipo')

    _asignar(alumno_id, slug, dia, AcademyAccessService.closer_de(client, usuario))
    subscription_service.prorrogar(client, tipo, motivo, slug=slug, usuario=usuario)
    etiqueta = subscription_service.PRORROGAS[tipo]['label'].lower()
    _constancia(appt, usuario, f'{usuario.username} le dio una {etiqueta} en la Academia ({nombre}) '
                               f'hasta el {_fecha_legible(dia)}. Motivo: {motivo}.')
    db.session.commit()
    return {'accion': 'prorrogado', 'vence': dia.isoformat(), 'programa': nombre}


def corregir_mail(appt, datos, usuario):
    """El correo con que entra a la Academia. El acceso lo da la venta, no este pedido: con una
    suscripción vigente que sale de una venta, pasa a la cuenta de ese correo con la fecha de Work;
    sin ella solo queda el mail."""
    from app.services import person_service, subscription_service
    from app.services.ficha_fulfillment_service import es_placeholder

    client = _cliente(appt)
    _codigo, nombre, slug = _producto(client)
    person = client.person
    if person is None:
        raise ErrorDeAccion('Este cliente todavía no tiene su persona en NeurOPS: no hay venta de la que '
                            'salga el acceso.')
    email = person_service.normalizar('email', _texto(datos, 'email'))
    if not email or '@' not in email or es_placeholder(email):
        raise ErrorDeAccion('El correo no es válido.', 'email')
    if any(u != person.uuid for u in person_service.duenos('email', email)):
        raise ErrorDeAccion('Ese correo es de otra persona en NeurOPS: revisalo antes de usarlo.', 'email')

    hoy = hoy_del_usuario(usuario)
    try:
        sub = subscription_service.a_prorrogar(client, slug)
    except LookupError:
        sub = None
    vigente = sub is not None and sub.sale_id is not None and sub.expires_at >= hoy
    anterior = _alumno(client)
    try:
        respuesta = LearnationService.check_user(email) or {}
        nuevo = (respuesta.get('user') or {}).get('id') if respuesta.get('exists') else None
        creada = False
        if vigente and not nuevo:
            alta = LearnationService.upsert_user(email, client.full_name or email, client.phone,
                                                 work_uuid=person.uuid) or {}
            nuevo = (alta.get('user') or {}).get('id')
            creada = alta.get('action') == 'created'
    except LearnationAPIError as e:
        raise ErrorDeAccion(f'La Academia no respondió: {e}')

    if vigente and nuevo:
        _asignar(nuevo, slug, sub.expires_at, AcademyAccessService.closer_de(client, usuario))
        if anterior and anterior != nuevo:
            _asignar(anterior, slug, hoy)  # el acceso se mueve: la cuenta vieja deja de tenerlo
    if nuevo:
        client.learnation_user_id = nuevo
        person_service.anotar(person, [('learnation_user_id', str(nuevo))], 'fulfillment')
    try:
        person_service.hacer_principal(person, 'email', email, usuario, uso='academia',
                                       reason='Mail de la Academia corregido desde Fulfillment')
    except ValueError as e:
        raise ErrorDeAccion(str(e), 'email')

    detalle = (f'tiene acceso a {nombre} hasta el {_fecha_legible(sub.expires_at)}' if vigente and nuevo
               else 'no tiene una venta con acceso vigente: no se le dio acceso')
    _constancia(appt, usuario, f'{usuario.username} corrigió el mail de la Academia: {email}; {detalle}.')
    db.session.commit()
    return {'accion': 'mail', 'email': email, 'vence': sub.expires_at.isoformat() if vigente and nuevo else None,
            'programa': nombre, 'creada': creada}
