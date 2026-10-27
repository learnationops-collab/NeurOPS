"""El estado de pago de un cliente, para la Academia (docs/integracion_learnation_api.md §10).

Pedido del 19/10/2026: al equipo de la Academia le importa saber si el alumno paga; al closer, cómo
avanza (eso va al revés, en la foto de `academy_snapshot_service`). La Academia muestra el estado
al lado del nombre del alumno y lo cruza con su avance en Avance.

Se EMPUJA cuando cambia: un pago, el plan de cuotas (crearlo, editarlo, marcar, agregar o borrar una
cuota) o una baja y su reversión.

El ESTADO (`estado`: pagado, seña, debe, al día, por vencer, vencida, baja) es una regla de Work desde el
21/10/2026: la cuota es parte del plan de pago del alumno (`regla_estado`). La Academia lo muestra tal
cual. Como una cuota que vence cambia el estado sin que nadie toque nada, una vez por día se reenvía a
los clientes con una cuota cerca de su vencimiento (`avisar_cambios_por_fecha`); la Academia descarta lo
que no cambió.

Para la carga inicial y para reparar, el masivo `GET /api/external/academy/payment-status` arma lo
mismo para todos (`estado`), y la Academia lo lee solo desde un botón de su admin.

La baja viaja acá: con la baja la Academia cierra el proceso del alumno (con el motivo), y con la
reversión lo reabre. Desde el 19/10/2026 la baja ya NO le corta el acceso (antes vencía en el día,
pedido del 30/09): es un indicador para el equipo y saca la deuda de lo que queda por cobrar.
"""
import logging
import os
import threading
from datetime import date, datetime, timedelta

from flask import current_app
from sqlalchemy import func

from app import db
from app.models import Client, FinancialSale, InstallmentPlan

logger = logging.getLogger(__name__)

# Clave de `db.session.info` con los clientes cuyo estado cambió en este pedido y a los que todavía
# no se le avisó a la Academia. La sesión vive lo que dura el pedido.
_PENDIENTES = 'estado_de_pago_sin_avisar'

# Una cuota que vence en estos días o menos está "por vencer" (hoy cuenta como 0).
POR_VENCER_DIAS = 7

PAGADO, SENA, AL_DIA, POR_VENCER, VENCIDA, BAJA = 'pagado', 'sena', 'al_dia', 'por_vencer', 'vencida', 'baja'
# Sin cuotas pendientes pero con saldo: pagó parcial y no tiene plan de cuotas (23/10/2026). Debe igual.
DEBE = 'debe'

# Último día en que se reenviaron los estados que cambian por la fecha (una vez por día y por proceso).
_ultimo_aviso_por_fecha = None


def _iso(valor):
    if valor is None:
        return None
    return valor.isoformat() if isinstance(valor, (date, datetime)) else str(valor)


def email_academia(person, por_defecto=None):
    """El mail con que el alumno entra a la Academia: el de ese uso si el equipo fijó uno distinto,
    y si no, el principal (el uso es la excepción). `por_defecto` solo sin persona o sin ningún mail."""
    from app.services import person_service

    if person is None:
        return por_defecto
    return person_service.dato(person, 'email', uso='academia') or por_defecto


def _total(client):
    """El total que la persona tiene que pagar: la suma de lo acordado en sus ventas activas
    (`deuda_service.total_de`; el de lista de su época si no se cargó). Va con `saldo`, que sale de las
    mismas ventas. None si no tiene ventas."""
    from app.models import Sale
    from app.services.deuda_service import total_de
    if client.person_uuid:
        ventas = Sale.query.filter(Sale.person_uuid == client.person_uuid, Sale.status == 'active').all()
    else:
        ventas = Sale.query.filter(Sale.client_id == client.id, Sale.status == 'active').all()
    totales = [t for t in (total_de(v) for v in ventas) if t is not None]
    return round(sum(totales), 2) if totales else None


def _tipo(tipos):
    """Cómo compró: completo si pagó todo de una vez; cuotas si tiene cuotas o parciales; seña si
    solo dejó la seña. None si no hay ventas."""
    if 'completo' in tipos:
        return 'completo'
    if tipos & {'cuota', 'parcial'}:
        return 'cuotas'
    if 'seña' in tipos:
        return 'seña'
    return None


