from flask import request, jsonify
from flask_login import current_user, login_required
from app import db
from app.models import User, Expense, AdPeriodSpend
from app.models.financial import FinancialSale, FinancialAgenda, TeamMember, MonthlyPayroll, MonthlyPaymentMethodBalance, MonthlySaving
from datetime import datetime
import calendar
from functools import wraps
from . import bp
from sqlalchemy import or_, func

def finance_admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({"error": "No autenticado"}), 401
        if current_user.role != 'admin' or not getattr(current_user, 'can_view_finance', False):
            return jsonify({"error": "No tienes acceso a esta sección de finanzas"}), 403
        return f(*args, **kwargs)
    return decorated_function

def normalize_ig(ig_str):
    if not ig_str or not isinstance(ig_str, str) or ig_str.lower() in ('n/a', ''):
        return None
    return ig_str.strip().lstrip('@').lower()

def resolve_closer_name(email_or_name):
    if not email_or_name:
        return "Sin Closer"
    val_norm = str(email_or_name).strip().lower()
    
    mapping = {
        'Jean Carlo': ['jeancarlo@thelearnation.com'],
        'Marlon': ['marlon@thelearnation.com', 'marlongarcia27948@gmail.com'],
        'Guillermo': ['guillermo@thelearnation.com'],
        'Tomas': ['tomas@thelearnation.com', 'tomaszetaaa@gmail.com'],
        'Mario': ['mario@neurocogniciones.com', 'mario@thelearnation.com'],
        'Mercari': ['mercaricc@gmail.com', 'mírcari', 'mircari', 'mercari'],
        'Iñaki': ['iñaki', 'inaki'],
        'Rafael': ['rafael'],
        'Mateo': ['mateo'],
        'Belén': ['mbelenamerise@gmail.com', 'belen'],
        'Valery': ['valeryjohana.cabrera@gmail.com', 'valery'],
        'Gabriel': ['gabriel@thelearnation.com', 'gabriel']
    }
    
    for name, list_vals in mapping.items():
        for val in list_vals:
            if val in val_norm:
                return name
    if '@' in email_or_name:
        return email_or_name.split('@')[0].replace('.', ' ').title()
    return email_or_name.title()

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

