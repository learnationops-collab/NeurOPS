from flask import request, jsonify
from flask_login import current_user, login_required
from app import db
from app.models import User, Expense, AdPeriodSpend, MarketingBudget
from app.models.financial import FinancialSale, FinancialAgenda, TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving
from datetime import datetime
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

def resolve_closer_name(email_or_name):
    """Nombre canonico del closer. La logica vive en `closer_name_service`,
    que resuelve contra los usuarios y alias reales antes de caer al diccionario
    historico — antes la misma persona se partia en varias opciones del filtro."""
    from app.services.closer_name_service import resolver_nombre_closer
    return resolver_nombre_closer(email_or_name)

def split_tipo_pago(tp):
    if not tp:
        return "Desconocido", "No Especificado"
    if " - " in tp:
        parts = tp.split(" - ", 1)
        return parts[0].strip(), parts[1].strip()
    return "Desconocido", tp.strip()

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

# Fragmento del nombre en TeamMember (sin espacios) -> clave de la comision.
_CLAVES_POR_NOMBRE = (
    ('elias', 'elias'),
    ('paula', 'paula'),
    ('jeancarlo', 'jeancarlo'),
    ('facundo', 'facundo'),
    ('marlon', 'marlon'),
)


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
    from app.services.commission_service import SETTERS_CON_COMISION, CLOSERS_CON_COMISION

    try:
        year, month = map(int, month_str.split('-'))
        start_date = datetime(year, month, 1)
        last_day = calendar.monthrange(year, month)[1]
        end_date = datetime(year, month, last_day, 23, 59, 59, 999999)
    except Exception:
        return {}

    sales = FinancialSale.query.filter(
        FinancialSale.date >= start_date,
        FinancialSale.date <= end_date
    ).all()

    all_agendas = FinancialAgenda.query.all()
    from app.services.attribution_service import AttributionService
    attribution_map = AttributionService.get_sales_attribution(sales=sales, agendas=all_agendas)

    recaudado = {clave: 0.0 for clave in (*SETTERS_CON_COMISION.values(), *CLOSERS_CON_COMISION.values())}
    marlon_recaudado = 0.0
    completadas = []

    for s in sales:
        sale_is_completed = not s.estado or s.estado.strip() == "" or s.estado.lower() in ("completada", "confirmada")
        if not sale_is_completed:
            continue
        completadas.append(s)

        resolved_setter = None

        agenda = attribution_map.get(s.id)
        if agenda:
            is_valid_lead_source = (
                agenda.nombre and
                agenda.nombre.strip() and
                agenda.nombre.lower() not in ('s/f', 'n/a', '') and
                'entrevista' not in agenda.nombre.lower() and
                'diagnostica' not in agenda.nombre.lower() and
                'diagnóstica' not in agenda.nombre.lower()
            )
            if is_valid_lead_source:
                resolved_setter = agenda.nombre

        if not resolved_setter:
            s_setter = s.setter
            if s_setter and s_setter.strip() and s_setter != 'Sin Setter' and s_setter != 'Confirmada':
                resolved_setter = s_setter

        final_setter = resolved_setter or "Sin Setter"
        final_closer = resolve_closer_name(s.email_vendedor)

        monto_original = float(s.monto or 0.0)
        if s.metodo_pago and s.metodo_pago.strip().lower() == 'stripe':
            monto_ajustado = monto_original * 0.955
        elif s.metodo_pago and s.metodo_pago.strip().lower() == 'hotmart':
            monto_ajustado = monto_original * 0.911
        else:
            monto_ajustado = monto_original

        setter_clave = SETTERS_CON_COMISION.get(final_setter.strip().lower())
        if setter_clave:
            recaudado[setter_clave] += monto_ajustado

        closer_clave = CLOSERS_CON_COMISION.get(final_closer.strip().lower())
        if closer_clave:
            recaudado[closer_clave] += monto_ajustado

            prog, simple_tp = split_tipo_pago(s.tipo_pago)
            is_renovacion = simple_tp and ("renovacion" in simple_tp.lower() or "renovación" in simple_tp.lower())
            if not is_renovacion:
                marlon_recaudado += monto_ajustado

    # Los % del mes: editables desde Payroll, cada juego vale desde un mes (ver comision_tasas_service).
    from app.services.comision_tasas_service import vigentes
    tasas, _ = vigentes(month_str)
    comisiones = {clave: round(recaudado[clave] * tasas['setters'][clave] / 100, 2)
                  for clave in SETTERS_CON_COMISION.values()}
    comisiones.update({clave: round(recaudado[clave] * tasas['closers'][clave] / 100, 2)
                       for clave in CLOSERS_CON_COMISION.values()})
    comisiones['marlon'] = round(marlon_recaudado * tasas['director']['marlon'] / 100, 2)

    from app.services.fulfillment_commission_service import comisiones_del_mes
    comisiones['fulfillment'] = comisiones_del_mes(month_str, completadas, tasas['fulfillment'])
    return comisiones

