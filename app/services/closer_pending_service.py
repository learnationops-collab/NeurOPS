from datetime import date, datetime, timedelta
from sqlalchemy import or_, func
from sqlalchemy.orm import joinedload
from app import db
from app.models import Appointment, User
from app.services.user_time_service import limites_dia_utc

# Estados de `Appointment.result` que significan "todavía no se tocó al lead". El pipeline de
# confirmación del closer escribe minúsculas ('por_confirmar', 'conversando', 'confirmado');
# FinancialAgenda y el triage escriben capitalizado ('Pendiente', 'Contactado'). Se comparan
# siempre en minúscula para no depender de cuál de los dos origenes escribió último.
SIN_CONTACTAR = {'', 'pendiente', 'agendado', 'por_confirmar'}
EN_CONVERSACION = {'contactado', 'conversando', 'sin respuesta'}
CONFIRMADO = {'confirmado'}

# closer_result que significa "la llamada nunca se reportó".
SIN_REPORTAR = {'', 'pendiente', '2da call'}

DESCARTADOS = ['Cancelado', 'Cancelada', 'Reagendado', 'Reagendada']


class CloserPendingService:
    """Trabajo pendiente del closer: lo que le falta completar HOY, no en el período filtrado.

    Es deliberadamente independiente del filtro de fechas del dashboard. Una agenda de hace tres
    semanas que nunca se reportó sigue siendo trabajo pendiente aunque el closer esté mirando
    los últimos 7 días — filtrarla por período la escondería justo cuando hay que hacerla. Por
    eso replica las mismas queries del mazo (`GET /closer/deck`), y no las del embudo: los
    números tienen que coincidir con los contadores de las pestañas que el closer usa para
    trabajar, o el dashboard estaría diciendo algo distinto del mazo.
    """

    @staticmethod
    def _scoped(query, closer_id):
        return query.filter(Appointment.closer_id == closer_id) if closer_id else query

    @staticmethod
    def _fin_de_hoy(closer_id):
        """Fin del día de hoy en la zona horaria del closer, en UTC naive — el mismo corte que
        usa el mazo (`GET /closer/deck?step=calls`). Se usa el fin del día y no "ahora" para que
        el número de acá coincida exactamente con el contador de la pestaña «② Llamadas»: una
        agenda de las 18 h se reporta el mismo día, así que el mazo ya la lista a las 14 h.
        Sin closer (vista de admin con todo el equipo) no hay una zona única: se usa la del
        servidor, que es lo mismo que hace el mazo cuando lo abre un admin."""
        closer = User.query.get(closer_id) if closer_id else None
        _, fin = limites_dia_utc(closer, date.today())
        return fin

    @staticmethod
    def _sin_reportar(closer_id):
        """Agendas cuya llamada ya pasó y el closer nunca reportó qué ocurrió (mismo criterio que
        la pestaña «② Llamadas» del mazo). Se excluyen canceladas y reagendadas: ésas no tienen
        resultado que reportar."""
        corte = CloserPendingService._fin_de_hoy(closer_id)
        q = CloserPendingService._scoped(Appointment.query.filter(
            Appointment.start_time <= corte,
            Appointment.closer_processed == False,
            or_(
                func.lower(func.coalesce(Appointment.closer_result, '')).in_(SIN_REPORTAR),
                Appointment.closer_result.is_(None)
            ),
            or_(
                Appointment.result.notin_(DESCARTADOS),
                Appointment.result.is_(None),
                Appointment.result == ''
            )
        ), closer_id)

        total = q.count()
        mas_vieja = q.with_entities(func.min(Appointment.start_time)).scalar()
        hoy = date.today()
        inicio_hoy, _ = limites_dia_utc(User.query.get(closer_id) if closer_id else None, hoy)
        de_hoy = q.filter(Appointment.start_time >= inicio_hoy).count()
        return {
            'count': total,
            'de_hoy': de_hoy,
            'atrasadas': total - de_hoy,
            'dias_mas_vieja': (hoy - mas_vieja.date()).days if mas_vieja else None
        }

    @staticmethod
    def _por_confirmar(closer_id):
        """Agendas todavía por delante que el closer no cerró en el pipeline de confirmación
        (mismo criterio que la pestaña «① Confirmaciones»), separadas en las dos acciones
        distintas que representan: las que nadie tocó todavía y las que están a medio conversar."""
        ahora = datetime.utcnow()
        inicio_hoy, _ = limites_dia_utc(User.query.get(closer_id) if closer_id else None, date.today())
        q = CloserPendingService._scoped(Appointment.query.filter(
            Appointment.start_time >= inicio_hoy,
            Appointment.closer_processed == False,
            or_(
                func.lower(func.coalesce(Appointment.closer_result, '')).in_({'', 'pendiente'}),
                Appointment.closer_result.is_(None)
            )
        ), closer_id)

        estado = func.lower(func.coalesce(Appointment.result, ''))
        sin_contactar = q.filter(estado.in_(SIN_CONTACTAR)).count()
        en_conversacion = q.filter(estado.in_(EN_CONVERSACION)).count()
        confirmadas = q.filter(estado.in_(CONFIRMADO)).count()

        limite_48h = ahora + timedelta(hours=48)
        urgentes = q.filter(
            Appointment.start_time <= limite_48h,
            ~estado.in_(CONFIRMADO)
        ).count()

        return {
            'count': sin_contactar + en_conversacion,
            'sin_contactar': sin_contactar,
            'en_conversacion': en_conversacion,
            'confirmadas': confirmadas,
            # Las que se caen si no se confirman ya: la llamada es dentro de las próximas 48 h.
            'proximas_48h': urgentes
        }

    @staticmethod
    def _client_ids_con_venta(clients):
        """Cuáles de estos clientes ya tienen una venta en FinancialSale, en UNA sola consulta.

        Es el equivalente en lote de `CloserFollowUpService._client_has_sale` (mismo cruce por
        email y por instagram sin '@', todo en minúsculas). Se hace así porque el original corre
        una consulta por cita: clasificar la lista de seguimientos de todo el equipo disparaba
        cientos de consultas contra FinancialSale, una por cada llamada asistida sin seguimiento
        etiquetado."""
        from app.models import FinancialSale

        if not clients:
            return set()

        mails, igs = set(), set()
        for mail, ig in db.session.query(FinancialSale.mail_cliente, FinancialSale.instagram).all():
            if mail:
                mails.add(mail.strip().lower())
            if ig:
                igs.add(ig.strip().lstrip('@').lower())

        con_venta = set()
        for c in clients:
            if not c:
                continue
            if c.email and c.email.strip().lower() in mails:
                con_venta.add(c.id)
            elif c.instagram and c.instagram.strip().lstrip('@').lower() in igs:
                con_venta.add(c.id)
        return con_venta

    @staticmethod
    def _seguimientos(closer_id):
        """Seguimientos vencidos o que tocan hoy, agrupados por tipo. Se cuenta con el mismo
        criterio que la pestaña «③ Seguimientos» (`CloserFollowUpService`), pero sin serializar
        cada cita: acá solo hacen falta los totales, y serializar el grupo `cerrada` calcularía
        la deuda de cada cliente una por una.

        Los dos N+1 que quedaban se resuelven en lote: el cliente de cada cita viaja con un
        `joinedload`, y el "¿ya compró?" que necesita la clasificación se precalcula de una y se
        le inyecta a `_effective_tipo`. Sin esto, el dashboard corría dos consultas por cada
        seguimiento pendiente del período — sobre datos reales, cientos."""
        from app.services.closer_followup_service import CloserFollowUpService

        hoy = date.today().isoformat()
        items = CloserFollowUpService._base_query(closer_id).options(
            joinedload(Appointment.client)
        ).filter(
            Appointment.fecha_seguimiento.isnot(None),
            Appointment.fecha_seguimiento != '',
            Appointment.fecha_seguimiento <= hoy
        ).all()

        con_venta = CloserPendingService._client_ids_con_venta([a.client for a in items])

        grupos = {'no_tomada': 0, 'tomada': 0, 'cerrada': 0}
        vencidos = 0
        for a in items:
            tipo = CloserFollowUpService._effective_tipo(a, has_sale=a.client_id in con_venta)
            grupos[tipo or 'no_tomada'] += 1
            if (a.fecha_seguimiento or '')[:10] < hoy:
                vencidos += 1

        return {'count': len(items), 'vencidos': vencidos, **grupos}

    @staticmethod
    def get_pending_work(closer_id=None, coverage=None, cupos_faltantes=0):
        """Resumen de trabajo pendiente. `coverage` y `cupos_faltantes` los pasa el dashboard
        (ya los calcula para el embudo) para no repetir esas consultas acá: a diferencia del
        resto, esos dos SÍ dependen del período filtrado."""
        sin_reportar = CloserPendingService._sin_reportar(closer_id)
        por_confirmar = CloserPendingService._por_confirmar(closer_id)
        seguimientos = CloserPendingService._seguimientos(closer_id)
        reportes_faltantes = (coverage or {}).get('faltantes', 0)

        return {
            'agendas_sin_reportar': sin_reportar,
            'por_confirmar': por_confirmar,
            'seguimientos': seguimientos,
            'reportes_sin_enviar': {
                'count': reportes_faltantes,
                'dias': (coverage or {}).get('dias_faltantes', [])
            },
            'cupos_sin_declarar': {'count': cupos_faltantes},
            # Total accionable: lo que el closer puede resolver entrando al mazo. Los reportes y
            # los cupos quedan afuera a propósito — viven en la sección "Para actualizar" del
            # final del dashboard y contarlos dos veces inflaría el número.
            'total': sin_reportar['count'] + por_confirmar['count'] + seguimientos['count']
        }
