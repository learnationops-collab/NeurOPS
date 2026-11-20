"""Lo cobrado y lo cerrado en el área Triage (20/11/2026, ADR-W188 y ADR-W189).

El low ticket y lo que cargó alguien con rol triage salieron del Closing (`area_venta`) y se ven en el tablero de
Triage, en el total y por persona:

  · `lt_cobrado` (bruto), `lt_neto` y `lt_ventas`: los cobros del período, por la fecha del pago.
  · El cierre real del low ticket, la misma cuenta que el close rate real del Closing (`cierres_reales`): cada venta
    cobrada en el período es un cierre y se rastrea hasta la llamada de triage en la que se presentó el low ticket.
    Si esa llamada es de antes del período (lo pensó y pagó después), suma arriba y abajo:

        cierre real = (del período + anteriores) ÷ (presentaciones + anteriores)

    `lt_sin_llamada`: ventas sin llamada de triage que las explique; se cobran pero no entran en la tasa.

El filtro de segmento no acota los cobros.
"""
from datetime import timedelta

from sqlalchemy import or_

from app.models import Appointment, FinancialSale, User
from app.services.area_venta import TRIAGE, area_de
from app.services.closer_name_service import resolver_nombre_closer
from app.services.commission_service import cash_neto
from app.services.comercial_vocabulario import pct, venta_completada

# Cuánto antes del pago puede estar la llamada que lo explica (la misma ventana del Closing).
VENTANA_DIAS = 90


def _vacio():
    return {'lt_cobrado': 0.0, 'lt_neto': 0.0, 'lt_ventas': 0, 'lt_del_periodo': 0, 'lt_anteriores': 0,
            'lt_sin_llamada': 0}


def _sumar(m, v, origen):
    m['lt_cobrado'] = round(m['lt_cobrado'] + float(v.monto or 0), 2)
    m['lt_neto'] = round(m['lt_neto'] + cash_neto(v), 2)
    m['lt_ventas'] += 1
    if origen:
        m[f'lt_{origen}'] += 1


def _llamadas(cobros, triage):
    """{(client_id | person_uuid): [inicio de cada llamada de triage con el low ticket presentado]}."""
    from app.services.triage_service import PITCHEADO

    clientes = {v.client_id for v in cobros if v.client_id}
    personas = {v.person_uuid for v in cobros if v.person_uuid}
    if not (clientes or personas):
        return {}
    ids = [u.id for u in User.query.filter(User.username.in_(triage)).all()]
    citas = Appointment.query.filter(
        Appointment.closer_id.in_(ids or [0]), Appointment.triage_low_ticket.in_(PITCHEADO),
        or_(Appointment.client_id.in_(clientes or [0]), Appointment.person_uuid.in_(personas or ['']))).all()
    salida = {}
    for a in citas:
        for clave in (a.client_id, a.person_uuid):
            if clave:
                salida.setdefault(clave, []).append(a.start_time)
    return salida


def _origen(v, llamadas, desde):
    """'del_periodo' | 'anteriores' | 'sin_llamada' de un cobro de venta; None si no es una venta (no es cierre)."""
    from app.services.comercial_service import ComercialService

    if not ComercialService.clasificar_venta(v)[2]:
        return None
    piso, tope = v.date - timedelta(days=VENTANA_DIAS), v.date + timedelta(days=1)
    previas = [t for clave in (v.client_id, v.person_uuid) if clave for t in llamadas.get(clave, ())
               if piso <= t <= tope]
    if not previas:
        return 'sin_llamada'
    return 'del_periodo' if max(previas) >= desde else 'anteriores'


def cobros(desde, hasta, personas):
    """(total, {id de persona: {...}}) de los cobros completados del área Triage entre `desde` y `hasta`."""
    from app.services.comercial_service import ComercialService
    from app.services.triage_service import nombres_de_triage

    triage = nombres_de_triage()
    por_nombre = {p.username: p.id for p in personas}
    total, por_id = _vacio(), {p.id: _vacio() for p in personas}
    filas = []
    for v in FinancialSale.query.filter(FinancialSale.date >= desde, FinancialSale.date < hasta).all():
        vendedor = resolver_nombre_closer(v.email_vendedor)
        if venta_completada(v) and area_de(ComercialService.clasificar_venta(v)[0], vendedor, triage) == TRIAGE:
            filas.append((v, vendedor))
    llamadas = _llamadas([v for v, _ in filas], triage)
    for v, vendedor in filas:
        origen = _origen(v, llamadas, desde)
        if vendedor in por_nombre:
            _sumar(por_id[por_nombre[vendedor]], v, origen)
            _sumar(total, v, origen)
        elif len(personas) > 1 or not personas:
            # Un low ticket que cargó alguien que no es del triage: va al total del equipo, no a una persona.
            _sumar(total, v, origen)
    return total, por_id


def _con_tasa(m):
    """Le suma a `m` (con `pitch_low_ticket`) el cierre real: `lt_cierres`, `lt_base` y `lt_cierre_pct`."""
    cierres = m['lt_del_periodo'] + m['lt_anteriores']
    # Como en el Closing: la base nunca baja del numerador.
    base = max(m.get('pitch_low_ticket', 0), m['lt_del_periodo']) + m['lt_anteriores']
    m.update(lt_cierres=cierres, lt_base=base, lt_cierre_pct=pct(cierres, base))
    return m


def agregar(datos, desde, hasta, personas):
    """Suma los campos de `cobros` y el cierre real al `total` y a cada fila de `por_persona` de `metricas`."""
    total, por_id = cobros(desde, hasta, personas)
    datos['total'].update(_con_tasa({**datos['total'], **total}))
    for fila in datos['por_persona']:
        fila.update(_con_tasa({**fila, **por_id.get(fila['id'], _vacio())}))
    return datos
