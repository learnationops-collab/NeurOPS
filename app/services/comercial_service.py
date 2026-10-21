"""Dashboard comercial — la analítica y el libro de registros de la dirección comercial, y el
mismo tablero acotado a una persona en "Mis datos" de closers y setters.

Por qué existe teniendo ya `CloserDashboardService`
---------------------------------------------------
Ese servicio arma el dashboard personal del closer y toma varios pasos del embudo de los
reportes diarios (`CloserDailyReport`/`CloserDailyStats`), que es la única fuente de los cupos.
Acá hace falta lo contrario: que **todo** salga del registro real (`Appointment` +
`FinancialSale`), porque el dashboard comercial pone al lado la tabla de agendas de Revisar y
los totales de esa tabla — si los KPIs de arriba se calcularan con otra fuente que las filas de
abajo, los números no cerrarían con el filtro aplicado, que es justamente el requisito del
diseño ("los números tienen que cerrar").

Para no inventar un tercer vocabulario de estados, la clasificación de cada agenda es la misma
que la del libro de agendas del closer: `derivar_estado` de `closer_agendas_service`. Así lo que
el director ve en Revisar es, fila por fila, lo mismo que el closer ve en "Mi cartera → Agendas".

Definiciones (una sola vez, acá)
--------------------------------
  · `realizadas`  agendas con resultado de asistencia (asistió + no show). NO incluye canceladas
                  ni reagendadas: esa llamada no ocurrió, y meterlas en el denominador diluye la
                  tasa. Mismo criterio que `CloserService.percentages.show_rate` ("sobre llamadas
                  concluidas"), para que el show up de este tablero y el de "Ver mis datos" den
                  el mismo número.
  · `show_up`     asistieron / realizadas.
  · `close_rate`  ventas / asistieron. "Venta" es una agenda cuyo lead tiene un pago completo o
                  un split pay (`REAL_SALE_TIPOS`). La seña NO: esa agenda queda como "Seña" y
                  se cuenta en su propia fila (`solo_senas` de `closer_service.matriz_de_cierres`)
                  y en `close_rate_con_senas` de los totales.
  · `cash`        suma de `FinancialSale.monto` del período (incluye cuotas y señas: es cash
                  cobrado, no ventas nuevas).
  · `ventas`      solo las filas cuyo tipo canónico es una venta de verdad (completo/parcial);
                  la seña es una reserva y la cuota es el cobro de una venta anterior.
  · `ticket`      cash / ventas.
  · `comision`    cash neto (ya descontadas las fees) × la tasa de `CommissionService`.
  · `retraso`     días desde la reunión para una agenda que ya pasó y sigue sin resultado.
"""

from datetime import date, datetime, time

from app.models import User
from app.services.closer_dashboard_service import CloserDashboardService
# Vocabulario y cruces se re-exportan: el resto del código los importa desde acá.
from app.services.comercial_cruces import (
    no_es_marcador, es_agenda_del_setter, _limpiar_email, _limpiar_ig, _ultimos8, _tipos_por_persona,
    clientes_de_ventas,
)
from app.services.comercial_vocabulario import (
    ROL_CLOSERS, ROL_SETTERS, ROLES, DIAS_SENA_CAIDA, SIN_RESPUESTA, PRE_CALL, POST_CALL, ESTADO_LEAD,
    ESTADO_CARTERA, TIPOS_PAGO, TIPOS_PAGO_COBROS, ESTADO_VENTA, ESTADOS_COMPLETADA, _LABELS,
    _ESTADO_A_POST_CALL, PRE_CALL_A_RESULT, POST_CALL_A_CLOSER_RESULT, ASISTIO, PRESENTO, REALIZADAS,
    CERRO, DESCARTADAS, pre_call_de, post_call_de, cerro_sin_venta, chip, venta_completada,
    estado_de_venta, pct,
)
from app.services.comercial_agendas import ComercialAgendasMixin
from app.services.comercial_clientes import ComercialClientesMixin
from app.services.comercial_leads import ComercialLeadsMixin
from app.services.comercial_ventas import ComercialVentasMixin


class ComercialService(ComercialAgendasMixin, ComercialVentasMixin, ComercialLeadsMixin,
                        ComercialClientesMixin):

    # --- Período y alcance --------------------------------------------------------------------

    @staticmethod
    def rango(period, start_date=None, end_date=None):
        """Mismos ids de período que "Ver mis datos" y el libro de agendas, a propósito: "Este
        mes" tiene que significar lo mismo en las tres pantallas."""
        return CloserDashboardService._range_for_period(period, start_date, end_date)

    @staticmethod
    def rango_comparado(start, end, compare, compare_start=None, compare_end=None):
        return CloserDashboardService._comparison_range(start, end, compare, compare_start, compare_end)

    @staticmethod
    def miembros(rol):
        """Las personas del equipo que el selector muestra, en orden alfabético."""
        role = 'closer' if rol == ROL_CLOSERS else 'setter'
        usuarios = User.query.filter_by(role=role, is_active=True).order_by(User.username).all()
        return [{'id': u.id, 'nombre': u.username, 'rol': role} for u in usuarios]

    @staticmethod
    def fecha_o_hoy(valor):
        """Una fecha ISO del request, o hoy. Un valor que no parsea cae a hoy en vez de romper:
        el peor caso es que el director vea el día equivocado, no un 500."""
        try:
            return date.fromisoformat(str(valor)[:10]) if valor else date.today()
        except (TypeError, ValueError):
            return date.today()

    @staticmethod
    def nombre_de(miembro_id):
        """El username de una persona del equipo, o None. Es con lo que se acotan las ventas y
        los leads, que se guardan por nombre y no por id."""
        miembro = User.query.get(miembro_id) if miembro_id else None
        return miembro.username if miembro else None

    @staticmethod
    def _limites(start, end):
        return datetime.combine(start, time.min), datetime.combine(end, time.max)
