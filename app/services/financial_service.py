from app import db
from app.models import Expense, RecurringExpense, User
from app.services.base import BaseService
from datetime import datetime, time, timedelta, date

class FinancialService(BaseService):
    @staticmethod
    def create_expense(data):
        try:
            expense = Expense(
                description=data.get('description'),
                amount=data.get('amount'),
                date=datetime.combine(data.get('date'), datetime.now().time()),
                category=data.get('category'),
                is_recurring=False
            )
            db.session.add(expense)
            db.session.commit()
            return FinancialService.success(message="Gasto registrado exitosamente.")
        except Exception as e:
            db.session.rollback()
            return FinancialService.error(f"Error al registrar gasto: {str(e)}")

    @staticmethod
    def get_finances_data(start_date, end_date):
        # Definitions
        start_dt = datetime.combine(start_date, time.min)
        end_dt = datetime.combine(end_date, time.max)

        # 1. Query Expenses
        expenses_query = Expense.query.filter(
            Expense.date >= start_dt,
            Expense.date <= end_dt
        ).order_by(Expense.date.desc())
        expenses = expenses_query.all()
        total_expenses = sum(e.amount for e in expenses)

        # 2. Query Recurring Expenses (Configuration)
        recurring_expenses = RecurringExpense.query.all()

        # 3. Cobros y ventas del período (`admin_cobros`, Etapa 2c): el cash son los cobros completados
        # (`FinancialSale`), la fee la de su pasarela y la comisión de closers una estimación del 10% del
        # neto; el «revenue potencial», lo acordado en las ventas 'new' del período (`Sale`).
        from app.services import admin_cobros
        from app.services.deuda_service import total_de
        period_payments = admin_cobros.cobros(start_dt, end_dt)
        total_payments = sum(float(v.monto or 0) for v in period_payments)
        total_commission = sum(admin_cobros.fee(v) for v in period_payments)
        closer_commission_total = admin_cobros.comision_estimada_closers(period_payments)

        period_sales = admin_cobros.ventas_nuevas(start_dt, end_dt)
        gross_revenue = sum(t for t in (total_de(s) for s in period_sales) if t is not None)
        enrollments_count = len(period_sales)

        cash_collected = total_payments - total_commission
        
        # Agendas count for consistency
        from app.models import Appointment
        agendas_count = Appointment.query.filter(
            Appointment.start_time >= start_dt,
            Appointment.start_time <= end_dt
        ).count()

        # Add Closer Commissions to Total Expenses for Net Profit Calc
        net_profit = cash_collected - (total_expenses + closer_commission_total)
        total_expenses_with_commissions = total_expenses + closer_commission_total
        
        # Inject Virtual Expense for Closer Commissions
        if closer_commission_total > 0:
            class VirtualExpense:
                def __init__(self, date, description, category, amount, id=None):
                    self.date = date
                    self.description = description
                    self.category = category
                    self.amount = amount
                    self.id = id
            
            v_exp = VirtualExpense(end_dt, 'Comisiones Closers (Calculado)', 'variable', closer_commission_total)
            expenses.append(v_exp)
            expenses.sort(key=lambda x: x.date, reverse=True)

        return {
            'expenses': expenses,
            'recurring_expenses': recurring_expenses,
            'kpis': {
                'gross_revenue': gross_revenue,
                'enrollments_count': enrollments_count,
                'total_payments': total_payments,
                'total_commission': total_commission,
                'cash_collected': cash_collected,
                'total_expenses': total_expenses_with_commissions,
                'net_profit': net_profit,
                'closer_commission_total': closer_commission_total,
                'agendas_count': agendas_count
            }
        }

    @staticmethod
    def generate_monthly_recurring_expenses():
        active_recurring = RecurringExpense.query.filter_by(is_active=True).all()
        today = date.today()
        count = 0
        
        start_month = datetime.combine(today.replace(day=1), time.min)
        
        for rex in active_recurring:
            exists = Expense.query.filter(
                Expense.is_recurring == True,
                Expense.description == rex.description,
                Expense.date >= start_month
            ).first()
            
            if not exists:
                try:
                    month_range = today.replace(day=28) + timedelta(days=4)
                    last_day = (month_range - timedelta(days=month_range.day)).day
                    day = min(rex.day_of_month, last_day)
                    
                    exp_date = datetime.combine(today.replace(day=day), datetime.now().time())
                    
                    exp = Expense(
                        description=rex.description,
                        amount=rex.amount,
                        date=exp_date,
                        category='fixed',
                        is_recurring=True
                    )
                    db.session.add(exp)
                    count += 1
                except Exception:
                    pass
        
        db.session.commit()
        return FinancialService.success(message=f"Se generaron {count} gastos fijos para este mes.")

    @staticmethod
    def create_recurring_expense(data):
        try:
            rexp = RecurringExpense(
                description=data.get('description'),
                amount=data.get('amount'),
                day_of_month=data.get('day_of_month'),
                is_active=bool(data.get('is_active'))
            )
            db.session.add(rexp)
            db.session.commit()
            return FinancialService.success(message="Gasto fijo configurado exitosamente.")
        except Exception as e:
            db.session.rollback()
            return FinancialService.error(f"Error al crear gasto fijo: {str(e)}")

    @staticmethod
    def toggle_recurring(id):
        rex = RecurringExpense.query.get(id)
        if not rex:
            return FinancialService.error("Gasto fijo no encontrado.", 404)
        
        rex.is_active = not rex.is_active
        db.session.commit()
        status = 'activado' if rex.is_active else 'desactivado'
        return FinancialService.success(message=f"Gasto fijo {status}.")

    @staticmethod
    def delete_item(model, id, item_name="Elemento"):
        item = model.query.get(id)
        if not item:
            return FinancialService.error(f"{item_name} no encontrado.", 404)
        
        db.session.delete(item)
        db.session.commit()
        return FinancialService.success(message=f"{item_name} eliminado correctamente.")
