"""Datos del sistema (`s.`): reglas de negocio que no están en ninguna columna, con las mismas funciones que usa
Work en sus pantallas. Se calculan en lote, una vez por pedido y solo si el plan los usa, y entran a la consulta
como un mapa {clave: valor} (un solo parámetro JSON), como hace la Academia con sus sesiones y su Pulso.

  De pago (en clientes, personas y toda tabla con client_id):
    s.estado_pago      baja | vencida | por_vencer | al_dia | sena | debe | pagado (academy_payment_status.regla_estado)
    s.deuda            lo que debe (CarteraEnLote: la deuda por venta, o la de inscripciones si no tiene ventas)
    s.proxima_cuota    vencimiento de la próxima cuota pendiente
    s.dias_para_vencer días hasta esa cuota (hoy = 0)
    s.cuotas_vencidas  cuántas pendientes ya vencieron
    s.monto_vencido    cuánto suman
  De agendas:
    s.estado_agenda    el estado de closer_agendas_service.derivar_estado
"""
import json
from datetime import date, datetime

from flask import g, has_app_context
from sqlalchemy import Date, Numeric, String, cast, func, literal, select
from sqlalchemy.dialects.postgresql import JSONB

from app import db
from app.services.tablas import exclusion

# clave -> (nombre, tipo, es monto, detalle)
PAGO = {
    's.estado_pago': ('Estado de pago', 'text', False,
                      'baja, vencida, por_vencer (7 días o menos), al_dia, sena (solo la seña), '
                      'debe (saldo sin plan de cuotas) o pagado'),
    's.deuda': ('Deuda', 'number', True, 'Lo que debe hoy: lo acordado en sus ventas menos lo cobrado'),
    's.proxima_cuota': ('Próxima cuota', 'date', False, 'Vencimiento de la próxima cuota pendiente'),
    's.dias_para_vencer': ('Días para la próxima cuota', 'number', False, 'Hoy = 0'),
    's.cuotas_vencidas': ('Cuotas vencidas', 'number', False, 'Cuántas cuotas pendientes ya vencieron'),
    's.monto_vencido': ('Monto vencido', 'number', True, 'Cuánto suman las cuotas vencidas'),
}
AGENDA = {'s.estado_agenda': ('Estado de la agenda', 'text', False,
                              'show_up, no_show, segunda_llamada, cancelada, reagendada, confirmada, por_confirmar, '
                              'sin_reportar… (el mismo de Mi cartera)')}
_COLUMNA = {'s.estado_pago': 'estado', 's.deuda': 'deuda', 's.proxima_cuota': 'proxima', 's.dias_para_vencer': 'dias',
            's.cuotas_vencidas': 'vencidas', 's.monto_vencido': 'vencido'}


def _memo(clave, calcular):
    """Lo calculado se reusa durante el pedido (filas, conteo y medición piden lo mismo)."""
    if not has_app_context():
        return calcular()
    cache = g.setdefault('tablas_sistema', {})
    if clave not in cache:
        cache[clave] = calcular()
    return cache[clave]