def _seed_variable_members():
    """Crea en TeamMember a quienes cobran comision variable si no existen."""
    defaults = [
        {'name': 'Elias',       'role': 'Setter',              'salary_type': 'variable', 'payment_method': 'AirTM'},
        {'name': 'Paula',       'role': 'Setter',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        {'name': 'Jean Carlos', 'role': 'Closer',              'salary_type': 'variable', 'payment_method': 'Mercury'},
        {'name': 'Facundo',     'role': 'Closer',              'salary_type': 'variable', 'payment_method': 'Mercury'},
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


def nomina_del_mes(month):
    """La nómina de un mes 'YYYY-MM', un item por integrante con la forma de GET
    /public/finance/payroll: lo guardado si la fila del mes se guardó, y si no el sueldo base del
    integrante con la comisión calculada de las ventas. Los inactivos sin nada guardado en el mes
    quedan afuera.

    Desde el 08/10/2026 es la única cuenta de la nómina: la usan la pestaña Nómina, el «por pagar»
    de cada pasarela y los sueldos del resumen (en un rango, mes por mes). Antes cada uno repetía el
    mismo recorrido."""
    saved_payroll_list = MonthlyPayroll.query.filter_by(month=month).all()
    saved_payroll_map = {p.member_id: p for p in saved_payroll_list}

    members = TeamMember.query.all()
    dynamic_commissions = get_commissions_calculated(month)

    payroll_data = []
    for m in members:
        if not m.is_active and m.id not in saved_payroll_map:
            continue

        if m.id in saved_payroll_map:
            p = saved_payroll_map[m.id]
            payroll_data.append(p.to_dict())
        else:
            calculated_comm = comision_de_miembro(m, dynamic_commissions)

            payroll_data.append({
                "id": None,
                "member_id": m.id,
                "member_name": m.name,
                "month": month,
                "base_salary": m.base_salary,
                "commissions": calculated_comm,
                "bonuses": 0.0,
                "payment_method": m.payment_method,
                "is_paid": False,
                "paid_at": None,
                "created_at": None
            })
    return payroll_data


def total_de_item(item):
    """Lo que cobra un integrante en un item de `nomina_del_mes`: sueldo, comisión y bonos."""
    return (item.get('base_salary') or 0.0) + (item.get('commissions') or 0.0) + (item.get('bonuses') or 0.0)


@bp.route('/public/finance/payroll', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_payroll():
    month = request.args.get('month') or request.json.get('month')
    if not month or len(month) != 7 or '-' not in month:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400
        
    if request.method == 'POST':
        data = request.json or {}
        member_id = data.get('member_id')
        if not member_id:
            return jsonify({"error": "member_id es requerido"}), 400
            
        payroll = MonthlyPayroll.query.filter_by(member_id=member_id, month=month).first()
        
        base_salary = float(data.get('base_salary', 0.0))
        commissions = float(data.get('commissions', 0.0))
        bonuses = float(data.get('bonuses', 0.0))
        payment_method = data.get('payment_method', '')
        is_paid = bool(data.get('is_paid', False))
        
        if not payroll:
            payroll = MonthlyPayroll(
                member_id=member_id,
                month=month,
                base_salary=base_salary,
                commissions=commissions,
                bonuses=bonuses,
                payment_method=payment_method,
                is_paid=is_paid,
                paid_at=datetime.utcnow() if is_paid else None
            )
            db.session.add(payroll)
        else:
            payroll.base_salary = base_salary
            payroll.commissions = commissions
            payroll.bonuses = bonuses
            payroll.payment_method = payment_method
            if is_paid != payroll.is_paid:
                payroll.is_paid = is_paid
                payroll.paid_at = datetime.utcnow() if is_paid else None
                
        db.session.commit()
        return jsonify(payroll.to_dict()), 200

    # Auto-seedea los miembros variables si no existen
    _seed_variable_members()
    return jsonify(nomina_del_mes(month)), 200

@bp.route('/public/finance/balances', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_balances():
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
        
    default_methods = ['Mercury', 'AirTM']
    balances = MonthlyPaymentMethodBalance.query.filter_by(month=month).all()
    balances_map = {b.payment_method: b for b in balances}

    # Calcula "por pagar" por pasarela desde la nómina del mes: los mismos integrantes y montos que
    # muestra la pestaña Nómina (los activos y los que ya tienen nómina guardada).
    expected_by_method = {m: 0.0 for m in default_methods}

    for item in nomina_del_mes(month):
        method = item.get('payment_method')
        # Un medio que no es una pasarela de pago ('Stripe' de los integrantes viejos, o vacío) es
        # el que la tabla de nómina muestra como elegido: el selector solo ofrece Mercury y AirTM
        # y cae en el primero. Antes ese sueldo no se sumaba a ninguna pasarela.
        if method not in expected_by_method:
            method = default_methods[0]
        expected_by_method[method] += total_de_item(item)

    result = []
    total_actual = 0.0
    total_expected = 0.0

    for m in default_methods:
        actual = balances_map[m].actual_amount if m in balances_map else 0.0
        expected = round(expected_by_method.get(m, 0.0), 2)
        result.append({
            "id": balances_map[m].id if m in balances_map else None,
            "month": month,
            "payment_method": m,
            "actual_amount": actual,
            "expected_amount": expected
        })
        total_actual += actual
        total_expected += expected

    return jsonify({
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


def _gasto_a_dict(gasto):
    return {"id": gasto.id, "description": gasto.description, "amount": float(gasto.amount or 0.0),
            "category": gasto.category, "date": gasto.date.isoformat() if gasto.date else None}


@bp.route('/public/finance/software', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_software_expenses():
    """Los gastos de software del mes, los mismos que suma el resumen. Antes la pestaña Software
    usaba /admin/finance/*, que es solo de admin y operaciones: la dirección comercial con «ver
    finanzas» quedaba afuera de una de las cinco vistas."""
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

    rango = _rango_del_mes(request.args.get('month') or '')
    if not rango:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400
    gastos = Expense.query.filter(
        Expense.date >= rango[0], Expense.date <= rango[1], func.lower(Expense.category) == 'software'
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
        
    saving = MonthlySaving.query.filter_by(month=month).first()
    return jsonify({
        "month": month,
        "savings": saving.savings if saving else 0.0
    }), 200

@bp.route('/public/finance/ad-budget', methods=['GET', 'POST'])
@login_required
@finance_admin_required
def manage_ad_budget():
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
        
        ad_spends = AdPeriodSpend.query.filter(
            AdPeriodSpend.start_date <= end_date,
            AdPeriodSpend.end_date >= start_date
        ).all()
        total_spent = sum(sp.spend for sp in ad_spends)
        
        return jsonify({
            "month": month,
            "budget": budget_rec.budget,
            "spent": round(total_spent, 2)
        }), 200

    budget_rec = MarketingBudget.query.filter_by(date=start_date).first()
    
    ad_spends = AdPeriodSpend.query.filter(
        AdPeriodSpend.start_date <= end_date,
        AdPeriodSpend.end_date >= start_date
    ).all()
    total_spent = sum(sp.spend for sp in ad_spends)
    
    return jsonify({
        "month": month,
        "budget": budget_rec.budget if budget_rec else 0.0,
        "spent": round(total_spent, 2)
    }), 200

@bp.route('/public/finance/summary', methods=['GET'])
@login_required
@finance_admin_required
def get_finance_summary():
    month = request.args.get('month')
    if not month or len(month) != 7 or '-' not in month:
        return jsonify({"error": "Parámetro 'month' (YYYY-MM) es requerido"}), 400
        
    try:
        year, month_num = map(int, month.split('-'))
        start_date = datetime(year, month_num, 1)
        last_day = calendar.monthrange(year, month_num)[1]
        end_date = datetime(year, month_num, last_day, 23, 59, 59, 999999)
    except Exception:
        return jsonify({"error": "Mes con formato inválido"}), 400
        
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
    total_software = sum(e.amount for e in software_expenses)
    
    
    budget_rec = MarketingBudget.query.filter_by(date=start_date.date()).first()
    total_anuncios = budget_rec.budget if budget_rec else 0.0
    
    # Lo mismo que suma la pestaña Nómina: sale de la misma cuenta.
    total_sueldos = sum(total_de_item(item) for item in nomina_del_mes(month))

    total_expenses = total_software + total_anuncios + total_sueldos
    
    balances = MonthlyPaymentMethodBalance.query.filter_by(month=month).all()
    total_actual = sum(b.actual_amount for b in balances)
    total_expected = sum(b.expected_amount for b in balances)
    
    saving = MonthlySaving.query.filter_by(month=month).first()
    savings_val = saving.savings if saving else 0.0
    
    profit = total_income - total_expenses
    balance_neto = total_income - total_expenses + savings_val
    
    return jsonify({
        "month": month,
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
