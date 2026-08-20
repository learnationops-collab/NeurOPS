"""Metricas del embudo de un workshop, para el autocompletado del panel.

Vive fuera de `app/api/workshop.py` porque el calculo dejo de ser "contar lo del
dia": desde el 20/08/2026 un workshop incluye DOS entradas de leads que ocurren
en momentos distintos.

  · WORKSHOP EN VIVO  -> la clase del dia D (fuente 'workshop')
  · WORKSHOP LANDING  -> la grabacion publicada en /replay/, disponible 2 dias
                         despues de la clase (fuente 'workshop landing')

Las dos pertenecen al MISMO workshop y por eso suman en el analisis, pero se
cuentan por separado para poder ver cuanto aporta cada una. La ventana de la
grabacion se recorta si hay otro workshop antes de que terminen esos 2 dias, asi
las agendas no se le suman a los dos eventos a la vez.
"""
from datetime import datetime, time, timedelta

import pytz
from sqlalchemy import or_, func

from app.models import Client, FinancialAgenda, FinancialSale, Appointment, WorkshopEvent
from app.services.fuente_service import es_workshop_landing, es_workshop_vivo

# Dias que la grabacion queda publicada despues de la clase en vivo
DIAS_VENTANA_LANDING = 2

# Handles que la gente escribe cuando no tiene Instagram: no identifican a nadie
HANDLES_INVALIDOS = {'n/a', 'na', 'no tengo', 'notengo', 'ninguno', 'none', '', 'sin instagram', 'no'}

ESTADOS_DE_VENTA = ['cierre', 'seña', 'sena', 'completo', 'ganado', 'venta', 'vendido', 'completado']


def _limites_utc(dia, tz):
    """Convierte un dia local completo al rango UTC equivalente."""
    inicio = tz.localize(datetime.combine(dia, time.min)).astimezone(pytz.UTC).replace(tzinfo=None)
    fin = tz.localize(datetime.combine(dia, time.max)).astimezone(pytz.UTC).replace(tzinfo=None)
    return inicio, fin


def _ventana_landing(dia):
    """[desde, hasta] local de la grabacion, recortada por el proximo workshop.

    Sin el recorte, dos workshops separados por menos de 2 dias se disputarian
    las mismas agendas de la grabacion y ambos las contarian como propias.
    """
    hasta = dia + timedelta(days=DIAS_VENTANA_LANDING)
    siguiente = WorkshopEvent.query.filter(WorkshopEvent.date > dia).order_by(WorkshopEvent.date).first()
    recortada = False
    if siguiente and siguiente.date <= hasta:
        hasta = siguiente.date - timedelta(days=1)
        recortada = True
    if hasta < dia:
        hasta = dia
    return dia, hasta, recortada


def _clasificar_fuente(*textos):
    if es_workshop_landing(*textos):
        return 'landing'
    if es_workshop_vivo(*textos):
        return 'vivo'
    return None


def _contar_aplicaciones(dia, tz, fin_landing):
    """Formularios de calificacion completados, separados por embudo.

    El rango se amplia un dia sobre el final de cada ventana porque `created_at`
    esta en UTC y el corte local puede caer del otro lado del cambio de dia.
    """
    inicio_vivo, fin_vivo = _limites_utc(dia, tz)
    _, fin_landing_utc = _limites_utc(fin_landing, tz)
    tope = max(fin_vivo, fin_landing_utc) + timedelta(days=1)

    clientes = Client.query.filter(Client.created_at >= inicio_vivo, Client.created_at <= tope).all()

    conteo = {'vivo': 0, 'landing': 0}
    for c in clientes:
        fd = c.form_data or {}
        grupo = _clasificar_fuente(fd.get('fuente_form'), fd.get('fuente'))
        if not grupo:
            continue
        # El vivo solo cuenta el dia de la clase; la grabacion, toda su ventana.
        limite = fin_vivo + timedelta(days=1) if grupo == 'vivo' else tope
        if c.created_at <= limite:
            conteo[grupo] += 1
    return conteo


def _agendas_por_embudo(dia, tz, fin_landing):
    """Agendas del workshop del dia, separadas en vivo y grabacion."""
    inicio_vivo, fin_vivo = _limites_utc(dia, tz)
    _, fin_landing_utc = _limites_utc(fin_landing, tz)

    # `registro` es texto con la fecha local del alta en n8n; se incluye el dia
    # anterior porque el desfase UTC/local puede correrlo.
    dia_str = dia.strftime('%Y-%m-%d')
    previo_str = (dia - timedelta(days=1)).strftime('%Y-%m-%d')
    dias_landing = [
        (dia + timedelta(days=n)).strftime('%Y-%m-%d')
        for n in range((fin_landing - dia).days + 1)
    ]

    candidatas = FinancialAgenda.query.filter(
        or_(
            (FinancialAgenda.created_at >= inicio_vivo) & (FinancialAgenda.created_at <= fin_landing_utc + timedelta(hours=8)),
            FinancialAgenda.registro.like(f"{dia_str}%"),
            FinancialAgenda.registro.like(f"{previo_str}%"),
            *[FinancialAgenda.registro.like(f"{d}%") for d in dias_landing]
        )
    ).all()

    grupos = {'vivo': [], 'landing': []}
    tope_vivo = fin_vivo + timedelta(hours=8)
    for a in candidatas:
        raw = a.raw_data or {}
        grupo = _clasificar_fuente(a.nombre, raw.get('fuente'), raw.get('fuente_form'))
        if not grupo:
            continue
        if grupo == 'vivo':
            en_rango = (a.created_at and inicio_vivo <= a.created_at <= tope_vivo) \
                or (a.registro or '').startswith((dia_str, previo_str))
        else:
            en_rango = (a.created_at and inicio_vivo <= a.created_at <= fin_landing_utc + timedelta(hours=8)) \
                or any((a.registro or '').startswith(d) for d in dias_landing)
        if en_rango:
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


