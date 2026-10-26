"""Agendas del dashboard comercial: las filas de la tabla "Agendas" (y "Agendas generadas"
de un setter) y sus totales. `ComercialService` hereda de acá; ver `comercial_service.py`.
"""

from datetime import date, datetime
from sqlalchemy.orm import joinedload

from app import db
from app.models import Appointment, User
from app.services.closer_agendas_service import CloserAgendasService, derivar_estado
from app.services.comercial_cruces import (
    no_es_marcador, es_agenda_del_setter, _limpiar_email, _limpiar_ig, _tipos_por_persona,
)
from app.services.comercial_vocabulario import (
    ASISTIO, PRESENTO, REALIZADAS, CERRO, DESCARTADAS, pre_call_de, post_call_de, cerro_sin_venta, chip,
    pct,
)
from app.services.ventas_previas import con_venta_posterior


class ComercialAgendasMixin:

    # --- Agendas ------------------------------------------------------------------------------

    @staticmethod
    def agendas(start, end, closer_id=None, setter_id=None, basis='meet', de_setters=False):
        """Filas de la tabla "Agendas" (y de "Agendas generadas" cuando se acota por setter).

        `basis='creacion'` filtra por cuándo se creó la agenda en vez de por cuándo cae la
        reunión — es el toggle "Fecha meet / F. creación" de la barra de Revisar.

        `de_setters=True` deja solo las agendas que generó un setter: es "Agendas generadas" del
        equipo de setting. Sin eso, "Todo el equipo" con Setters contaba TODAS las agendas del
        período, también las de taller, VSL o landing que no generó ningún setter (en septiembre
        de 2026, 237 contra 129 de verdad). Con un `setter_id` no cambia nada: ya es suya. Tampoco
        entra el marcador que deja cualificar un lead, que no es una reserva (`no_es_marcador`).
        """
        from app.services.comercial_service import ComercialService
        desde, hasta = ComercialService._limites(start, end)
        columna = Appointment.created_at if basis == 'creacion' else Appointment.start_time

        q = Appointment.query.options(
            joinedload(Appointment.client), joinedload(Appointment.closer), joinedload(Appointment.setter)
        ).filter(columna >= desde, columna <= hasta)
        if closer_id:
            q = q.filter(Appointment.closer_id == closer_id)
        if setter_id and de_setters:
            # Las agendas generadas de un setter: la definición única (`es_agenda_del_setter`).
            q = q.filter(es_agenda_del_setter(setter_id))
        elif setter_id:
            q = q.filter(Appointment.setter_id == setter_id)
        elif de_setters:
            q = q.filter(Appointment.setter_id.in_(
                db.session.query(User.id).filter(User.role == 'setter')), no_es_marcador())

        appts = q.order_by(Appointment.start_time.desc(), Appointment.id.desc()).all()
        return ComercialService.filas_de_citas(appts)

    @staticmethod
    def filas_de_citas(appts):
        """Las filas de la tabla "Agendas" para una lista de citas ya elegida.

        Vive aparte de `agendas` para que otras pantallas (el modal de agendas de un taller) muestren
        la MISMA fila —mismos estados, chips y cruce con las ventas— sobre las citas que ellas elijan.
        """
        if not appts:
            return []

        # Cruce agenda -> venta en una sola pasada (mismo criterio que el libro de agendas del
        # closer: los pagos de su persona y los atados por id; por email o instagram, solo los que
        # no tienen persona), pero sabiendo el TIPO de cada pago: "Venta" es solo un pago completo o
        # un split pay. Antes cualquier fila cruzada la marcaba como venta, así que un lead que
        # solo había dejado una seña (o una cuota, o una renovación) contaba como cierre en la
        # tabla, en los totales y en el close rate.
        from app.agendas_v2.manual import tipo_de_llamada
        from app.services.closer_service import REAL_SALE_TIPOS
        tipos_email, tipos_ig, tipos_id = CloserAgendasService._tipos_por_contacto(appts)
        tipos_persona = _tipos_por_persona({a.person_uuid for a in appts if a.person_uuid})

        def tipos_de(a):
            cliente = a.client
            # Con persona, sus pagos; el mail y el instagram del cliente solo sin ella (plan_personas).
            if a.person_uuid:
                return tipos_persona.get(a.person_uuid, set()) | tipos_id.get(a.client_id, set())
            mail = _limpiar_email(cliente.email) if cliente else None
            ig = _limpiar_ig(cliente.instagram) if cliente else None
            return tipos_email.get(mail, set()) | tipos_ig.get(ig, set()) | tipos_id.get(a.client_id, set())

        # Una llamada solo cierra con un pago del día de la llamada en adelante: el de un cliente que
        # ya había comprado antes no es de esa llamada (`ventas_previas`). Se mira la fecha solo en
        # las que ya tienen un pago de venta por tipo, que son pocas.
        con_pago = [a for a in appts if any(t in REAL_SALE_TIPOS for t in tipos_de(a))]
        cierran = con_venta_posterior(con_pago)

        hoy = date.today()
        ahora = datetime.utcnow()
        filas = []
        for a in appts:
            cliente = a.client
            tipos = tipos_de(a)
            con_venta = a.id in cierran
            # Qué venta es, para el desglose pago completo / split pay del panel Cierre. Una agenda
            # cuenta UNA venta aunque el lead tenga las dos (dos programas): manda el pago
            # completo, y así completo + split siempre suma las agendas en "Venta".
            venta_tipo = ('completo' if 'completo' in tipos else 'parcial') if con_venta else None
            con_sena = 'seña' in tipos
            con_seguimiento = bool(a.seguimiento_tipo or a.fecha_seguimiento) and not a.seguimiento_realizado

            estado = derivar_estado(a, ahora)
            post = post_call_de(estado, con_venta, con_sena=con_sena)
            pre = pre_call_de(a)

            # Días sin reportar: solo para una llamada que ya pasó y sigue sin resultado.
            retraso = 0
            if post == 'pendiente' and a.start_time and a.start_time.date() < hoy:
                retraso = (hoy - a.start_time.date()).days
            # Si la hora de la llamada ya pasó. Los días de retraso no alcanzan para decir "todavía
            # no ocurrió": una llamada de hoy a las 9 sigue con 0 días de retraso a las 18, y se
            # mostraba como próxima cuando ya había pasado (reportado por el usuario, 02/10/2026).
            ya_paso = bool(a.start_time and a.start_time <= ahora)

            filas.append({
                'id': a.id,
                'tipo': 'agenda',
                'creada': a.created_at.isoformat() if a.created_at else None,
                'fecha': a.start_time.isoformat() if a.start_time else None,
                'cliente': (cliente.full_name or cliente.email or 'Sin nombre') if cliente else 'Sin cliente',
                'ig': (cliente.instagram or '') if cliente else '',
                'email': (cliente.email or '') if cliente else '',
                'telefono': (cliente.phone or '') if cliente else '',
                'client_id': a.client_id,
                'person_uuid': a.person_uuid,
                'fuente': a.origin or 'Sin fuente',
                # La palabra clave del anuncio que trajo al lead, la que el setter le asigna en el
                # mazo. Vacía si todavía no tiene: es lo que su Revisar cuenta como «sin palabra
                # clave».
                'palabra_clave': (a.keyword or '').strip(),
                'closer': a.closer.username if a.closer else 'Sin closer',
                'closer_id': a.closer_id,
                'setter': a.setter.username if a.setter else '',
                'setter_id': a.setter_id,
                'pre_call': chip('pre_call', pre),
                'post_call': chip('post_call', post),
                'estado_libro': estado,
                'asistio': post in ASISTIO,
                # Asistió y no terminó en venta ni en seña (ver `CERRO`). Va en la fila para que el
                # panel Cierre, su lista de «No cerradas» y el filtro de Revisar lean el MISMO dato.
                'no_cerrada': post in ASISTIO and post not in CERRO,
                'realizada': post in REALIZADAS,
                'presento': (post in PRESENTO or bool(a.offer_presented)
                             or cerro_sin_venta(estado, con_venta, con_seguimiento, con_sena=con_sena)),
                'retraso_dias': retraso,
                'ya_paso': ya_paso,
                'descartada': post in DESCARTADAS,
                # `con_venta`: pago completo o split pay. `con_sena`: dejó una seña (tenga o no,
                # además, una venta: la seña que después se completó sigue siendo una seña).
                'con_venta': con_venta,
                'venta_tipo': venta_tipo,
                'con_sena': con_sena,
                # 'primera', 'segunda' o 'momentum' (`manual.tipo_de_llamada`): el panel Estados
                # muestra las primeras y las segundas llamadas por separado (26/10/2026).
                'tipo_llamada': tipo_de_llamada(a),
            })
        return filas

    @staticmethod
    def generadas(start, end, setter_id=None, basis='creacion'):
        """Filas de "Agendas generadas": el trabajo de un setter (o del equipo de setting).

        Se cuentan por la fecha en que se CREÓ la agenda, no por la de la reunión: lo que hizo el
        setter en el período es reservarla, y la reunión puede caer semanas después. Por fecha de
        reunión, una agenda reservada el 28/09 para el 03/10 no le contaba a nadie en septiembre
        y sí en octubre, cuando el setter ya no hizo nada (septiembre de 2026: Paula 51 por
        reunión contra 59 por creación). `basis='meet'` queda para el toggle de Revisar.

        Es la única puerta a estas filas: el bloque de Analizar, la serie de Variabilidad y la
        tabla de Revisar la usan las tres, así que el número y la lista no pueden divergir.

        **Una persona cuenta una vez por setter** (ver `_una_por_persona`): el total, el show up y
        las ventas originadas salen de las filas ya depuradas, y la tabla devuelve esas mismas.
        """
        from app.services.comercial_service import ComercialService
        filas = ComercialService.agendas(start, end, setter_id=setter_id, basis=basis, de_setters=True)
        return ComercialService._una_por_persona(filas)

    @staticmethod
    def _una_por_persona(filas):
        """Deja UNA agenda por lead y por setter: la más reciente.

        Un lead que reagenda tiene dos o tres agendas del mismo setter en el período, y cada una
        sumaba como una agenda generada más: el setter consiguió UNA persona, no tres (septiembre
        de 2026, por fecha de creación: 136 agendas del equipo eran 124 personas). Se queda la
        más reciente porque su resultado es el vigente; las anteriores son la historia de esa
        misma persona.

        "Más reciente" es la de la reunión más reciente, no la última que se creó: la
        sincronización crea a veces de una vez agendas de reuniones ya pasadas, y en producción
        hay dos del mismo lead creadas en el mismo minuto para el 24/08 y el 27/08. El resultado
        vigente es el de la última llamada.

        **Salvo que una de ellas sea la venta (o la seña):** esa gana aunque haya otra más nueva.
        La persona compró, y eso es lo que el setter originó; una agenda posterior que nadie
        reportó no puede borrarlo. En producción (septiembre de 2026) un lead de Elias compró en
        la llamada del 07/09 y tenía otra agenda del 15/09 sin resultado: quedándose con la más
        reciente, sus ventas originadas bajaban de 5 a 4 sin que nadie hubiera dejado de comprar.

        La clave es (setter, cliente) y no solo el cliente: un lead que agendaron dos setters
        distintos les cuenta a los dos, y así el total del equipo es la suma de sus setters.
        """
        def persona(fila):
            # La persona (plan_personas): dos clientes duplicados de la misma cuentan una vez.
            quien = ('p', fila['person_uuid']) if fila.get('person_uuid') else ('c', fila['client_id'])
            return (fila['setter_id'], quien)

        cierre = {'venta': 2, 'sena': 1}

        def reciente(fila):
            return (cierre.get(fila['post_call']['key'], 0),
                    fila['fecha'] or '', fila['creada'] or '', fila['id'])

        ultima = {}
        for fila in filas:
            vigente = ultima.get(persona(fila))
            if vigente is None or reciente(fila) > reciente(vigente):
                ultima[persona(fila)] = fila
        # Se filtra la lista original en vez de devolver `ultima`: así queda el orden de la tabla.
        return [f for f in filas if ultima[persona(f)] is f]

    # --- Totales de lo filtrado ---------------------------------------------------------------

    @staticmethod
    def totales_agendas(filas):
        """Las 6 tarjetas de "Totales de lo filtrado". Se calcula sobre las filas que el usuario
        está viendo, no sobre todo el período: es el requisito de que los números cierren con el
        filtro aplicado."""
        realizadas = [f for f in filas if f['realizada']]
        asistieron = [f for f in filas if f['asistio']]
        ventas = [f for f in filas if f['post_call']['key'] == 'venta']
        # Asistieron y dejaron una seña, sin pago completo ni split pay. No son ventas: entran
        # solo en `close_rate_con_senas`.
        senas = [f for f in filas if f['post_call']['key'] == 'sena']
        seguimiento = [f for f in filas if f['post_call']['key'] == 'seguimiento']
        no_show = [f for f in filas if f['post_call']['key'] == 'no_show']
        pendientes = [f for f in filas if f['post_call']['key'] == 'pendiente']
        con_retraso = [f for f in pendientes if f['retraso_dias'] > 0]

        return {
            'agendas': len(filas),
            'realizadas': len(realizadas),
            'asistieron': len(asistieron),
            'show_up': pct(len(asistieron), len(realizadas)),
            'ventas': len(ventas),
            # El desglose de esas ventas (ver `venta_tipo` en `agendas`): suman `ventas` exacto.
            'ventas_completo': sum(1 for f in ventas if f.get('venta_tipo') == 'completo'),
            'ventas_split': sum(1 for f in ventas if f.get('venta_tipo') != 'completo'),
            'close_rate': pct(len(ventas), len(asistieron)),
            'senas': len(senas),
            'close_rate_con_senas': pct(len(ventas) + len(senas), len(asistieron)),
            'seguimiento': len(seguimiento),
            'no_show': len(no_show),
            'no_show_pct': pct(len(no_show), len(realizadas)),
            'pendientes': len(pendientes),
            'pendientes_con_retraso': len(con_retraso),
            'retraso_max': max((f['retraso_dias'] for f in con_retraso), default=0),
        }