def regla_estado(baja, vencidas, proxima_vence, tipo, hoy=None, saldo=0):
    """El estado de pago de un cliente, en este orden: baja · vencida (alguna cuota pendiente ya venció) ·
    por_vencer (la próxima vence en POR_VENCER_DIAS días o menos; hoy = 0) · al_dia · sena (solo dejó la
    seña) · debe (sin cuotas pendientes y con saldo) · pagado. La usan `estado()` (va a la Academia, que la
    muestra tal cual) y el motor de tablas."""
    hoy = hoy or date.today()
    if baja:
        return BAJA
    if vencidas:
        return VENCIDA
    if proxima_vence is not None:
        return POR_VENCER if (proxima_vence - hoy).days <= POR_VENCER_DIAS else AL_DIA
    if tipo == 'seña':
        return SENA
    return DEBE if (saldo or 0) > 0 else PAGADO


def estado(client, hoy=None):
    """Todo lo que la Academia necesita saber del pago de un cliente. Una foto de AHORA.

    Lleva los montos: la Academia decide quién los ve (solo su admin y el closer). Las cuotas
    pendientes viajan con su fecha para que la Academia sepa sola cuándo una vence.
    """
    from app.services import baja_service
    from app.services.academy_access_service import AcademyAccessService
    from app.services.closer_followup_service import CloserFollowUpService
    from app.services.sheets_service import SheetsService

    hoy = hoy or date.today()
    # Los pagos del cliente y los de su persona que todavía no tienen cliente (docs/plan_personas.md).
    suyos = FinancialSale.client_id == client.id
    if client.person_uuid:
        suyos = suyos | ((FinancialSale.person_uuid == client.person_uuid) & FinancialSale.client_id.is_(None))
    ventas = FinancialSale.query.filter(suyos, FinancialSale.estado == 'Completada') \
        .order_by(FinancialSale.date.asc(), FinancialSale.id.asc()).all()
    email = email_academia(client.person, client.email)
    tipos = {SheetsService.parse_tipo_pago(v.tipo_pago)[1] for v in ventas}
    ultima = ventas[-1] if ventas else None

    cuotas = InstallmentPlan.query.filter_by(client_id=client.id) \
        .order_by(InstallmentPlan.fecha_vencimiento.asc(), InstallmentPlan.numero_cuota.asc()).all()
    if cuotas:
        tipos.add('cuota')
    pendientes = [c for c in cuotas if c.estado != 'pagado']
    vencidas = [c for c in pendientes if c.fecha_vencimiento and c.fecha_vencimiento < hoy]
    proxima = next((c for c in pendientes if c.fecha_vencimiento and c.fecha_vencimiento >= hoy), None)
    tipo = _tipo(tipos)
    baja = baja_service.descriptor(client)
    saldo = round(float(CloserFollowUpService._client_debt(client.id)), 2)

    return {
        'work_client_id': client.id,
        'work_uuid': client.person_uuid,
        'email': (email or '').strip().lower() or None,
        'learnation_user_id': client.learnation_user_id,
        'tipo': tipo,
        'estado': regla_estado(baja, len(vencidas), proxima.fecha_vencimiento if proxima else None, tipo, hoy,
                               saldo),
        'closer_email': AcademyAccessService.closer_de(client),
        'cuotas': {
            'total': len(cuotas),
            'pagadas': len(cuotas) - len(pendientes),
            'pendientes': [{
                'numero': c.numero_cuota,
                'programa': c.programa_code,
                'monto': round(float(c.monto or 0), 2),
                'vence': _iso(c.fecha_vencimiento),
            } for c in pendientes],
            'proxima': {'numero': proxima.numero_cuota, 'monto': round(float(proxima.monto or 0), 2),
                        'vence': _iso(proxima.fecha_vencimiento)} if proxima else None,
            'vencidas': len(vencidas),
            'vencido_monto': round(sum(float(c.monto or 0) for c in vencidas), 2),
            'vencida_desde': _iso(vencidas[0].fecha_vencimiento) if vencidas else None,
        },
        'total': _total(client),
        'pagado': round(sum(float(v.monto or 0) for v in ventas), 2),
        'saldo': saldo,
        'ultimo_pago': {'fecha': _iso(ultima.date.date() if ultima.date else None),
                        'monto': round(float(ultima.monto or 0), 2),
                        'tipo_pago': ultima.tipo_pago} if ultima else None,
        'baja': baja,
        'actualizado_at': datetime.utcnow().replace(microsecond=0).isoformat() + 'Z',
    }