def get_commissions_calculated(month_str):
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
    agenda_map = {}
    for a in all_agendas:
        ig_norm = normalize_ig(a.instagram)
        if ig_norm:
            if ig_norm not in agenda_map or (a.date and agenda_map[ig_norm].date and a.date > agenda_map[ig_norm].date):
                agenda_map[ig_norm] = a
                
    elias_recaudado = 0.0
    jeancarlo_recaudado = 0.0
    marlon_recaudado = 0.0
    
    for s in sales:
        sale_is_completed = not s.estado or s.estado.strip() == "" or s.estado.lower() == "completada"
        if not sale_is_completed:
            continue
            
        ig_norm = normalize_ig(s.instagram)
        resolved_setter = None
        
        if ig_norm and ig_norm in agenda_map:
            agenda = agenda_map[ig_norm]
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
            
        if final_setter.lower() == 'elias':
            elias_recaudado += monto_ajustado
            
        if final_closer.lower() == 'jean carlo':
            jeancarlo_recaudado += monto_ajustado
            
            prog, simple_tp = split_tipo_pago(s.tipo_pago)
            is_renovacion = simple_tp and ("renovacion" in simple_tp.lower() or "renovación" in simple_tp.lower())
            if not is_renovacion:
                marlon_recaudado += monto_ajustado
                
    return {
        "elias": round(elias_recaudado * 0.08, 2),
        "jeancarlo": round(jeancarlo_recaudado * 0.10, 2),
        "marlon": round(marlon_recaudado * 0.05, 2)
    }

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
            calculated_comm = 0.0
            if m.salary_type == 'variable':
                name_clean = m.name.lower().strip().replace(' ', '')
                if 'elias' in name_clean:
                    calculated_comm = dynamic_commissions.get('elias', 0.0)
                elif 'jeancarlo' in name_clean or 'jeancarlos' in name_clean:
                    calculated_comm = dynamic_commissions.get('jeancarlo', 0.0)
                elif 'marlon' in name_clean:
                    calculated_comm = dynamic_commissions.get('marlon', 0.0)
                    
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
            
    return jsonify(payroll_data), 200

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
        
    default_methods = ['Stripe', 'AirTM', 'PayPal', 'Wise', 'Banco', 'Hotmart']
    balances = MonthlyPaymentMethodBalance.query.filter_by(month=month).all()
    balances_map = {b.payment_method: b for b in balances}
    
    result = []
    total_actual = 0.0
    total_expected = 0.0
    
    for m in default_methods:
        if m in balances_map:
            b = balances_map[m]
            result.append(b.to_dict())
            total_actual += b.actual_amount
            total_expected += b.expected_amount
        else:
            result.append({
                "id": None,
                "month": month,
                "payment_method": m,
                "actual_amount": 0.0,
                "expected_amount": 0.0
            })
            
    for b in balances:
        if b.payment_method not in default_methods:
            result.append(b.to_dict())
            total_actual += b.actual_amount
            total_expected += b.expected_amount
            
    return jsonify({
        "balances": result,
        "total_actual": round(total_actual, 2),
        "total_expected": round(total_expected, 2)
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
        sale_is_completed = not s.estado or s.estado.strip() == "" or s.estado.lower() == "completada"
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
    
    equipo_expenses = Expense.query.filter(
        Expense.date >= start_date,
        Expense.date <= end_date,
        func.lower(Expense.category) == 'equipo'
    ).all()
    total_equipo = sum(e.amount for e in equipo_expenses)
    
    ad_spends = AdPeriodSpend.query.filter(
        AdPeriodSpend.start_date <= end_date.date(),
        AdPeriodSpend.end_date >= start_date.date()
    ).all()
    total_anuncios = sum(sp.spend for sp in ad_spends)
    
    saved_payroll_list = MonthlyPayroll.query.filter_by(month=month).all()
    saved_payroll_map = {p.member_id: p for p in saved_payroll_list}
    members = TeamMember.query.all()
    dynamic_commissions = get_commissions_calculated(month)
    
    total_sueldos = 0.0
    for m in members:
        if not m.is_active and m.id not in saved_payroll_map:
            continue
            
        if m.id in saved_payroll_map:
            p = saved_payroll_map[m.id]
            total_sueldos += (p.base_salary + p.commissions + p.bonuses)
        else:
            calculated_comm = 0.0
            if m.salary_type == 'variable':
                name_clean = m.name.lower().strip().replace(' ', '')
                if 'elias' in name_clean:
                    calculated_comm = dynamic_commissions.get('elias', 0.0)
                elif 'jeancarlo' in name_clean or 'jeancarlos' in name_clean:
                    calculated_comm = dynamic_commissions.get('jeancarlo', 0.0)
                elif 'marlon' in name_clean:
                    calculated_comm = dynamic_commissions.get('marlon', 0.0)
            total_sueldos += (m.base_salary + calculated_comm)
            
    total_expenses = total_software + total_equipo + total_anuncios + total_sueldos
    
    balances = MonthlyPaymentMethodBalance.query.filter_by(month=month).all()
    total_actual = sum(b.actual_amount for b in balances)
    total_expected = sum(b.expected_amount for b in balances)
    
    saving = MonthlySaving.query.filter_by(month=month).first()
    savings_val = saving.savings if saving else 0.0
    
    profit = total_actual - total_expenses
    balance_neto = total_income - total_expenses - savings_val
    
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
            "equipo": round(total_equipo, 2),
            "anuncios": round(total_anuncios, 2),
            "sueldos": round(total_sueldos, 2)
        },
        "income_breakdown": income_breakdown
    }), 200
