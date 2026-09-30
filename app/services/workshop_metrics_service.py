"""Metricas del embudo de un workshop, para el autocompletado del panel.

Vive fuera de `app/api/workshop.py` porque el calculo dejo de ser "contar lo del
dia": un workshop tiene DOS entradas de leads que ocurren en momentos distintos.

  · WORKSHOP EN VIVO  -> la clase del dia D (fuente 'workshop')
  · WORKSHOP LANDING  -> la grabacion publicada en /replay/ despues de la clase
                         (fuente 'workshop_landing')

Las dos pertenecen al MISMO workshop y por eso suman en el analisis, pero se
cuentan por separado para poder ver cuanto aporta cada una.

VENTANA DE ATRIBUCION (05/09/2026): las agendas y aplicaciones de las dos
fuentes se cuentan ENTRE UN WORKSHOP Y EL SIGUIENTE. Al taller del dia D le
pertenecen las creadas el dia D y los dias siguientes, hasta el dia anterior al
proximo WorkshopEvent registrado. Si todavia no hay un proximo taller la ventana
queda abierta hasta hoy, y se cierra sola cuando se registre el siguiente (el
hook de `workshop_live_sync` recalcula el taller anterior en ese momento).

Antes la grabacion contaba 2 dias fijos y el vivo solo el dia D: todo lo que
caia despues no se le atribuia a ningun taller.
"""
from datetime import datetime, time, timedelta

import pytz
from sqlalchemy import or_, func

from app.models import Client, FinancialAgenda, FinancialSale, Appointment, WorkshopEvent
from app.services.fuente_service import es_workshop_landing, es_workshop_vivo, es_sin_dueno

# Handles que la gente escribe cuando no tiene Instagram: no identifican a nadie
HANDLES_INVALIDOS = {'n/a', 'na', 'no tengo', 'notengo', 'ninguno', 'none', '', 'sin instagram', 'no'}

# Estados de la hoja de agendas que marcan a la persona como compradora cuando la venta todavia no
# esta cargada. 'seña'/'sena' ya no: una seña es una reserva, no un cierre (pedido del usuario,
# 30/09/2026: "el close rate no debe tomar señas").
ESTADOS_DE_VENTA = ['cierre', 'completo', 'ganado', 'venta', 'vendido', 'completado']


def _tz(timezone_str):
    try:
        return pytz.timezone(timezone_str or 'America/La_Paz')
    except Exception:
        return pytz.timezone('America/La_Paz')


