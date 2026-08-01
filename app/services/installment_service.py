from datetime import date, datetime, timedelta
from app import db
from app.models import InstallmentPlan


def _add_months(d, months):
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                       31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
    return date(year, month, day)


class InstallmentService:
    @staticmethod
    def create_plan(appointment_id, total, cobrado_hoy, num_cuotas, start_date=None):
        """Genera el cronograma de cuotas restantes (saldo dividido en partes iguales,
        una por mes), igual al plan()/plan2() del prototipo v7. Reemplaza cualquier
        plan previo de la misma cita."""
        InstallmentPlan.query.filter_by(appointment_id=appointment_id).delete()

        rest = max(0.0, float(total) - float(cobrado_hoy))
        n = max(1, int(num_cuotas))
        base_date = start_date or date.today()

        if rest <= 0 or n <= 0:
            db.session.commit()
            return []

        each = round(rest / n, 2)
        plans = []
        for i in range(n):
            monto = round(rest - each * (n - 1), 2) if i == n - 1 else each
            plan = InstallmentPlan(
                appointment_id=appointment_id,
                numero_cuota=i + 1,
                monto=monto,
                fecha_vencimiento=_add_months(base_date, i + 1),
                estado='pendiente'
            )
            db.session.add(plan)
            plans.append(plan)

        db.session.commit()
        return plans

    @staticmethod
    def get_plan(appointment_id):
        return InstallmentPlan.query.filter_by(appointment_id=appointment_id) \
            .order_by(InstallmentPlan.numero_cuota.asc()).all()

    @staticmethod
    def update_cuota(cuota, monto=None, fecha_vencimiento=None, estado=None):
        if monto is not None:
            cuota.monto = float(monto)
        if fecha_vencimiento is not None:
            cuota.fecha_vencimiento = datetime.strptime(fecha_vencimiento, '%Y-%m-%d').date()
        if estado is not None:
            cuota.estado = estado
            cuota.fecha_pago = datetime.utcnow() if estado == 'pagado' else None
        db.session.commit()
        return cuota
