"""Las ventas de una persona para la ficha, y cancelarlas o reactivarlas a mano (21/10/2026).

Cada venta (`Sale`) con lo que debe (`deuda_service`), lo cobrado, su suscripción y sus pagos.
Cancelar no toca los pagos ni acorta la suscripción: la venta deja de deber. Quién, cuándo y por
qué queda en `system_logs` (22/10/2026), con toda la historia. Antes se guardaba en `review_note` con
prefijo propio y cada evento pisaba al anterior: esos registros viejos se siguen mostrando.
"""
import logging
from datetime import datetime

from sqlalchemy import and_, or_

from app import db
from app.models import Appointment, FinancialSale, Sale
from app.services import deuda_service, system_log_service

logger = logging.getLogger(__name__)

# Quién cancela o reactiva cualquier venta, además del closer de la venta (`puede_gestionar`).
ROLES_QUE_GESTIONAN = ('admin', 'operator')

PREFIJO_CANCELADA = 'cancelada:'
PREFIJO_REACTIVADA = 'reactivada:'
_REGISTROS = (PREFIJO_CANCELADA, PREFIJO_REACTIVADA)


def _partes(nota):
    return [p for p in (nota or '').split('; ') if p]


def motivos(sale):
    """Los motivos de revisión de la venta (sin los registros de cancelar/reactivar)."""
    return [p for p in _partes(sale.review_note) if not p.startswith(_REGISTROS)]


def _closer_de(sale):
    """El usuario closer de la venta: el de `closer_email` (con sus alias) o, sin él, el de la cita."""
    if sale.closer_email:
        from app.services.closer_followup_service import CloserFollowUpService
        return getattr(CloserFollowUpService._resolve_closer_for_email_vendedor(sale.closer_email), 'id', None)
    cita = db.session.get(Appointment, sale.appointment_id) if sale.appointment_id else None
    if cita is None and (sale.person_uuid or sale.client_id):
        suya = Appointment.person_uuid == sale.person_uuid if sale.person_uuid else Appointment.client_id == sale.client_id
        cita = Appointment.query.filter(suya).order_by(Appointment.start_time.desc().nullslast()).first()
    return cita.closer_id if cita else None


def puede_gestionar(usuario, sale):
    """¿`usuario` puede cancelar o reactivar `sale`? Admin y Operaciones, y el closer de la venta."""
    if usuario is None or not getattr(usuario, 'is_authenticated', False):
        return False
    if usuario.role in ROLES_QUE_GESTIONAN:
        return True
    return usuario.role in ('closer', 'director_comercial') and _closer_de(sale) == usuario.id


def _de(person_uuid=None, client_id=None):
    if person_uuid and client_id:
        return or_(Sale.person_uuid == person_uuid, and_(Sale.person_uuid.is_(None), Sale.client_id == client_id))
    if person_uuid:
        return Sale.person_uuid == person_uuid
    return Sale.client_id == client_id


def _pago(fila):
    from app.services.comercial_vocabulario import venta_completada
    return {
        'id': fila.id,
        'fecha': fila.date.isoformat() if fila.date else None,
        'monto': float(fila.monto or 0),
        'tipo': fila.tipo_pago,
        'estado': fila.estado,
        'completado': venta_completada(fila),
        'pagador': (fila.payer.full_name or fila.payer.uuid) if fila.payer_person_uuid and fila.payer else None,
    }


def _suscripcion(sale):
    s = sale.subscription
    if s is None:
        return None
    return {'id': s.id, 'producto': s.product_slug, 'vence': s.expires_at.isoformat() if s.expires_at else None,
            'estado': s.status, 'sena': bool(s.is_deposit)}


def a_dict(sale, usuario=None):
    filas = sorted(sale.payments.all(), key=lambda f: (f.date or datetime.max, f.id))
    pagos = [_pago(f) for f in filas]
    cobrado = round(sum(p['monto'] for p in pagos if p['completado']), 2)
    completo = any(p['completado'] and deuda_service.es_pago_completo(f) for f, p in zip(filas, pagos))
    total = deuda_service.total_de(sale)
    return {
        **sale.to_dict(),
        'total': total,
        # El total salió del precio de lista de su época (no se acordó uno).
        'total_de_lista': sale.agreed_total is None and total is not None,
        'cobrado': cobrado,
        'saldo': round(deuda_service.saldo(sale, cobrado, completo=completo), 2),
        'motivos': motivos(sale),
        'registro': _registro(sale),
        'suscripcion': _suscripcion(sale),
        'pagos': pagos,
        'puede_gestionar': puede_gestionar(usuario, sale),
    }