def _limites_utc(desde, hasta, tz):
    """Rango UTC naive que cubre completos los dias locales [desde, hasta]."""
    inicio = tz.localize(datetime.combine(desde, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
    fin = tz.localize(datetime.combine(hasta, time.max)).astimezone(pytz.UTC).replace(tzinfo=None)
    return inicio, fin


def siguiente_workshop(dia):
    """Primer WorkshopEvent posterior a `dia`, o None si todavia no hay."""
    return WorkshopEvent.query.filter(WorkshopEvent.date > dia).order_by(WorkshopEvent.date).first()


def ventana_evento(dia, tz):
    """(desde, hasta, siguiente): dias locales que le pertenecen al taller de `dia`.

    Va del dia de la clase al dia anterior al proximo workshop registrado, asi
    dos talleres seguidos nunca se disputan la misma agenda. Sin proximo taller
    la ventana llega hasta hoy y sigue creciendo hasta que se registre uno.
    """
    siguiente = siguiente_workshop(dia)
    hasta = siguiente.date - timedelta(days=1) if siguiente else datetime.now(tz).date()
    if hasta < dia:
        hasta = dia
    return dia, hasta, siguiente


def _clasificar_fuente(*textos):
    if es_workshop_landing(*textos):
        return 'landing'
    if es_workshop_vivo(*textos):
        return 'vivo'
    return None


def _contar_aplicaciones(desde, hasta, tz):
    """Formularios de calificacion completados en la ventana, separados por embudo.

    Un `fuente_form` vacio no es un formulario real: son Clients que entraron por
    otro flujo (ej. sync de agenda) y nunca completaron el cuestionario, asi que
    no cuentan. 'No identificado' si es un formulario real completo -- el lead
    respondio todo el cuestionario, solo fallo el tag de que pagina lo origino --
    asi que en vez de perderse cuenta del lado del vivo (12/sep/2026).

    Un cliente entra a la ventana si se CREO en ella o si su formulario se ENVIO
    en ella (`form_data.submitted_at`). Mirar solo `created_at` dejaba afuera a
    todo el que ya estaba en la base -- agendo antes o aplico a un taller
    anterior -- y volvia a llenar el formulario: el endpoint del formulario le
    actualiza el `form_data` en vez de crearle un cliente nuevo. El 19/sep/2026
    el panel mostraba 8 aplicaciones con 15 formularios del taller ya enviados.

    Se conservan las dos fechas porque `submitted_at` se pisa en cada envio (solo
    queda el ULTIMO): usar solo el envio le quitaria al taller viejo a quien se
    volvio a anotar despues, y `created_at` sigue diciendo en que ventana entro
    la primera vez. Los formularios anteriores a junio no traen `submitted_at` y
    cuentan solo por `created_at`.
    """
    inicio, fin = _limites_utc(desde, hasta, tz)
    # `submitted_at` es texto ISO en UTC (datetime.utcnow().isoformat()): el orden
    # alfabetico es el cronologico, asi que el rango se compara como texto.
    enviado = Client.form_data['submitted_at'].as_string()
    clientes = Client.query.filter(
        or_(
            (Client.created_at >= inicio) & (Client.created_at <= fin),
            (enviado >= inicio.isoformat()) & (enviado <= fin.isoformat()),
        )
    ).all()

    conteo = {'vivo': 0, 'landing': 0}
    for c in clientes:
        fd = c.form_data or {}
        fuente_form = fd.get('fuente_form')
        grupo = _clasificar_fuente(fuente_form, fd.get('fuente'))
        if not grupo and fuente_form and es_sin_dueno(fuente_form):
            grupo = 'vivo'
        if grupo:
            conteo[grupo] += 1
    return conteo


def _agendas_por_embudo(desde, hasta, tz):
    """Agendas del workshop dentro de su ventana, separadas en vivo y grabacion.

    Una agenda entra si `created_at` (UTC) cae en la ventana o si `registro` (la
    fecha local del alta, texto ISO que manda n8n) es de alguno de sus dias. No
    hay tolerancia hacia el dia anterior ni horas de mas al final: las ventanas
    de dos talleres seguidos son contiguas y cada agenda cuenta en uno solo.

    Pero la fecha de alta sola no alcanza: una agenda cuya LLAMADA ya habia
    pasado antes de la clase no la trajo este taller -- nadie reserva una cita
    para el pasado. Esas filas son citas viejas que recien ahora llegaron a
    `financial_agendas`: `BookingService.sync_appointment_to_financial_agenda`
    espeja la cita cuando un closer la toca y la da de alta con la fecha de ese
    momento, y las importaciones masivas traen `created_at` del dia del import.
    Sin este corte caian en la ventana del taller que estuviera abierto: el
    taller del 26/09/2026 mostraba "1 agenda exitosa" a mitad de la clase, y era
    una cita del 2 de septiembre (26/09/2026).
    """
    inicio, fin = _limites_utc(desde, hasta, tz)
    desde_str = desde.strftime('%Y-%m-%d')
    tope_str = (hasta + timedelta(days=1)).strftime('%Y-%m-%d')

    candidatas = FinancialAgenda.query.filter(
        # Las marcadas a mano como repetidas del mismo lead no cuentan. El conteo por
        # persona ya las absorbe en casi todos los casos, pero no cuando la identidad no
        # alcanza para reconocerlas (instagram 'no tengo', mail 'N/A'): ahi la unica que
        # las puede unir es una persona, desde el panel de duplicados.
        FinancialAgenda.duplicada_de_id.is_(None),
        or_(
            (FinancialAgenda.created_at >= inicio) & (FinancialAgenda.created_at <= fin),
            (FinancialAgenda.registro >= desde_str) & (FinancialAgenda.registro < tope_str),
        )
    ).all()

    grupos = {'vivo': [], 'landing': []}
    for a in candidatas:
        # `date` es la hora de la cita en UTC e `inicio` las 00:00 locales del dia
        # de la clase: una cita anterior a eso es de antes del taller. Sin `date`
        # no hay con que descartarla, asi que se cuenta.
        if a.date and a.date < inicio:
            continue
        raw = a.raw_data or {}
        grupo = _clasificar_fuente(a.nombre, raw.get('fuente'), raw.get('fuente_form'))
        if grupo:
            grupos[grupo].append(a)
    return grupos


def _estado_post_call(agenda):
    """Estado real de la cita: el resultado del closer manda sobre el de la hoja."""
    estado = agenda.estado or 'Pendiente'
    tiene_closer = agenda.closer and agenda.closer.strip() and agenda.closer.strip().lower() != 'sin asignar'
    if not tiene_closer:
        return estado

    ig = agenda.instagram.strip().replace('@', '').lower() \
        if agenda.instagram and agenda.instagram.lower() not in ('n/a', '') else None
    mail = agenda.mail.strip().lower() \
        if agenda.mail and agenda.mail.lower() not in ('n/a', '') else None

    condiciones = []
    if ig:
        condiciones.append(func.lower(func.replace(Client.instagram, '@', '')) == ig)
    if mail:
        condiciones.append(func.lower(Client.email) == mail)
    if not condiciones or not agenda.date:
        return estado

    client = Client.query.filter(or_(*condiciones)).first()
    if not client:
        return estado

    appt = Appointment.query.filter(
        Appointment.client_id == client.id,
        Appointment.start_time >= datetime.combine(agenda.date.date(), time.min),
        Appointment.start_time <= datetime.combine(agenda.date.date(), time.max)
    ).first()
    if not appt or not appt.closer_result:
        return estado

    equivalencias = {
        'Show up': 'Show Up', 'No Show': 'No Show', 'Cancelado': 'Cancelada',
        'Reagendado': 'Reagendada', '2da call': '2TH Call'
    }
    return equivalencias.get(appt.closer_result, appt.closer_result)


def _bucket_estado(estado):
    """A cual de las 6 columnas del desglose pertenece un estado."""
    if estado in ('Show Up', 'Show up', 'Asistió'):
        return "Show Up"
    if estado in ('No Show', 'no show', 'Inasistencia'):
        return "No Show"
    if estado in ('Cancelado', 'Cancelada'):
        return "Cancelada"
    if estado in ('Reagendado', 'Reagendada'):
        return "Reagendada"
    if estado == 'Pendiente':
        return "Pendiente"
    return "Otros"


def _desglose_estados(personas):
    """Cuenta PERSONAS, no filas: recibe los grupos que devuelve `_agrupar_por_persona`.

    Quien reprograma queda con dos filas (el webhook solo reconoce un duplicado si la
    reunion cae el MISMO dia, asi que un cambio de dia entra como agenda nueva) y antes
    sumaba dos veces. Como las ventas ya se contaban por persona, el embudo se dividia
    entre un numerador deduplicado y un denominador que no lo estaba, y el close rate y
    el costo por agenda salian mal (26/09/2026).

    A cada persona le corresponde una sola columna del desglose: la de su ultima cita,
    salvo que haya asistido a alguna, en cuyo caso es Show Up -- lo que ya logro no lo
    borra una reprogramacion posterior.
    """
    desglose = {"Show Up": 0, "No Show": 0, "Cancelada": 0, "Reagendada": 0, "Pendiente": 0, "Otros": 0}
    show_up = 0
    for agendas in personas:
        buckets = [(a.date, _bucket_estado(_estado_post_call(a))) for a in agendas]
        if any(b == "Show Up" for _, b in buckets):
            show_up += 1
            desglose["Show Up"] += 1
            continue
        _, bucket = max(buckets, key=lambda par: (par[0] is not None, par[0]))
        desglose[bucket] += 1
    return show_up, desglose


def _clave_identidad(agenda):
    """Con que se reconoce a la misma persona entre dos agendas, o None si no alcanza.

    Es la misma clave que ya usaba `_ventas_de` para no contarle la venta dos veces a
    quien aparece en los dos embudos: instagram, si no el mail, si no el nombre. Los
    handles que no identifican a nadie ('n/a', 'no tengo') se descartan, porque si no
    todos los que escribieron eso se fusionarian en una sola persona.
    """
    ig = (agenda.instagram or '').strip().replace('@', '').lower()
    mail = (agenda.mail or '').strip().lower()
    lead = (agenda.lead or '').strip().lower()

    ig = ig if ig and ig not in HANDLES_INVALIDOS else None
    mail = mail if mail and mail not in HANDLES_INVALIDOS else None
    lead = lead if lead and len(lead) > 2 else None
    return ig or mail or lead


def _agrupar_por_persona(agendas, claves_ya_contadas):
    """Agrupa las agendas de una misma persona en una sola entrada.

    `claves_ya_contadas` es el mismo mecanismo que usa `_ventas_de`: quien aparece en el
    vivo y despues en la grabacion se cuenta una sola vez, del lado del vivo, para que
    los dos grupos sumen exactamente el total. El set se actualiza en el lugar.

    Una agenda sin datos para identificar a nadie no se puede fusionar con ninguna otra,
    asi que va sola: mejor contarla de mas que fusionar a dos personas distintas.
    """
    grupos = {}
    sueltas = []
    for a in sorted(agendas, key=lambda x: (x.date is not None, x.date)):
        clave = _clave_identidad(a)
        if not clave:
            sueltas.append([a])
            continue
        if clave in claves_ya_contadas:
            continue
        grupos.setdefault(clave, []).append(a)
    claves_ya_contadas.update(grupos)
    return list(grupos.values()) + sueltas


def _tipo_simple(sale):
    from app.api.public.financial_sales import split_tipo_pago
    if not sale or not sale.tipo_pago:
        return ''
    _, simple = split_tipo_pago(sale.tipo_pago)
    return (simple or '').lower().strip()


def _es_cierre(sale):
    """Solo Split Pay y Completo: lo que convierte a la persona en compradora y entra en el close
    rate del taller. La seña es una reserva, no un cierre."""
    tp = _tipo_simple(sale)
    if any(ex in tp for ex in ['cuota', 'renovac', 'upsell']):
        return False
    return ('parcial' in tp or 'split' in tp or 'primer pago' in tp
            or 'completo' in tp or 'pif' in tp or 'full' in tp)


def _es_venta_valida(sale):
    """Lo que suma al cash del taller: Seña, Split Pay y Completo. Cuotas, renovaciones y upsells
    no. La seña es plata que el taller trajo aunque todavía no sea un cierre (ver `_es_cierre`)."""
    tp = _tipo_simple(sale)
    return _es_cierre(sale) or (('seña' in tp or 'sena' in tp)
                                and not any(ex in tp for ex in ['cuota', 'renovac', 'upsell']))


def _ventas_de(agendas, compradores_ya_contados):
    """Compradores unicos y ventas de una lista de agendas.

    `compradores_ya_contados` evita que la misma persona sume en los dos embudos:
    quien aparece en el vivo y despues en la grabacion se cuenta una sola vez, del
    lado del vivo, para que los dos grupos sumen exactamente el total.

    El cruce con `FinancialSale` es por identidad (instagram/mail/nombre), asi que
    sin filtro de fecha una venta VIEJA de alguien que vuelve a agendar para un
    taller nuevo se le sumaba a ese taller aunque sea de semanas atras -- un
    evento del mismo dia llegaba a mostrar ROAS positivo antes de que sus propias
    agendas tuvieran chance de cerrar. Una venta solo cuenta si es igual o
    posterior a la agenda que la trajo (con 1 dia de margen por huso horario)
    (12/sep/2026).

    Compradora es quien pagó completo o hizo split pay: la seña suma a `ventas` (y por lo tanto al
    cash del taller) pero no hace compradora a nadie, así que no entra en `sales` ni en el close
    rate del taller (30/09/2026).
    """
    compradores = set()
    ventas = set()

    for a in agendas:
        clave = _clave_identidad(a)
        if not clave:
            continue
        if clave in compradores_ya_contados:
            continue

        ig = (a.instagram or '').strip().replace('@', '').lower()
        mail = (a.mail or '').strip().lower()
        lead = (a.lead or '').strip().lower()
        ig = ig if ig and ig not in HANDLES_INVALIDOS else None
        mail = mail if mail and mail not in HANDLES_INVALIDOS else None
        lead = lead if lead and len(lead) > 2 else None

        condiciones = []
        if ig:
            condiciones.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig)
        if mail:
            condiciones.append(func.lower(FinancialSale.mail_cliente) == mail)
        if lead:
            condiciones.append(func.lower(FinancialSale.nombre_cliente) == lead)

        piso_venta = a.created_at - timedelta(days=1) if a.created_at else None
        validas = [
            s for s in FinancialSale.query.filter(or_(*condiciones)).all()
            if _es_venta_valida(s) and (not piso_venta or not s.date or s.date >= piso_venta)
        ]
        ventas.update(validas)
        if any(_es_cierre(s) for s in validas):
            compradores.add(clave)
        elif any(st in (a.estado or '').lower().strip() for st in ESTADOS_DE_VENTA):
            # La agenda quedo marcada como cerrada aunque la venta real no este cargada (puede
            # haber solo una seña cargada: la hoja dice que despues se cerro)
            compradores.add(clave)

    return compradores, ventas


def _resumen(personas, agendas, compradores, ventas):
    """`personas` son los grupos de `_agrupar_por_persona`; `agendas` las filas crudas.

    Las cuatro metricas del embudo van por persona. `llamadas` queda aparte como dato
    informativo: es cuantas reuniones se reservaron de verdad, que es lo que mide la
    carga de los closers y casi siempre es un numero mas alto.
    """
    show_up, desglose = _desglose_estados(personas)
    return {
        "agendas": len(personas),
        "llamadas": len(agendas),
        "show_up": show_up,
        "sales": len(compradores),
        "cash_collected": sum(s.monto or 0.0 for s in ventas),
        "breakdown": desglose,
    }


def calcular_prefill(dia, timezone_str='America/La_Paz'):
    """Metricas automaticas del workshop del dia `dia` (date), vivo + grabacion."""
    tz = _tz(timezone_str)
    desde, hasta, siguiente = ventana_evento(dia, tz)

    aplicaciones = _contar_aplicaciones(desde, hasta, tz)
    grupos = _agendas_por_embudo(desde, hasta, tz)

    # Una persona que agendo dos veces cuenta una sola vez, y si aparece en el vivo y
    # en la grabacion cuenta del lado del vivo -- el mismo criterio con el que ya se
    # contaban las ventas, para que el embudo divida personas por personas.
    vistas = set()
    personas_vivo = _agrupar_por_persona(grupos['vivo'], vistas)
    personas_landing = _agrupar_por_persona(grupos['landing'], vistas)

    compradores_vivo, ventas_vivo = _ventas_de(grupos['vivo'], set())
    compradores_landing, ventas_landing = _ventas_de(grupos['landing'], compradores_vivo)

    resumen_vivo = _resumen(personas_vivo, grupos['vivo'], compradores_vivo, ventas_vivo)
    resumen_landing = _resumen(personas_landing, grupos['landing'], compradores_landing,
                               ventas_landing - ventas_vivo)

    resumen_vivo["aplicaciones_form"] = aplicaciones['vivo']
    resumen_landing["aplicaciones_form"] = aplicaciones['landing']

    breakdown_total = {
        k: resumen_vivo["breakdown"][k] + resumen_landing["breakdown"][k]
        for k in resumen_vivo["breakdown"]
    }

    return {
        # Totales del workshop: la clase en vivo mas su grabacion
        "aplicaciones_form": aplicaciones['vivo'] + aplicaciones['landing'],
        "agendas_exitosas": resumen_vivo["agendas"] + resumen_landing["agendas"],
        # Reuniones reservadas (la carga de los closers). Es >= agendas_exitosas cuando
        # alguien reprogramo o volvio a agendar: no entra al embudo, va como referencia.
        "llamadas_agendadas": resumen_vivo["llamadas"] + resumen_landing["llamadas"],
        "show_up_sales_call": resumen_vivo["show_up"] + resumen_landing["show_up"],
        "sales": resumen_vivo["sales"] + resumen_landing["sales"],
        "cash_collected": resumen_vivo["cash_collected"] + resumen_landing["cash_collected"],
        "agendas_breakdown": breakdown_total,
        "desglose": {
            "vivo": resumen_vivo,
            "landing": resumen_landing,
        },
        # Que dias se contaron. `abierta` = todavia no hay un taller posterior,
        # asi que la ventana llega hasta hoy y va a seguir creciendo.
        "ventana": {
            "vivo": dia.strftime('%Y-%m-%d'),
            "desde": desde.strftime('%Y-%m-%d'),
            "hasta": hasta.strftime('%Y-%m-%d'),
            "dias": (hasta - desde).days + 1,
            "abierta": siguiente is None,
            "siguiente": siguiente.date.strftime('%Y-%m-%d') if siguiente else None,
        },
    }
