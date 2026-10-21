"""Los números de admin (dashboard, Finanzas, Leads) desde los cobros y las ventas (Etapa 2c, parte 6 de
docs/plan_personas.md): antes salían de `Enrollment`/`Payment`, el espejo que se dejó de escribir.

Mismos criterios que Comercial, para que admin no dé distinto:
  · cash = cobros (`FinancialSale`) completados (`comercial_vocabulario.venta_completada`), por su fecha;
  · fee de la pasarela = bruto menos `commission_service.cash_neto_de`;
  · venta = cobro completo o parcial (`ComercialService.clasificar_venta`), las señas y cuotas no;
  · closer de un cobro = `resolver_nombre_closer(email_vendedor)`; programa = el del `tipo_pago`;
  · deuda = la de cada venta (`deuda_service.saldo`: acordado menos cobrado).

Los filtros de admin llegan como ids de `User` (closers) y de `Program`: se traducen a nombre de closer
y código de programa (AL/RR/SI). Los imports van adentro de cada función: `closer_service` importa
`dashboard_service`, que importa este módulo.
"""
import unicodedata
from datetime import datetime, time

from app import db
from app.models import FinancialSale, Program, Sale, User


def _norm(texto):
    plano = unicodedata.normalize('NFKD', texto or '').encode('ascii', 'ignore').decode()
    return ' '.join(plano.lower().split())


def limites(desde, hasta):
    """(datetime inicio, datetime fin) de un rango de fechas o datetimes."""
    if not isinstance(desde, datetime):
        desde = datetime.combine(desde, time.min)
    if not isinstance(hasta, datetime):
        hasta = datetime.combine(hasta, time.max)
    return desde, hasta


def codigo_de_programa(nombre):
    """AL/RR/SI de un nombre de `Program` («Ace Learners», «Residency Roadmap»...), o None."""
    from app.services.closer_service import PROGRAM_LABELS
    n = _norm(nombre)
    for codigo, etiqueta in PROGRAM_LABELS.items():
        e = _norm(etiqueta)
        if n in (e, codigo.lower()) or n.startswith(e.split(' ')[0]) or e.startswith(n):
            return codigo
    return None


def codigos(program_ids):
    """Los códigos de programa de esos `Program`, o None si no se filtra por programa."""
    if not program_ids:
        return None
    return {c for c in (codigo_de_programa(p.name) for p in Program.query.filter(Program.id.in_(program_ids))) if c}


def etiqueta_de(codigo):
    from app.services.closer_service import PROGRAM_LABELS
    return PROGRAM_LABELS.get(codigo) or 'Sin programa'


def nombres_de_closers(closer_ids):
    """Los nombres canónicos (normalizados) de esos closers, o None si no se filtra por closer."""
    if not closer_ids:
        return None
    from app.services.closer_name_service import resolver_nombre_closer
    nombres = set()
    for u in User.query.filter(User.id.in_(closer_ids)):
        for valor in (u.email, u.username):
            if valor:
                nombres.add(_norm(resolver_nombre_closer(valor)))
    return nombres


def closer_de(email_vendedor):
    from app.services.closer_name_service import resolver_nombre_closer
    return resolver_nombre_closer(email_vendedor)


def es_del_closer(email_vendedor, nombres):
    return nombres is None or _norm(closer_de(email_vendedor)) in nombres


def programa_de_cobro(v):
    """(código o None, tipo canónico, ¿es venta?) de un cobro."""
    from app.services.closer_service import REAL_SALE_TIPOS, _program_from_examen
    from app.services.sheets_service import SheetsService
    codigo, tipo = SheetsService.parse_tipo_pago(v.tipo_pago)
    if not codigo:
        examen = _program_from_examen(v.examen)
        codigo = next((c for c, e in _labels().items() if e == examen), None)
    return codigo, (tipo or 'otro'), (tipo in REAL_SALE_TIPOS)


def _labels():
    from app.services.closer_service import PROGRAM_LABELS
    return PROGRAM_LABELS


def cobros(desde, hasta, closer_ids=None, program_ids=None):
    """Los cobros completados del rango, de esos closers y programas (None = todos)."""
    from app.services.comercial_vocabulario import venta_completada
    desde, hasta = limites(desde, hasta)
    nombres, cods = nombres_de_closers(closer_ids), codigos(program_ids)
    salida = []
    for v in FinancialSale.query.filter(FinancialSale.date >= desde, FinancialSale.date <= hasta) \
            .order_by(FinancialSale.date.asc(), FinancialSale.id.asc()):
        if not venta_completada(v) or not es_del_closer(v.email_vendedor, nombres):
            continue
        if cods is not None and programa_de_cobro(v)[0] not in cods:
            continue
        salida.append(v)
    return salida


def fee(v):
    from app.services.commission_service import cash_neto_de
    return float(v.monto or 0) - cash_neto_de(v.monto, v.metodo_pago)


def neto(v):
    from app.services.commission_service import cash_neto_de
    return cash_neto_de(v.monto, v.metodo_pago)