def _desglose_estados(agendas):
    desglose = {"Show Up": 0, "No Show": 0, "Cancelada": 0, "Reagendada": 0, "Pendiente": 0, "Otros": 0}
    show_up = 0
    for a in agendas:
        estado = _estado_post_call(a)
        if estado in ('Show Up', 'Show up', 'Asistió'):
            show_up += 1
            desglose["Show Up"] += 1
        elif estado in ('No Show', 'no show', 'Inasistencia'):
            desglose["No Show"] += 1
        elif estado in ('Cancelado', 'Cancelada'):
            desglose["Cancelada"] += 1
        elif estado in ('Reagendado', 'Reagendada'):
            desglose["Reagendada"] += 1
        elif estado == 'Pendiente':
            desglose["Pendiente"] += 1
        else:
            desglose["Otros"] += 1
    return show_up, desglose


def _es_venta_valida(sale):
    """Solo Seña, Split Pay y Completo. Cuotas, renovaciones y upsells no."""
    from app.api.public.financial_sales import split_tipo_pago
    if not sale or not sale.tipo_pago:
        return False
    _, simple = split_tipo_pago(sale.tipo_pago)
    tp = (simple or '').lower().strip()
    if any(ex in tp for ex in ['cuota', 'renovac', 'upsell']):
        return False
    return ('seña' in tp or 'sena' in tp
            or 'parcial' in tp or 'split' in tp or 'primer pago' in tp
            or 'completo' in tp or 'pif' in tp or 'full' in tp)


def _ventas_de(agendas, compradores_ya_contados):
    """Compradores unicos y ventas de una lista de agendas.

    `compradores_ya_contados` evita que la misma persona sume en los dos embudos:
    quien aparece en el vivo y despues en la grabacion se cuenta una sola vez, del
    lado del vivo, para que los dos grupos sumen exactamente el total.
    """
    compradores = set()
    ventas = set()

    for a in agendas:
        ig = (a.instagram or '').strip().replace('@', '').lower()
        mail = (a.mail or '').strip().lower()
        lead = (a.lead or '').strip().lower()

        ig = ig if ig and ig not in HANDLES_INVALIDOS else None
        mail = mail if mail and mail not in HANDLES_INVALIDOS else None
        lead = lead if lead and len(lead) > 2 else None
        if not ig and not mail and not lead:
            continue

        clave = ig or mail or lead
        if clave in compradores_ya_contados:
            continue

        condiciones = []
        if ig:
            condiciones.append(func.lower(func.replace(FinancialSale.instagram, '@', '')) == ig)
        if mail:
            condiciones.append(func.lower(FinancialSale.mail_cliente) == mail)
        if lead:
            condiciones.append(func.lower(FinancialSale.nombre_cliente) == lead)

        validas = [s for s in FinancialSale.query.filter(or_(*condiciones)).all() if _es_venta_valida(s)]
        if validas:
            compradores.add(clave)
            ventas.update(validas)
        elif any(st in (a.estado or '').lower().strip() for st in ESTADOS_DE_VENTA):
            # La agenda quedo marcada como cerrada aunque la venta no este cargada
            compradores.add(clave)

    return compradores, ventas


def _resumen(agendas, compradores, ventas):
    show_up, desglose = _desglose_estados(agendas)
    return {
        "agendas": len(agendas),
        "show_up": show_up,
        "sales": len(compradores),
        "cash_collected": sum(s.monto or 0.0 for s in ventas),
        "breakdown": desglose,
    }


def calcular_prefill(dia, timezone_str='America/La_Paz'):
    """Metricas automaticas del workshop del dia `dia` (date), vivo + grabacion."""
    try:
        tz = pytz.timezone(timezone_str or 'America/La_Paz')
    except Exception:
        tz = pytz.timezone('America/La_Paz')

    _, fin_landing, recortada = _ventana_landing(dia)

    aplicaciones = _contar_aplicaciones(dia, tz, fin_landing)
    grupos = _agendas_por_embudo(dia, tz, fin_landing)

    compradores_vivo, ventas_vivo = _ventas_de(grupos['vivo'], set())
    compradores_landing, ventas_landing = _ventas_de(grupos['landing'], compradores_vivo)

    resumen_vivo = _resumen(grupos['vivo'], compradores_vivo, ventas_vivo)
    resumen_landing = _resumen(grupos['landing'], compradores_landing, ventas_landing - ventas_vivo)

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
        "show_up_sales_call": resumen_vivo["show_up"] + resumen_landing["show_up"],
        "sales": resumen_vivo["sales"] + resumen_landing["sales"],
        "cash_collected": resumen_vivo["cash_collected"] + resumen_landing["cash_collected"],
        "agendas_breakdown": breakdown_total,
        "desglose": {
            "vivo": resumen_vivo,
            "landing": resumen_landing,
        },
        "ventana": {
            "vivo": dia.strftime('%Y-%m-%d'),
            "landing_desde": dia.strftime('%Y-%m-%d'),
            "landing_hasta": fin_landing.strftime('%Y-%m-%d'),
            "landing_dias": (fin_landing - dia).days + 1,
            "landing_recortada": recortada,
        },
    }