def de_persona(person_uuid=None, client_id=None, usuario=None):
    """Las ventas de la persona (y, sin persona, las del cliente), la más reciente primero."""
    if not (person_uuid or client_id):
        return []
    ventas = Sale.query.filter(_de(person_uuid, client_id)).order_by(Sale.sold_at.desc(), Sale.id.desc()).all()
    return [a_dict(v, usuario) for v in ventas]


def _firma(usuario):
    return f"{getattr(usuario, 'username', None) or getattr(usuario, 'email', None) or 'sistema'} · " \
           f"{datetime.utcnow().strftime('%d/%m/%Y %H:%M')} UTC"


def _registro(sale):
    viejos = [p for p in _partes(sale.review_note) if p.startswith(_REGISTROS)]
    logs = system_log_service.de('sale', sale.id) if sale.id else []
    return viejos + [f"{l.title}: {l.description}" for l in logs]


def _registrar(sale, title, usuario, detalle=None):
    descripcion = f'{detalle} ({_firma(usuario)})' if detalle else _firma(usuario)
    system_log_service.registrar(title, descripcion, usuario=usuario, entity_type='sale', entity_id=sale.id)


def cancelar(sale, motivo, usuario):
    """La venta deja de deber (`cancelled`). Los pagos y la suscripción quedan como estaban."""
    motivo = (motivo or '').strip()
    if not motivo:
        raise ValueError('Falta el motivo de la cancelación.')
    if sale.status != 'active':
        raise ValueError('La venta ya no está activa.')
    sale.status = 'cancelled'
    _registrar(sale, 'Venta cancelada', usuario, motivo)
    logger.info(f'[VENTAS] Venta #{sale.id} cancelada por #{getattr(usuario, "id", None)}: {motivo}')


def reactivar(sale, usuario):
    """La venta cancelada vuelve a 'active' (vuelve a deber lo que le falta)."""
    if sale.status != 'cancelled':
        raise ValueError('Solo se reactiva una venta cancelada.')
    sale.status = 'active'
    _registrar(sale, 'Venta reactivada', usuario)
    logger.info(f'[VENTAS] Venta #{sale.id} reactivada por #{getattr(usuario, "id", None)}')


def para_revisar(motivo=None):
    """Las ventas activas con algún motivo de revisión, con la cuenta por motivo.
    `motivo` filtra por las que lo contienen (texto parcial: «requires_review», «programa a definir»)."""
    ventas = Sale.query.filter(Sale.status == 'active', Sale.review_note.isnot(None)) \
        .order_by(Sale.sold_at.desc(), Sale.id.desc()).all()
    con_motivo = [(v, motivos(v)) for v in ventas]
    con_motivo = [(v, m) for v, m in con_motivo if m]
    cuentas = {}
    for _, m in con_motivo:
        for p in m:
            cuentas[p] = cuentas.get(p, 0) + 1
    if motivo:
        con_motivo = [(v, m) for v, m in con_motivo if any(motivo in p for p in m)]
    personas = {v.person_uuid for v, _ in con_motivo if v.person_uuid}
    nombres = {}
    if personas:
        from app.models import Person
        nombres = {p.uuid: p.full_name for p in Person.query.filter(Person.uuid.in_(personas)).all()}
    cobrado, completas = {}, set()
    ids = [v.id for v, _ in con_motivo]
    if ids:
        from app.services.comercial_vocabulario import venta_completada
        for f in FinancialSale.query.filter(FinancialSale.sale_id.in_(ids)).all():
            if venta_completada(f):
                cobrado[f.sale_id] = cobrado.get(f.sale_id, 0.0) + float(f.monto or 0)
                if deuda_service.es_pago_completo(f):
                    completas.add(f.sale_id)
    filas = [{
        'id': v.id, 'client_id': v.client_id, 'person_uuid': v.person_uuid,
        'nombre': nombres.get(v.person_uuid) or (v.client.full_name if v.client else None),
        'program_code': v.program_code, 'kind': v.kind,
        'sold_at': v.sold_at.isoformat() if v.sold_at else None,
        'total': deuda_service.total_de(v), 'cobrado': round(cobrado.get(v.id, 0.0), 2),
        'saldo': round(deuda_service.saldo(v, cobrado.get(v.id, 0.0), completo=v.id in completas), 2),
        'motivos': m,
    } for v, m in con_motivo]
    return {'ventas': filas, 'motivos': sorted(cuentas.items(), key=lambda kv: -kv[1])}
