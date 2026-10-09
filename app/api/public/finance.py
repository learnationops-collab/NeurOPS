from flask import current_app, request, jsonify
from flask_login import current_user, login_required
from app import db
from app.models import User, Expense, AdPeriodSpend, MarketingBudget
from app.models.financial import FinancialSale, TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving
from datetime import date, datetime, time
import calendar
from functools import wraps
from . import bp
from sqlalchemy import or_, func

# Finanzas y Payroll son secciones del dashboard comercial (08/10/2026): las ve quien entra a
# Comercial como admin o como dirección comercial Y tiene el permiso «ver finanzas». El rol solo no
# alcanza (hay más de un admin) ni el permiso solo (lo da el operador en Gestión de equipo).
ROLES_FINANZAS = ('admin', 'director_comercial')


def puede_ver_finanzas(usuario):
    return (usuario.is_authenticated and usuario.role in ROLES_FINANZAS
            and bool(getattr(usuario, 'can_view_finance', False)))


def finance_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "No autenticado"}), 401
        if not puede_ver_finanzas(current_user):
            return jsonify({"error": "No tienes acceso a esta sección de finanzas"}), 403
        return f(*args, **kwargs)
    return decorated_function

@bp.route('/public/finance/team-members', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_team_members():
    if request.method == 'POST':
        data = request.get_json() or {}
        name = data.get('name')
        role = data.get('role')
        salary_type = data.get('salary_type', 'fijo')
        base_salary = float(data.get('base_salary', 0.0))
        payment_method = data.get('payment_method', '')
        
        if not name or not role:
            return jsonify({"error": "Nombre y rol son requeridos"}), 400
            
        member = TeamMember(
            name=name,
            role=role,
            salary_type=salary_type,
            base_salary=base_salary,
            payment_method=payment_method,
            is_active=True
        )
        db.session.add(member)
        db.session.commit()
        return jsonify(member.to_dict()), 201
        
    members = TeamMember.query.all()
    return jsonify([m.to_dict() for m in members]), 200

@bp.route('/public/finance/team-members/<int:id>', methods=['PUT', 'DELETE'])
@login_required
@finance_admin_required
def team_member_operations(id):
    member = TeamMember.query.get_or_404(id)
    
    if request.method == 'DELETE':
        db.session.delete(member)
        db.session.commit()
        return jsonify({"message": "Integrante eliminado"}), 200
        
    if request.method == 'PUT':
        data = request.get_json() or {}
        member.name = data.get('name', member.name)
        member.role = data.get('role', member.role)
        member.salary_type = data.get('salary_type', member.salary_type)
        member.base_salary = float(data.get('base_salary', member.base_salary))
        member.payment_method = data.get('payment_method', member.payment_method)
        if 'is_active' in data:
            member.is_active = bool(data['is_active'])
            
        db.session.commit()
        return jsonify(member.to_dict()), 200

# Fragmento del nombre en TeamMember (sin espacios) -> clave de la comision. Vive en el servicio de
# la nómina desde el 08/10/2026: Payroll lo usa también para el sueldo base de cada persona.
from app.services.nomina_service import CLAVES_POR_NOMBRE as _CLAVES_POR_NOMBRE  # noqa: E402


def comision_de_miembro(member, dynamic_commissions):
    """La comision autocalculada de un integrante: la de ventas si es variable, mas la de
    Fulfillment, que se cobra encima del sueldo fijo."""
    from app.services.fulfillment_commission_service import clave_de_miembro

    total = 0.0
    name_clean = member.name.lower().strip().replace(' ', '')
    if member.salary_type == 'variable':
        for fragmento, clave in _CLAVES_POR_NOMBRE:
            if fragmento in name_clean:
                total += dynamic_commissions.get(clave, 0.0)
                break
    clave_fulfillment = clave_de_miembro(member.name)
    if clave_fulfillment:
        total += dynamic_commissions.get('fulfillment', {}).get(clave_fulfillment, 0.0)
    return round(total, 2)


def get_commissions_calculated(month_str):
    """{clave -> comisión del mes} de quienes cobran por ventas, y en 'fulfillment' la de cada
    integrante de Fulfillment. Es la nómina de Payroll del mes calendario (`comisiones_del_rango`):
    desde el 08/10/2026 Finanzas y Payroll hacen la misma cuenta, y Finanzas también deja afuera
    las ventas sacadas de la nómina."""
    from app.services.fulfillment_commission_service import TASAS
    from app.services.nomina_service import comisiones_del_rango

    rango = _rango_del_mes(month_str or '')
    if not rango:
        return {}
    nomina = comisiones_del_rango(rango[0].date(), rango[1].date())
    nomina.pop('totales', None)
    fulfillment = {clave: nomina.pop(clave)['comision_total'] for clave in TASAS}
    comisiones = {clave: datos['comision_total'] for clave, datos in nomina.items()}
    comisiones['fulfillment'] = fulfillment
    return comisiones

def _seed_variable_members():
    """Crea en TeamMember a quienes cobran comision variable si no existen."""
    defaults = [
        {'name': 'Elias',       'role': 'Setter',              'salary_type': 'variable', 'payment_method': 'AirTM'},
        {'name': 'Paula',       'role': 'Setter',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        {'name': 'Jean Carlos', 'role': 'Closer',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        {'name': 'Facundo',     'role': 'Closer',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        # Closers con ventas en septiembre de 2026 que no estaban (08/10/2026); Gabriel es Hernandez.
        {'name': 'Nerina',      'role': 'Closer',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        {'name': 'Gabriel',     'role': 'Closer',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        {'name': 'Marlon',      'role': 'Director de Ventas',  'salary_type': 'variable', 'payment_method': 'Mercury'},
    ]
    changed = False
    for d in defaults:
        search_name = d['name'].lower().replace(' ', '')
        existing = TeamMember.query.filter(
            func.lower(func.replace(TeamMember.name, ' ', '')).like(f"%{search_name}%")
        ).first()
        if not existing:
            member = TeamMember(
                name=d['name'],
                role=d['role'],
                salary_type=d['salary_type'],
                base_salary=0.0,
                payment_method=d['payment_method'],
                is_active=True
            )
            db.session.add(member)
            changed = True
    if changed:
        db.session.commit()


def _item_de_nomina(member, month, fila, auto):
    """Un integrante en la nómina del mes, con los valores que VALEN: la fila guardada si la hay
    (o lo del integrante si no) y la comisión escrita a mano o, sin ella, la calculada en vivo
    (`auto`). `commissions_auto` va siempre, para mostrar el cálculo al lado de lo escrito."""
    if fila is None:
        return {
            "id": None,
            "member_id": member.id,
            "member_name": member.name,
            "month": month,
            "base_salary": member.base_salary or 0.0,
            "commissions": auto,
            "commissions_auto": auto,
            "commissions_manual": False,
            "bonuses": 0.0,
            "payment_method": member.payment_method,
            "is_paid": False,
            "paid_at": None,
            "created_at": None
        }
    manual = bool(fila.commissions_manual)
    return {**fila.to_dict(), "commissions": fila.commissions if manual else auto,
            "commissions_auto": auto, "commissions_manual": manual}


def nomina_del_mes(month):
    """La nómina del mes 'YYYY-MM': un dict por integrante, los activos y los que ya tienen la fila
    del mes guardada, con la forma de un item de GET /public/finance/payroll y los valores que valen
    (comisión manual o calculada en vivo, ver `_item_de_nomina`). Es lo que suman «por pagar» de
    Medios de pago y los sueldos del resumen: los tres dicen lo mismo (08/10/2026)."""
    # Quien cobra comisión variable tiene que estar, aunque nadie haya abierto la nómina todavía.
    _seed_variable_members()
    guardadas = {p.member_id: p for p in MonthlyPayroll.query.filter_by(month=month).all()}
    comisiones = get_commissions_calculated(month)
    return [_item_de_nomina(m, month, guardadas.get(m.id), comision_de_miembro(m, comisiones))
            for m in TeamMember.query.order_by(TeamMember.id).all()
            if m.is_active or m.id in guardadas]


class _MontoInvalido(ValueError):
    pass


def _monto(valor, campo):
    try:
        return float(valor or 0.0)
    except (TypeError, ValueError):
        raise _MontoInvalido(f"«{campo}» tiene que ser un número")


def total_de_item(item):
    """Lo que cobra un integrante en un item de `nomina_del_mes`: sueldo, comisión y bonos."""
    return (item.get('base_salary') or 0.0) + (item.get('commissions') or 0.0) + (item.get('bonuses') or 0.0)


@bp.route('/public/finance/payroll', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_payroll():
    """GET: la nómina del mes (`nomina_del_mes`). POST parcial (08/10/2026): {member_id, month} y
    SOLO los campos que cambian. La fila se crea con lo del integrante (sueldo y medio de pago) y
    bonos en 0. Mandar `commissions` la guarda como escrita a mano (`commissions_manual`); mandar
    `commissions_manual: false` la devuelve al cálculo automático. Antes el POST traía la fila
    entera, y cambiar el sueldo o tildar «pagado» congelaba la comisión de ese momento."""
    data = request.get_json(silent=True) or {}
    month = request.args.get('month') or data.get('month')
    if not month or len(month) != 7 or '-' not in month:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400

    if request.method == 'GET':
        return jsonify(nomina_del_mes(month)), 200

    try:
        member = db.session.get(TeamMember, int(data.get('member_id')))
    except (TypeError, ValueError):
        member = None
    if not member:
        return jsonify({"error": "member_id es requerido"}), 400
    try:
        montos = {campo: _monto(data[campo], campo)
                  for campo in ('base_salary', 'bonuses', 'commissions') if campo in data}
    except _MontoInvalido as e:
        return jsonify({"error": str(e)}), 400

    auto = comision_de_miembro(member, get_commissions_calculated(month))
    fila = MonthlyPayroll.query.filter_by(member_id=member.id, month=month).first()
    if not fila:
        fila = MonthlyPayroll(member_id=member.id, month=month, base_salary=member.base_salary or 0.0,
                              commissions=auto, commissions_manual=False, bonuses=0.0,
                              payment_method=member.payment_method or '', is_paid=False)
        db.session.add(fila)
    for campo in ('base_salary', 'bonuses'):
        if campo in montos:
            setattr(fila, campo, montos[campo])
    if 'commissions' in montos:
        fila.commissions = montos['commissions']
        fila.commissions_manual = True
    elif data.get('commissions_manual') is True and not fila.commissions_manual:
        fila.commissions, fila.commissions_manual = auto, True   # congelar la de hoy
    if data.get('commissions_manual') is False:
        fila.commissions_manual = False
    if 'payment_method' in data:
        fila.payment_method = data['payment_method'] or ''
    if 'is_paid' in data and bool(data['is_paid']) != bool(fila.is_paid):
        fila.is_paid = bool(data['is_paid'])
        fila.paid_at = datetime.utcnow() if fila.is_paid else None

    if not fila.commissions_manual:
        fila.commissions = auto  # la última foto del cálculo; la que vale se calcula en vivo
    db.session.commit()
    return jsonify(_item_de_nomina(member, month, fila, auto)), 200

@bp.route('/public/finance/balances', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_balances():
    if request.method == 'GET':
        return _saldos_del_periodo()

    month = request.args.get('month') or request.json.get('month')
    if not month or len(month) != 7 or '-' not in month:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400

    if request.method == 'POST':
        data = request.json or {}
        payment_method = data.get('payment_method')
        actual_amount = float(data.get('actual_amount', 0.0))
        expected_amount = float(data.get('expected_amount', 0.0))
        
        if not payment_method:
            return jsonify({"error": "payment_method es requerido"}), 400
            
        balance = MonthlyPaymentMethodBalance.query.filter_by(month=month, payment_method=payment_method).first()
        if not balance:
            balance = MonthlyPaymentMethodBalance(
                month=month,
                payment_method=payment_method,
                actual_amount=actual_amount,
                expected_amount=expected_amount
            )
            db.session.add(balance)
        else:
            if 'actual_amount' in data:
                balance.actual_amount = actual_amount
            if 'expected_amount' in data:
                balance.expected_amount = expected_amount
                
        db.session.commit()
        return jsonify(balance.to_dict()), 200


def _saldos_del_periodo():
    """GET de los saldos por pasarela: el saldo cargado a mano y lo que hay que pagar por cada una
    según la nómina. Son libros mensuales: en un rango (08/10/2026) cada mes cuenta entero si el
    rango lo cubre y prorrateado por días si lo corta (ver `meses_del_rango`)."""
    periodo, error = _periodo_de_la_consulta()
    if error:
        return error

    default_methods = ['Mercury', 'AirTM']
    actual_by_method = {m: 0.0 for m in default_methods}
    ids = {}
    # Calcula "por pagar" por pasarela desde la nómina del mes: los mismos integrantes y montos que
    # muestra la pestaña Nómina (los activos y los que ya tienen nómina guardada).
    expected_by_method = {m: 0.0 for m in default_methods}

    for mes, parte in periodo['meses']:
        for b in MonthlyPaymentMethodBalance.query.filter_by(month=mes).all():
            if b.payment_method in actual_by_method:
                actual_by_method[b.payment_method] += (b.actual_amount or 0.0) * parte
                ids[b.payment_method] = b.id
        for item in nomina_del_mes(mes):
            method = item.get('payment_method')
            # Un medio que no es una pasarela de pago ('Stripe' de los integrantes viejos, o vacío)
            # es el que la tabla de nómina muestra como elegido: el selector solo ofrece Mercury y
            # AirTM y cae en el primero. Antes ese sueldo no se sumaba a ninguna pasarela.
            if method not in expected_by_method:
                method = default_methods[0]
            expected_by_method[method] += total_de_item(item) * parte

    result = []
    total_actual = 0.0
    total_expected = 0.0

    for m in default_methods:
        actual = round(actual_by_method[m], 2)
        expected = round(expected_by_method.get(m, 0.0), 2)
        result.append({
            # La fila guardada solo existe por mes: en un rango no hay una que editar.
            "id": ids.get(m) if periodo['mes'] else None,
            "month": periodo['mes'],
            "payment_method": m,
            "actual_amount": actual,
            "expected_amount": expected
        })
        total_actual += actual
        total_expected += expected

    return jsonify({
        **_periodo_a_dict(periodo),
        "balances": result,
        "total_actual": round(total_actual, 2),
        "total_expected": round(total_expected, 2)
    }), 200

def _rango_del_mes(month):
    """(inicio, fin) del mes 'YYYY-MM', o None si el formato no sirve."""
    try:
        year, month_num = map(int, month.split('-'))
        last_day = calendar.monthrange(year, month_num)[1]
        return datetime(year, month_num, 1), datetime(year, month_num, last_day, 23, 59, 59, 999999)
    except Exception:
        return None


# ------------------------------------------------------------------------------------------------
# El período de Finanzas (08/10/2026): un mes, como siempre, o un rango personalizado de fechas.
#
# Lo fechado (las ventas del resumen, los gastos de software) se filtra por las fechas exactas. Los
# libros mensuales (nómina, saldos por pasarela, presupuesto de anuncios) se guardan por mes
# calendario: en un rango, el mes que el rango cubre entero cuenta entero y el que corta se
# prorratea por días (monto × días del rango en ese mes / días del mes). Payroll prorratea el sueldo
# base con la misma regla. Los ahorros son la excepción: ver `_ahorros_del_periodo`.

# Cada mes de un rango pide su nómina (con las comisiones de sus ventas): se corta en dos años.
MAX_MESES_PERIODO = 24


def _fecha_iso(texto):
    try:
        return datetime.strptime(texto or '', '%Y-%m-%d').date()
    except ValueError:
        return None


def meses_del_rango(desde, hasta):
    """[(mes 'YYYY-MM', parte)] de cada mes calendario que toca el rango de `date`s: parte es 1 si el
    rango lo cubre entero, y si lo corta los días del rango en ese mes sobre los días del mes."""
    meses = []
    anio, mes = desde.year, desde.month
    while (anio, mes) <= (hasta.year, hasta.month):
        dias_del_mes = calendar.monthrange(anio, mes)[1]
        inicio = max(desde, date(anio, mes, 1))
        fin = min(hasta, date(anio, mes, dias_del_mes))
        meses.append(('%04d-%02d' % (anio, mes), ((fin - inicio).days + 1) / dias_del_mes))
        anio, mes = (anio + 1, 1) if mes == 12 else (anio, mes + 1)
    return meses


def periodo_pedido(args):
    """El período de un GET de Finanzas: `month` (YYYY-MM), o `start_date` y `end_date` (YYYY-MM-DD)
    para un rango (dado vuelta si llega al revés, como en el tablero). Devuelve
    {desde, hasta, mes, meses}, donde `mes` es el 'YYYY-MM' si el período es justo un mes calendario
    (un rango del 1 al último día también) y si no None; o None si no sirve."""
    month = args.get('month')
    if month:
        rango = _rango_del_mes(month) if len(month) == 7 and '-' in month else None
        if not rango:
            return None
        desde, hasta = rango[0].date(), rango[1].date()
    else:
        desde, hasta = _fecha_iso(args.get('start_date')), _fecha_iso(args.get('end_date'))
        if not desde or not hasta:
            return None
        if desde > hasta:
            desde, hasta = hasta, desde
    meses = meses_del_rango(desde, hasta)
    mes = meses[0][0] if len(meses) == 1 and meses[0][1] == 1 else None
    return {'desde': desde, 'hasta': hasta, 'mes': mes, 'meses': meses}


def _periodo_de_la_consulta():
    """(periodo, None) con el período del GET, o (None, respuesta 400) si falta o no sirve."""
    periodo = periodo_pedido(request.args)
    if not periodo:
        return None, (jsonify({"error": "Parámetro 'month' (YYYY-MM), o 'start_date' y 'end_date' "
                                        "(YYYY-MM-DD), es requerido"}), 400)
    if len(periodo['meses']) > MAX_MESES_PERIODO:
        return None, (jsonify({"error": "El período no puede pasar de %d meses" % MAX_MESES_PERIODO}), 400)
    return periodo, None


def _periodo_a_dict(periodo):
    return {"month": periodo['mes'], "desde": periodo['desde'].isoformat(), "hasta": periodo['hasta'].isoformat()}


def _limites(periodo):
    """(primer instante, último instante) del período, para filtrar lo fechado."""
    return datetime.combine(periodo['desde'], time.min), datetime.combine(periodo['hasta'], time.max)


def _ahorros_del_periodo(periodo):
    """Los ahorros del período. Se cargan a mano, un monto por mes, y no se acumulan día a día como
    un sueldo: en un rango cuentan los meses que el rango cubre enteros, y un mes cortado no aporta
    nada (repartirlo por días mostraría un ahorro que nadie hizo)."""
    enteros = [mes for mes, parte in periodo['meses'] if parte == 1]
    if not enteros:
        return 0.0
    return sum(s.savings or 0.0 for s in MonthlySaving.query.filter(MonthlySaving.month.in_(enteros)).all())


def _presupuesto_de_anuncios(periodo):
    """El presupuesto de anuncios del período: uno por mes, prorrateado si el rango corta el mes."""
    total = 0.0
    for mes, parte in periodo['meses']:
        anio, num = map(int, mes.split('-'))
        rec = MarketingBudget.query.filter_by(date=date(anio, num, 1)).first()
        total += (rec.budget or 0.0) * parte if rec else 0.0
    return total


def _gastado_en_anuncios(desde, hasta):
    """La inversión cargada en Marketing cuyos períodos tocan [desde, hasta] (como siempre: entera)."""
    ad_spends = AdPeriodSpend.query.filter(
        AdPeriodSpend.start_date <= hasta,
        AdPeriodSpend.end_date >= desde
    ).all()
    return round(sum(sp.spend for sp in ad_spends), 2)


def _gasto_a_dict(gasto):
    return {"id": gasto.id, "description": gasto.description, "amount": float(gasto.amount or 0.0),
            "category": gasto.category, "date": gasto.date.isoformat() if gasto.date else None}


@bp.route('/public/finance/software', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_software_expenses():
    """Los gastos de software del período (un mes o, desde el 08/10/2026, un rango de fechas), los
    mismos que suma el resumen. Antes la pestaña Software usaba /admin/finance/*, que es solo de
    admin y operaciones: la dirección comercial con «ver finanzas» quedaba afuera de una de las
    cinco vistas."""
    if request.method == 'POST':
        data = request.get_json() or {}
        try:
            fecha = datetime.strptime(data.get('date') or '', '%Y-%m-%d')
            monto = float(data.get('amount'))
        except (TypeError, ValueError):
            return jsonify({"error": "Fecha (YYYY-MM-DD) y monto son requeridos"}), 400
        descripcion = (data.get('description') or '').strip()
        if not descripcion:
            return jsonify({"error": "La descripción es requerida"}), 400
        gasto = Expense(description=descripcion, amount=monto, date=fecha, category='software', is_recurring=False)
        db.session.add(gasto)
        db.session.commit()
        return jsonify(_gasto_a_dict(gasto)), 201

    periodo, error = _periodo_de_la_consulta()
    if error:
        return error
    inicio, fin = _limites(periodo)
    gastos = Expense.query.filter(
        Expense.date >= inicio, Expense.date <= fin, func.lower(Expense.category) == 'software'
    ).order_by(Expense.date.asc()).all()
    return jsonify([_gasto_a_dict(g) for g in gastos]), 200


@bp.route('/public/finance/software/<int:id>', methods=['DELETE'])
@login_required
@finance_admin_required
def delete_software_expense(id):
    gasto = Expense.query.get_or_404(id)
    if (gasto.category or '').lower() != 'software':
        return jsonify({"error": "Solo se borran gastos de software desde acá"}), 400
    db.session.delete(gasto)
    db.session.commit()
    return jsonify({"message": "Gasto eliminado"}), 200


@bp.route('/public/finance/comisiones/tasas', methods=['GET', 'PUT'])
@login_required
@finance_admin_required
def comisiones_tasas():
    """Los % de comisión de la nómina (08/10/2026): GET los que valen en `mes` (por defecto, el
    actual) con el historial de juegos guardados; PUT guarda un juego que vale desde
    `vigente_desde`. Los edita quien entra a Finanzas: admin o dirección comercial con el permiso."""
    from app.services import comision_tasas_service as tasas_service

    if request.method == 'PUT':
        data = request.get_json() or {}
        try:
            juego = tasas_service.guardar(data.get('vigente_desde'), data.get('tasas'), current_user)
        except tasas_service.TasasInvalidas as e:
            return jsonify({"error": str(e)}), 400
        return jsonify({"vigente_desde": data.get('vigente_desde'), "tasas": juego,
                        "historial": tasas_service.historial()}), 200

    mes = request.args.get('mes') or datetime.utcnow().strftime('%Y-%m')
    if not _rango_del_mes(mes):
        return jsonify({"error": "Parámetro 'mes' (YYYY-MM) inválido"}), 400
    juego, desde = tasas_service.vigentes(mes)
    return jsonify({
        "mes": mes, "vigente_desde": desde, "tasas": juego, "historial": tasas_service.historial(),
        "personas": {g: [{"clave": c, "nombre": n} for c, n in lista] for g, lista in tasas_service.PERSONAS.items()},
        "programas": list(tasas_service.PROGRAMAS), "fuentes": list(tasas_service.FUENTES),
    }), 200


@bp.route('/public/finance/savings', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_savings():
    if request.method == 'GET':
        periodo, error = _periodo_de_la_consulta()
        if error:
            return error
        return jsonify({**_periodo_a_dict(periodo), "savings": round(_ahorros_del_periodo(periodo), 2)}), 200

    month = request.args.get('month') or request.json.get('month')
    if not month or len(month) != 7 or '-' not in month:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400
        
    if request.method == 'POST':
        data = request.json or {}
        savings_val = float(data.get('savings', 0.0))
        
        saving = MonthlySaving.query.filter_by(month=month).first()
        if not saving:
            saving = MonthlySaving(month=month, savings=savings_val)
            db.session.add(saving)
        else:
            saving.savings = savings_val
            
        db.session.commit()
        return jsonify(saving.to_dict()), 200

@bp.route('/public/finance/ad-budget', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_ad_budget():
    if request.method == 'GET':
        # El presupuesto es por mes (prorrateado si un rango corta el mes); lo gastado son los
        # períodos de inversión de Marketing que tocan el período.
        periodo, error = _periodo_de_la_consulta()
        if error:
            return error
        return jsonify({
            **_periodo_a_dict(periodo),
            "budget": round(_presupuesto_de_anuncios(periodo), 2),
            "spent": _gastado_en_anuncios(periodo['desde'], periodo['hasta'])
        }), 200

    month = request.args.get('month') or (request.json.get('month') if request.is_json else None)
    if not month or len(month) != 7 or '-' not in month:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400
        
    try:
        year, month_num = map(int, month.split('-'))
        start_date = datetime(year, month_num, 1).date()
        last_day = calendar.monthrange(year, month_num)[1]
        end_date = datetime(year, month_num, last_day).date()
    except Exception:
        return jsonify({"error": "Mes con formato inválido"}), 400

    if request.method == 'POST':
        data = request.json or {}
        budget_val = float(data.get('budget', 0.0))
        
        budget_rec = MarketingBudget.query.filter_by(date=start_date).first()
        if not budget_rec:
            budget_rec = MarketingBudget(date=start_date, budget=budget_val, spent=0.0)
            db.session.add(budget_rec)
        else:
            budget_rec.budget = budget_val
            
        db.session.commit()

        return jsonify({
            "month": month,
            "budget": budget_rec.budget,
            "spent": _gastado_en_anuncios(start_date, end_date)
        }), 200

@bp.route('/public/finance/summary', methods=['GET'])
@login_required
@finance_admin_required
def get_finance_summary():
    """El resumen del período: un mes o, desde el 08/10/2026, un rango de fechas (`start_date` y
    `end_date`). Ingresos y software van por las fechas exactas; nómina, anuncios y saldos son
    libros mensuales y en un rango se prorratean por días (ver `meses_del_rango`); los ahorros
    cuentan por mes entero (ver `_ahorros_del_periodo`)."""
    periodo, error = _periodo_de_la_consulta()
    if error:
        return error
    start_date, end_date = _limites(periodo)

    sales = FinancialSale.query.filter(
        FinancialSale.date >= start_date,
        FinancialSale.date <= end_date
    ).all()
    
    total_income = 0.0
    income_by_method = {}
    
    for s in sales:
        sale_is_completed = not s.estado or s.estado.strip() == "" or s.estado.lower() in ("completada", "confirmada")
        if not sale_is_completed:
            continue
            
        monto_original = float(s.monto or 0.0)
        if s.metodo_pago and s.metodo_pago.strip().lower() == 'stripe':
            monto_ajustado = monto_original * 0.955
        elif s.metodo_pago and s.metodo_pago.strip().lower() == 'hotmart':
            monto_ajustado = monto_original * 0.911
        else:
            monto_ajustado = monto_original
            
        total_income += monto_ajustado
        
        method_name = s.metodo_pago or "No Especificado"
        if method_name not in income_by_method:
            income_by_method[method_name] = {"count": 0, "total": 0.0}
        income_by_method[method_name]["count"] += 1
        income_by_method[method_name]["total"] += monto_ajustado
        
    income_breakdown = []
    for method, stats in income_by_method.items():
        income_breakdown.append({
            "metodo_pago": method,
            "count": stats["count"],
            "total": round(stats["total"], 2)
        })
    income_breakdown.sort(key=lambda x: x["total"], reverse=True)
    
    software_expenses = Expense.query.filter(
        Expense.date >= start_date,
        Expense.date <= end_date,
        func.lower(Expense.category) == 'software'
    ).all()
    total_software = round(sum(e.amount for e in software_expenses), 2)

    total_anuncios = round(_presupuesto_de_anuncios(periodo), 2)

    # Lo mismo que suma la pestaña Nómina: sale de la misma cuenta, mes por mes.
    total_sueldos = round(sum(sum(total_de_item(item) for item in nomina_del_mes(mes)) * parte
                              for mes, parte in periodo['meses']), 2)

    # Los rubros ya redondeados: el total es la suma de lo que muestra la tabla de gastos.
    total_expenses = total_software + total_anuncios + total_sueldos

    total_actual = 0.0
    total_expected = 0.0
    for mes, parte in periodo['meses']:
        for b in MonthlyPaymentMethodBalance.query.filter_by(month=mes).all():
            total_actual += (b.actual_amount or 0.0) * parte
            total_expected += (b.expected_amount or 0.0) * parte

    savings_val = _ahorros_del_periodo(periodo)

    profit = total_income - total_expenses
    balance_neto = total_income - total_expenses + savings_val

    return jsonify({
        **_periodo_a_dict(periodo),
        "kpis": {
            "total_income": round(total_income, 2),
            "total_expenses": round(total_expenses, 2),
            "profit": round(profit, 2),
            "balance": round(total_income - total_expenses, 2),
            "balance_neto": round(balance_neto, 2),
            "total_actual_balances": round(total_actual, 2),
            "total_expected_balances": round(total_expected, 2),
            "savings": round(savings_val, 2)
        },
        "expenses_breakdown": {
            "software": round(total_software, 2),
            "anuncios": round(total_anuncios, 2),
            "sueldos": round(total_sueldos, 2)
        },
        "income_breakdown": income_breakdown
    }), 200


def _periodo_pedido():
    """(desde, hasta) como fechas, de `start_date`/`end_date` (YYYY-MM-DD) o de `month` (YYYY-MM).
    None si falta o no se entiende, o si el rango está al revés."""
    inicio, fin = request.args.get('start_date'), request.args.get('end_date')
    try:
        if inicio or fin:
            desde = datetime.strptime(inicio or '', '%Y-%m-%d').date()
            hasta = datetime.strptime(fin or '', '%Y-%m-%d').date()
        else:
            rango = _rango_del_mes(request.args.get('month') or '')
            if not rango:
                return None
            desde, hasta = rango[0].date(), rango[1].date()
    except ValueError:
        return None
    return (desde, hasta) if desde <= hasta else None


@bp.route('/public/finance/procedencia', methods=['GET'])
@login_required
@finance_admin_required
def get_finance_procedencia():
    """El ingreso del período abierto por procedencia (workshop, setting, VSL, Fulfillment, sin
    procedencia), para el panel del Resumen (08/10/2026). Los baldes suman el ingreso del Resumen:
    el criterio está en `procedencia_ingresos_service`. Acepta un mes o un rango de fechas, para
    cuando Finanzas deje de mirarse solo por mes."""
    from app.services.procedencia_ingresos_service import procedencia_de_ingresos

    periodo = _periodo_pedido()
    if not periodo:
        return jsonify({"error": "Parámetros 'start_date' y 'end_date' (YYYY-MM-DD) o 'month' (YYYY-MM) requeridos"}), 400
    return jsonify(procedencia_de_ingresos(*periodo)), 200


@bp.route('/public/finance/atribucion/personas', methods=['GET'])
@login_required
@finance_admin_required
def personas_para_atribuir():
    """Los setters y closers que se pueden elegir al cambiar la atribución de una venta en Payroll
    (08/10/2026): los activos y los inactivos que cobran comisión (`personas_atribuibles`)."""
    from app.services.atribucion_venta_service import personas_atribuibles

    return jsonify(personas_atribuibles()), 200


@bp.route('/public/finance/ventas/<int:sale_id>/atribucion', methods=['PUT'])
@login_required
@finance_admin_required
def cambiar_atribucion_de_venta(sale_id):
    """Cambia el setter y/o el closer de una venta desde Payroll (08/10/2026), sin pasar por la vista
    del director comercial: {closer_id?, setter_id?} (ids de usuario) y, opcionales, `desde`/`hasta`
    (YYYY-MM-DD), el período de Payroll que se está mirando. Solo toca esos dos datos (el criterio, en
    `atribucion_venta_service`) y es de quien ve Finanzas, como el resto de Payroll. La edición general
    de ventas (`PUT /public/financial-sales/<id>`) no servía: pide el correo del closer escrito a mano,
    cambia cualquier campo y la usa también quien no ve Finanzas."""
    from app.api.public.financial_sales import _propagar_lote_a_sheets
    from app.services import atribucion_venta_service as atribucion

    venta = db.session.get(FinancialSale, sale_id)
    if not venta:
        return jsonify({"error": "Venta no encontrada"}), 404
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}

    def fecha(clave):
        # Un período que no se entiende no corta el cambio: la agenda se busca solo con todas las ventas.
        return _fecha_iso(data[clave]) if isinstance(data.get(clave), str) else None

    try:
        resultado = atribucion.cambiar_atribucion(
            venta, closer_id=data.get('closer_id'), setter_id=data.get('setter_id'),
            desde=fecha('desde'), hasta=fecha('hasta'))
    except atribucion.AtribucionInvalida as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400

    # La hoja de ventas queda al día, como con la edición de Operaciones, pero fuera de la request.
    if venta.marca_temporal:
        _propagar_lote_a_sheets(current_app._get_current_object(), [(venta.marca_temporal, {
            "email_vendedor": venta.email_vendedor, "nombre_cliente": venta.nombre_cliente,
            "telefono": venta.telefono, "mail_cliente": venta.mail_cliente, "tipo_pago": venta.tipo_pago,
            "monto": venta.monto, "segundo_pago": venta.segundo_pago, "metodo_pago": venta.metodo_pago,
            "examen": venta.examen, "instagram": venta.instagram, "setter": venta.setter,
            "estado": venta.estado,
        })])
    return jsonify(resultado), 200