def comision_estimada_closers(lista):
    """La comisión de closers que admin descuenta como gasto: `CLOSER_RATE` del neto de los cobros que
    tienen closer. Es una estimación (la de verdad es la de la nómina, `nomina_service`)."""
    from app.services.closer_name_service import SIN_CLOSER
    from app.services.commission_service import CLOSER_RATE
    return sum(neto(v) for v in lista if closer_de(v.email_vendedor) != SIN_CLOSER) * CLOSER_RATE


def ventas_nuevas(desde, hasta, closer_ids=None, program_ids=None):
    """Las ventas 'new' vendidas en el rango (antes, las inscripciones del período)."""
    desde, hasta = limites(desde, hasta)
    nombres, cods = nombres_de_closers(closer_ids), codigos(program_ids)
    q = Sale.query.filter(Sale.kind == 'new', Sale.sold_at >= desde, Sale.sold_at <= hasta)
    if cods is not None:
        q = q.filter(Sale.program_code.in_(sorted(cods) or ['']))
    return [s for s in q.order_by(Sale.sold_at.asc()) if es_del_closer(s.closer_email, nombres)]


def revenue_potencial(ventas):
    """Lo acordado en `ventas` (o el de lista de su época). Las canceladas o reembolsadas no cuentan: el
    revenue es lo acordado hasta que se declara imposible (decisión de Santiago, 21/10/2026)."""
    from app.services.deuda_service import total_de
    return sum(t for t in (total_de(v) for v in ventas if v.status not in ('cancelled', 'refunded'))
               if t is not None)


def ventas_de_clientes(clientes):
    """{sale: client_id} de las ventas de esos clientes: las de su persona (al cliente más viejo de la
    persona entre los dados) o, sin persona, las del cliente."""
    cliente_de_persona, sueltos = {}, set()
    for c in sorted((c for c in clientes if c is not None), key=lambda c: c.id):
        if c.person_uuid:
            cliente_de_persona.setdefault(c.person_uuid, c.id)
        else:
            sueltos.add(c.id)
    salida = {}
    personas = sorted(cliente_de_persona)
    for i in range(0, len(personas), 500):
        for s in Sale.query.filter(Sale.person_uuid.in_(personas[i:i + 500])):
            salida[s] = cliente_de_persona[s.person_uuid]
    sueltos = sorted(sueltos)
    for i in range(0, len(sueltos), 500):
        for s in Sale.query.filter(Sale.client_id.in_(sueltos[i:i + 500]), Sale.person_uuid.is_(None)):
            salida[s] = s.client_id
    return salida


def saldos(ventas):
    """{sale_id: lo que todavía debe} (`deuda_service.saldo`), con lo cobrado de cada una en una consulta."""
    from app.services.comercial_vocabulario import venta_completada
    from app.services.deuda_service import saldo
    ventas = list(ventas)
    ids = [s.id for s in ventas]
    cobrado = {}
    for i in range(0, len(ids), 500):
        for fila in FinancialSale.query.filter(FinancialSale.sale_id.in_(ids[i:i + 500])):
            if venta_completada(fila):
                cobrado[fila.sale_id] = cobrado.get(fila.sale_id, 0.0) + float(fila.monto or 0)
    return {s.id: saldo(s, cobrado.get(s.id, 0.0)) for s in ventas}


def filtrar_ventas(ventas, closer_ids=None, program_ids=None):
    nombres, cods = nombres_de_closers(closer_ids), codigos(program_ids)
    return [s for s in ventas if es_del_closer(s.closer_email, nombres)
            and (cods is None or s.program_code in cods)]


def primer_cobro():
    """La fecha del cobro más viejo (para «todo el período»), o None."""
    return db.session.query(db.func.min(FinancialSale.date)).scalar()


def ultimo_cobro():
    return db.session.query(db.func.max(FinancialSale.date)).scalar()


def clientes_con_cobros_de(clientes):
    """{client_id: [cobros completados]} de esos clientes: los de su persona (al cliente más viejo de la
    persona) o, sin persona, los atados por id."""
    from app.services.comercial_vocabulario import venta_completada
    cliente_de_persona, sueltos = {}, set()
    for c in sorted((c for c in clientes if c is not None), key=lambda c: c.id):
        if c.person_uuid:
            cliente_de_persona.setdefault(c.person_uuid, c.id)
        else:
            sueltos.add(c.id)
    salida = {}
    personas = sorted(cliente_de_persona)
    for i in range(0, len(personas), 500):
        for v in FinancialSale.query.filter(FinancialSale.person_uuid.in_(personas[i:i + 500])):
            if venta_completada(v):
                salida.setdefault(cliente_de_persona[v.person_uuid], []).append(v)
    sueltos = sorted(sueltos)
    for i in range(0, len(sueltos), 500):
        for v in FinancialSale.query.filter(FinancialSale.client_id.in_(sueltos[i:i + 500]),
                                            FinancialSale.person_uuid.is_(None)):
            if venta_completada(v):
                salida.setdefault(v.client_id, []).append(v)
    return salida


def nombre_de_cobro(v):
    c = v.contacto()
    return c.get('nombre_cliente') or c.get('mail_cliente') or 'Sin nombre'

