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
    def create_plan(client_id, appointment_id, total, cobrado_hoy, num_cuotas, start_date=None):
        """Genera el cronograma de cuotas restantes (saldo dividido en partes iguales,
        una por mes). El plan pertenece al cliente (client_id), no a una cita puntual —
        cualquier cita futura de ese mismo cliente encuentra el mismo plan.

        Protección: si ya existe un plan para este cliente con al menos una cuota pagada,
        NO se borra ni se recrea (perdería el historial de cobros) — se devuelve None para
        que el caller lo trate como error. Solo se reemplaza un plan que sigue 100% pendiente
        (ej. el closer corrigió el número de cuotas antes de que se cobrara ninguna)."""
        existing = InstallmentPlan.query.filter_by(client_id=client_id).all()
        if any(p.estado == 'pagado' for p in existing):
            return None

        InstallmentPlan.query.filter_by(client_id=client_id).delete()

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
                client_id=client_id,
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
    def get_plan_by_client(client_id):
        return InstallmentPlan.query.filter_by(client_id=client_id) \
            .order_by(InstallmentPlan.numero_cuota.asc()).all()

    @staticmethod
    def get_plan(appointment_id):
        """Compat: resuelve el cliente de la cita y devuelve SU plan completo (no solo lo
        creado desde esta cita puntual), para que cualquier cita del mismo cliente vea el
        mismo cronograma."""
        from app.models import Appointment
        appt = Appointment.query.get(appointment_id)
        if not appt or not appt.client_id:
            return InstallmentPlan.query.filter_by(appointment_id=appointment_id) \
                .order_by(InstallmentPlan.numero_cuota.asc()).all()
        return InstallmentService.get_plan_by_client(appt.client_id)

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
