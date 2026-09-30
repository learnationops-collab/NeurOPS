"""Dar, renovar y quitar el acceso a la Academia desde la pestaña Fulfillment de la ficha.

Pedido del 30/09/2026. Hasta ahora el acceso solo se daba al registrar un pago en Resultado
(«¿Le das acceso a la Academia?»): para extenderle el plazo a un alumno, o cortárselo, había que
inventar un pago o ir a la otra plataforma.

## La Academia tiene UNA escritura sobre accesos

`POST /users/{id}/products`: asigna un producto con su vencimiento y archiva la asignación
anterior sin perder el historial. No hay forma de borrar un acceso (su doc pública, revisada el
30/09/2026, tiene seis endpoints y ninguno revoca). Así que las tres acciones son la misma llamada
con otra fecha:

  · dar     — el alumno no existe: se lo crea por correo con el mismo camino que la venta
              (`AcademyAccessService.grant_access`), que pide el correo real y lo deja en el cliente.
  · renovar — ya existe: se le reasigna el producto con el vencimiento nuevo, por su id. No se
              pasa por el alta ni se toca el correo del cliente: el alumno puede haberse registrado
              con otro correo (el de la venta) y pisar el del cliente perdería el cruce con sus
              ventas.
  · quitar  — se le reasigna con vencimiento HOY y la Academia lo da por vencido. Queda en su
              historial y se puede renovar. Pedirle a la Academia un endpoint para revocar de
              verdad está en `docs/integracion_learnation_api.md` §6.

El producto es siempre el del programa que pagó (el de Acciones, el mismo que la pestaña muestra
como «Lo que pagó»): nunca el curso de bienvenida ni un acceso dado a mano.

## Se valida todo antes de llamar a la Academia

Es otro sistema, con un límite de peticiones compartido con producción: un pedido incompleto se
rechaza acá. Quitar además pide `confirmo: true`, para que ningún cuerpo vacío corte un acceso.
"""
from datetime import datetime, time, timedelta

from app import db
from app.models import ClientComment
from app.services.academy_access_service import AcademyAccessError, AcademyAccessService
from app.services.closer_followup_service import PROGRAM_CODE_NAMES, CloserFollowUpService
from app.services.ficha_acciones_service import ErrorDeAccion, _texto
from app.services.learnation_service import LearnationAPIError, LearnationService
from app.services.user_time_service import hoy_del_usuario

# Más lejos que esto es casi seguro un error de tipeo (2207 en vez de 2027).
MAX_DIAS = 3 * 366


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


def _vencimiento(datos, usuario):
    texto = (datos.get('vence') or '').strip()
    if not texto:
        raise ErrorDeAccion('Falta hasta cuándo tiene el acceso.', 'vence')
    try:
        dia = datetime.strptime(texto, '%Y-%m-%d').date()
    except ValueError:
        raise ErrorDeAccion('La fecha de vencimiento no es válida.', 'vence')
    hoy = hoy_del_usuario(usuario)
    if dia <= hoy:
        raise ErrorDeAccion('El vencimiento tiene que ser después de hoy. Para cortarle el acceso '
                            'usá «Quitar acceso».', 'vence')
    if dia > hoy + timedelta(days=MAX_DIAS):
        raise ErrorDeAccion('Más de tres años de acceso: revisá el año de la fecha.', 'vence')
    return dia


def _alumno(client):
    """El id del alumno en la Academia, con el mismo cruce que la pestaña (id guardado o correos)."""
    from app.services.ficha_fulfillment_service import _resolver_alumno
    from app.services.ficha_lead_service import _ventas_del_cliente

    alumno_id, _email, _probados, error = _resolver_alumno(client, _ventas_del_cliente(client))
    if error:
        raise ErrorDeAccion(error['motivo'])
    return alumno_id


def _asignar(alumno_id, slug, dia):
    try:
        LearnationService.assign_product(alumno_id, slug, expires_at=dia.isoformat())
    except LearnationAPIError as e:
        raise ErrorDeAccion(f'La Academia no aceptó el cambio: {e}')


def _constancia(appt, usuario, texto):
    """El cambio queda en el historial del lead y en el hilo del cliente: quién, qué y hasta cuándo."""
    from app.services.booking_service import BookingService

    BookingService.log_lead_event(appt.id, usuario.id, 'academia_acceso', texto)
    db.session.add(ClientComment(client_id=appt.client_id, author_id=usuario.id, text=texto))


def acceso(appt, datos, usuario):
    """Da el acceso (si todavía no es alumno) o lo renueva hasta `vence` (YYYY-MM-DD)."""
    dia = _vencimiento(datos, usuario)
    client = _cliente(appt)
    codigo, nombre, slug = _producto(client)
    alumno_id = _alumno(client)

    creada = False
    if alumno_id:
        _asignar(alumno_id, slug, dia)
        client.academy_product_slug = slug
        client.academy_expires_at = datetime.combine(dia, time.min)
        accion = 'renovado'
    else:
        email = _texto(datos, 'email')
        if not email:
            raise ErrorDeAccion('Todavía no tiene cuenta en la Academia: falta el correo con el que '
                                'va a entrar.', 'email')
        try:
            alta = AcademyAccessService.grant_access(client, codigo, None, expires_at_override=dia,
                                                     email_override=email) or {}
        except AcademyAccessError as e:
            raise ErrorDeAccion(str(e), 'email' if e.status_code == 422 else None)
        accion = 'dado'
        # Una cuenta nueva le manda al alumno un correo para activar su contraseña: se avisa.
        creada = bool(alta.get('was_created'))

    verbo = 'dio' if accion == 'dado' else 'renovó'
    _constancia(appt, usuario, f'{usuario.username} {verbo} el acceso a la Academia ({nombre}) '
                               f'hasta el {_fecha_legible(dia)}.')
    db.session.commit()
    return {'accion': accion, 'vence': dia.isoformat(), 'programa': nombre, 'creada': creada}


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
    client.academy_expires_at = datetime.combine(hoy, time.min)

    motivo = _texto(datos, 'motivo')
    _constancia(appt, usuario, f'{usuario.username} le quitó el acceso a la Academia ({nombre}): '
                               f'vence hoy, {_fecha_legible(hoy)}.' + (f' Motivo: {motivo}.' if motivo else ''))
    db.session.commit()
    return {'accion': 'quitado', 'vence': hoy.isoformat(), 'programa': nombre}
