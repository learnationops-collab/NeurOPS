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
    def create_plan(client_id, appointment_id, total, cobrado_hoy, num_cuotas, start_date=None, fechas=None, montos=None, programa_code=None):
        """Genera el cronograma de cuotas restantes (saldo dividido en partes iguales,
        una por mes por defecto). El plan pertenece al cliente (client_id) Y al programa
        (programa_code) — un mismo cliente puede tener planes independientes para AL/RR/SI si
        compró más de un programa a lo largo del tiempo; el plan de un programa no debe
        bloquear ni pisar el de otro.

        `fechas` (opcional): lista de fechas ('YYYY-MM-DD' o `date`) para sobreescribir el
        vencimiento automático de cada cuota, en orden (fechas[0] → cuota 1, etc.) — el closer
        define cuándo le va a cobrar cada cuota a ESE cliente en particular al momento de
        registrar el primer pago, en vez de aceptar siempre +1/+2/+3 meses. Una fecha faltante o
        inválida en la lista cae al cálculo automático para esa cuota puntual.

        `montos` (opcional): lista de montos para sobreescribir el reparto automático en partes
        iguales — el closer puede necesitar cuotas de distinto tamaño (ej. una más grande al
        principio). La última cuota SIEMPRE se recalcula como "lo que falta" (rest menos la suma
        de las demás), sin importar qué valor traiga `montos` para esa posición: así la suma
        siempre cierra exacto contra el saldo a financiar, aunque el closer haya tipeado montos
        que no sumen justo (o el redondeo de centavos no cierre perfecto).

        Protección: si ya existe un plan para este cliente EN ESTE MISMO PROGRAMA con al menos
        una cuota pagada, NO se borra ni se recrea (perdería el historial de cobros) — se
        devuelve None para que el caller lo trate como error. Solo se reemplaza un plan que
        sigue 100% pendiente (ej. el closer corrigió el número de cuotas antes de que se
        cobrara ninguna). Planes de OTROS programas del mismo cliente no se tocan."""
        existing = InstallmentPlan.query.filter_by(client_id=client_id, programa_code=programa_code).all()
        if any(p.estado == 'pagado' for p in existing):
            return None

        InstallmentPlan.query.filter_by(client_id=client_id, programa_code=programa_code).delete()

        rest = max(0.0, float(total) - float(cobrado_hoy))
        n = max(1, int(num_cuotas))
        base_date = start_date or date.today()

        if rest <= 0 or n <= 0:
            db.session.commit()
            return []

        each = round(rest / n, 2)
        montos_custom = None
        if montos and len(montos) == n:
            try:
                montos_custom = [round(float(m), 2) for m in montos]
            except (TypeError, ValueError):
                montos_custom = None

        plans = []
        for i in range(n):
            if i == n - 1:
                # La última cuota absorbe lo que falte para cerrar exacto contra `rest`,
                # tanto en el reparto parejo (redondeo) como en montos custom (el closer
                # pudo haber tipeado valores que no sumen justo).
                monto = round(rest - sum(montos_custom[:-1] if montos_custom else [each] * (n - 1)), 2)
            elif montos_custom:
                monto = montos_custom[i]
            else:
                monto = each

            fecha_vencimiento = _add_months(base_date, i + 1)
            if fechas and i < len(fechas) and fechas[i]:
                try:
                    raw = fechas[i]
                    fecha_vencimiento = raw if isinstance(raw, date) else datetime.strptime(str(raw), '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    pass

            plan = InstallmentPlan(
                client_id=client_id,
                appointment_id=appointment_id,
                programa_code=programa_code,
                numero_cuota=i + 1,
                monto=monto,
                fecha_vencimiento=fecha_vencimiento,
                estado='pendiente'
            )
            db.session.add(plan)
            plans.append(plan)

        db.session.commit()
        return plans

    @staticmethod
    def get_plan_by_client(client_id, programa_code=None):
        q = InstallmentPlan.query.filter_by(client_id=client_id)
        if programa_code:
            q = q.filter_by(programa_code=programa_code)
        return q.order_by(InstallmentPlan.numero_cuota.asc()).all()

    @staticmethod
    def get_plan(appointment_id, programa_code=None):
        """Compat: resuelve el cliente de la cita y devuelve SU plan completo (no solo lo
        creado desde esta cita puntual), para que cualquier cita del mismo cliente vea el
        mismo cronograma. Sin `programa_code`, devuelve las cuotas de TODOS los programas del
        cliente (uso general: seguimiento de cobro / historial completo)."""
        from app.models import Appointment
        appt = Appointment.query.get(appointment_id)
        if not appt or not appt.client_id:
            return InstallmentPlan.query.filter_by(appointment_id=appointment_id) \
                .order_by(InstallmentPlan.numero_cuota.asc()).all()
        return InstallmentService.get_plan_by_client(appt.client_id, programa_code=programa_code)

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

    @staticmethod
    def add_cuota(client_id, appointment_id, programa_code, monto, fecha_vencimiento):
        """Agrega una cuota suelta a un plan ya existente, sin tocar las demás — para cuando
        el closer necesita corregir un plan viejo al que le falta una cuota (ej. datos
        históricos incompletos), sin recrear el plan entero (eso perdería el historial de
        cuotas ya pagadas, ver protección en `create_plan`)."""
        existing = InstallmentPlan.query.filter_by(client_id=client_id, programa_code=programa_code).all()
        siguiente_numero = (max((p.numero_cuota for p in existing), default=0)) + 1
        fecha = fecha_vencimiento if isinstance(fecha_vencimiento, date) else datetime.strptime(str(fecha_vencimiento), '%Y-%m-%d').date()

        plan = InstallmentPlan(
            client_id=client_id,
            appointment_id=appointment_id,
            programa_code=programa_code,
            numero_cuota=siguiente_numero,
            monto=float(monto),
            fecha_vencimiento=fecha,
            estado='pendiente'
        )
        db.session.add(plan)
        db.session.commit()
        return plan

    @staticmethod
    def delete_cuota(cuota):
        db.session.delete(cuota)
        db.session.commit()