def pagos(hoy=None):
    """{client_id: {estado, deuda, proxima, dias, vencidas, vencido}} de los clientes con pagos o cuotas."""
    from app.models import Client, FinancialSale, InstallmentPlan
    from app.services.academy_payment_status import _tipo, regla_estado
    from app.services.closer_followup_service import CarteraEnLote
    from app.services.sheets_service import SheetsService

    hoy = hoy or date.today()
    cuotas = {}
    for cid, est, vence, monto in db.session.query(InstallmentPlan.client_id, InstallmentPlan.estado,
                                                   InstallmentPlan.fecha_vencimiento, InstallmentPlan.monto) \
            .filter(InstallmentPlan.client_id.isnot(None)).all():
        cuotas.setdefault(cid, []).append((est, vence, monto))
    tipos = {}
    for cid, tipo_pago in db.session.query(FinancialSale.client_id, FinancialSale.tipo_pago) \
            .filter(FinancialSale.client_id.isnot(None), FinancialSale.estado == 'Completada').all():
        tipos.setdefault(cid, set()).add(SheetsService.parse_tipo_pago(tipo_pago)[1])
    ids = set(cuotas) | set(tipos)
    if not ids:
        return {}
    bajas = {cid for cid, baja in db.session.query(Client.id, Client.baja_at).filter(Client.id.in_(ids)).all() if baja}
    lote = CarteraEnLote(ids, cita_exacta=False)
    out = {}
    for cid in ids:
        suyas = cuotas.get(cid, [])
        t = set(tipos.get(cid, set())) | ({'cuota'} if suyas else set())
        pend = [(v, m) for est, v, m in suyas if est != 'pagado' and v]
        vencidas = [(v, m) for v, m in pend if v < hoy]
        proxima = min((v for v, _ in pend if v >= hoy), default=None)
        deuda = lote.deuda(cid)
        out[cid] = {
            'estado': regla_estado(cid in bajas, len(vencidas), proxima, _tipo(t), hoy, deuda),
            'deuda': deuda,
            'proxima': proxima.isoformat() if proxima else None,
            'dias': (proxima - hoy).days if proxima else None,
            'vencidas': len(vencidas),
            'vencido': round(sum(float(m or 0) for _, m in vencidas), 2),
        }
    return out


def estados_de_agenda():
    """{appointment_id: estado}, con derivar_estado sobre las columnas que usa."""
    from app.models import Appointment
    from app.services.closer_agendas_service import derivar_estado

    ahora = datetime.utcnow()
    filas = db.session.query(Appointment.id, Appointment.closer_result, Appointment.result, Appointment.start_time,
                             Appointment.closer_processed).all()
    return {f.id: derivar_estado(f, ahora) for f in filas}


def _desde_mapa(mapa, clave_sql, kind):
    """La expresión SQL que lee el valor de la fila en `mapa` (un parámetro JSON con claves de texto)."""
    datos = json.dumps({str(k): v for k, v in mapa.items() if v is not None})
    clave = cast(clave_sql, String)
    if db.engine.dialect.name == 'postgresql':
        valor = func.jsonb_extract_path_text(cast(literal(datos, String), JSONB), clave)
    else:  # SQLite (los tests)
        valor = func.json_extract(literal(datos, String), literal('$."') + clave + literal('"'))
    return cast(valor, Numeric) if kind == 'number' else cast(valor, Date) if kind == 'date' else valor


def _lazy_pago(columna, clave_sql, kind):
    def expr():
        datos = _memo('pagos', pagos)
        return _desde_mapa({cid: d[columna] for cid, d in datos.items()}, clave_sql, kind)
    return expr


def _lazy_agenda(clave_sql):
    return lambda: _desde_mapa(_memo('agendas', estados_de_agenda), clave_sql, 'text')


def _cliente_de(table):
    """La expresión del cliente de cada fila de `table`, o None si la tabla no apunta a un cliente."""
    if table.name == 'clients':
        return table.c.id
    if table.name == 'people':
        clientes = db.metadata.tables['clients'].alias('s_clientes')
        return select(func.max(clientes.c.id)).where(clientes.c.person_uuid == table.c.uuid).scalar_subquery()
    return table.c.get('client_id')


def campos(user, table, campo_cls):
    """Los campos `s.` de una tabla, listos para sumarse a su fuente."""
    out = {}
    cliente = _cliente_de(table)
    if cliente is not None:
        for key, (label, kind, es_monto, detalle) in PAGO.items():
            if es_monto and not exclusion.sees_amounts(user):
                continue
            lazy = _lazy_pago(_COLUMNA[key], cliente, kind)
            out[key] = campo_cls(key, label, 'Pagos', kind, None, detalle, lazy=lazy)
    if table.name == 'appointments':
        for key, (label, kind, _, detalle) in AGENDA.items():
            out[key] = campo_cls(key, label, 'Agenda', kind, None, detalle, lazy=_lazy_agenda(table.c.id))
    return out