def anotar(client_id):
    """El estado de este cliente cambió en este pedido: se le avisa a la Academia al terminar
    (`avisar_pendientes`), después del commit."""
    if client_id:
        db.session.info.setdefault(_PENDIENTES, []).append(client_id)


def _pendientes():
    return list(dict.fromkeys(db.session.info.pop(_PENDIENTES, [])))


def _hay_academia():
    return bool(os.environ.get('ACADEMY_API_TOKEN'))


def _estados(client_ids):
    clientes = Client.query.filter(Client.id.in_(list(client_ids))).all() if client_ids else []
    return [estado(c) for c in clientes]


def avisar(client_ids):
    """Le manda a la Academia el estado de estos clientes, en un hilo (no daemon: un script espera a que salga): lo que lo cambió ya está
    guardado y la Academia puede tardar. Nunca levanta. El estado se arma ACÁ (lee la base); el hilo
    solo hace el HTTP."""
    ids = [i for i in dict.fromkeys(client_ids or []) if i]
    if not ids or not _hay_academia():
        return
    try:
        payloads = _estados(ids)
    except Exception as e:
        current_app.logger.error(f'[ACADEMY PAYMENT STATUS] No se pudo armar el estado: {e}')
        return
    if not payloads:
        return
    app = current_app._get_current_object()

    def _correr():
        with app.app_context():
            for payload in payloads:
                guardar_alumno(payload, _enviar(payload, app.logger))

    threading.Thread(target=_correr, daemon=False, name='academy-payment-status').start()


def guardar_alumno(payload, respuesta):
    """El vínculo en los dos sentidos: con el aviso la Academia guarda el work_uuid del alumno y responde su
    `user_id`, que queda en la persona como su id de alumno (person_service.vincular_alumno). Nunca levanta."""
    uid = (respuesta or {}).get('user_id') if isinstance(respuesta, dict) else None
    if not uid:
        return None
    from app.services import person_service
    try:
        client = db.session.get(Client, payload.get('work_client_id'))
        resultado = person_service.vincular_alumno(client.person if client else None, uid)
        if resultado == 'guardado':
            db.session.commit()
        return resultado
    except Exception as e:
        db.session.rollback()
        logger.error(f"[ACADEMY PAYMENT STATUS] No se pudo guardar el alumno {uid} del cliente "
                     f"{payload.get('work_client_id')}: {e}")
        return None


def _enviar(payload, log):
    from app.services.learnation_service import LearnationAPIError, LearnationService
    try:
        return LearnationService.report_payment_status(payload)
    except LearnationAPIError as e:
        log.warning(f"[ACADEMY PAYMENT STATUS] Cliente {payload['work_client_id']}: {e} ({e.status_code})")
        raise
    except Exception as e:
        log.error(f"[ACADEMY PAYMENT STATUS] Cliente {payload['work_client_id']}: {e}")
        raise


def clientes_por_fecha(hoy):
    """Los clientes cuyo estado pudo cambiar solo por la fecha: con una cuota pendiente que vence entre
    hace POR_VENCER_DIAS días y dentro de POR_VENCER_DIAS + 1 (entra en "por vencer" o en "vencida").
    La ventana cubre también los días en que no corrió."""
    desde, hasta = hoy - timedelta(days=POR_VENCER_DIAS), hoy + timedelta(days=POR_VENCER_DIAS + 1)
    filas = db.session.query(InstallmentPlan.client_id).filter(
        InstallmentPlan.client_id.isnot(None), InstallmentPlan.estado != 'pagado',
        InstallmentPlan.fecha_vencimiento.between(desde, hasta),
    ).distinct().all()
    return [f[0] for f in filas]


def avisar_cambios_por_fecha(hoy=None):
    """Una vez por día: reenvía el estado de los clientes con una cuota cerca de su vencimiento, para
    que la Academia vea el "por vencer" y el "vencida" el día que pasan. Lo llama el job horario del
    avance (y su cron); las demás veces del día no hace nada. Nunca levanta. Devuelve a cuántos avisó."""
    global _ultimo_aviso_por_fecha
    hoy = hoy or date.today()
    if _ultimo_aviso_por_fecha == hoy or not _hay_academia():
        return 0
    try:
        ids = clientes_por_fecha(hoy)
        avisar(ids)
    except Exception as e:
        current_app.logger.error(f'[ACADEMY PAYMENT STATUS] No se pudieron reenviar los estados del día: {e}')
        return 0
    _ultimo_aviso_por_fecha = hoy
    return len(ids)


def avisar_pendientes():
    """Avisa los cambios anotados en este pedido (planes, cuotas), en un hilo."""
    avisar(_pendientes())


def avisar_bajas():
    """Avisa en el momento las bajas (y reversiones) anotadas en este pedido, para decirle a quien la
    dio qué pasó: la Academia cierra (o reabre) el proceso del alumno. Va DESPUÉS del commit y nunca
    levanta: un problema de la Academia no deshace la baja.

    Devuelve el resultado del primero (una acción da de baja a un cliente), o None si no hubo:
    `avisado`, `sin_cuenta` (no es alumno de la Academia) o `no_avisado` (con el motivo).
    """
    from app.services import baja_service

    ids = list(dict.fromkeys(baja_service.bajas_sin_avisar_academia()))
    if not ids:
        return None
    resultados = []
    for cliente in Client.query.filter(Client.id.in_(ids)).all():
        if not _hay_academia():
            resultados.append({'estado': 'no_avisado', 'motivo': 'La Academia no está configurada.'})
            continue
        try:
            respuesta = _enviar(estado(cliente), current_app.logger) or {}
        except Exception as e:
            motivo = 'No se pudo hablar con la Academia.'
            if getattr(e, 'status_code', None) == 404:
                resultados.append({'estado': 'sin_cuenta', 'motivo': None})
                continue
            resultados.append({'estado': 'no_avisado', 'motivo': motivo})
            continue
        resultados.append({'estado': 'avisado' if respuesta.get('user_id') else 'sin_cuenta', 'motivo': None})
    return resultados[0] if resultados else None


def clientes_con_estado():
    """Los clientes de los que la Academia puede querer el estado: con alguna venta completada, con
    plan de cuotas o de baja. Para el masivo."""
    con_venta = db.session.query(FinancialSale.client_id).filter(
        FinancialSale.client_id.isnot(None), FinancialSale.estado == 'Completada')
    con_plan = db.session.query(InstallmentPlan.client_id).filter(InstallmentPlan.client_id.isnot(None))
    # Pagos que solo tienen persona (sin cliente): cuentan para el cliente de esa persona.
    con_persona = db.session.query(FinancialSale.person_uuid).filter(
        FinancialSale.person_uuid.isnot(None), FinancialSale.client_id.is_(None), FinancialSale.estado == 'Completada')
    return Client.query.filter(
        Client.id.in_(con_venta) | Client.id.in_(con_plan) | Client.person_uuid.in_(con_persona)
        | Client.baja_at.isnot(None)
    ).order_by(Client.id.asc())


def normalizar_email(email):
    return (email or '').strip().lower()


def buscar_cliente(work_client_id=None, email=None, work_uuid=None):
    """El cliente de un aviso de la Academia: por el uuid de la persona, por id de Work y, si no, por
    email (cualquiera de los de su persona)."""
    from app.services import person_service

    if work_uuid:
        cliente = person_service.cliente_de(person_service.por_uuid(work_uuid), crear=False)
        if cliente:
            return cliente
    if work_client_id:
        cliente = db.session.get(Client, int(work_client_id))
        if cliente:
            return cliente
    email = normalizar_email(email)
    if email:
        cliente = person_service.cliente_de(person_service.buscar(email=email), crear=False)
        return cliente or Client.query.filter(func.lower(Client.email) == email).first()
    return None
