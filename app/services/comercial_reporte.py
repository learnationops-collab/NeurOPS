"""El reporte diario de la dirección comercial: los datos del día y el historial.

Dos cosas distintas viven acá:

  1. `dia_del_equipo`: lo que el director mira en el paso 1 del wizard — los números del día de
     cada grupo, y una fila por persona con su actividad y si reportó o no. Todo sale del
     registro real (`ComercialService`), no de lo que alguien escriba en el wizard: el director
     revisa datos, no los carga.

  2. Guardar y consultar el registro de gestión (`ReporteDirector`).

Sobre "reportó / no reportó": para un closer se sabe la HORA, porque `CloserDailyReport` guarda
cuándo se envió. Para un setter solo se sabe si cargó o no (`SetterDailyStats` no tiene marca de
tiempo), así que su chip dice "Reportó" sin hora en vez de inventar una.

"Incompleto" no es un estado que alguien marque: es que la persona reportó pero todavía le
quedan llamadas del día, ya pasadas, sin resultado. Es exactamente el mismo criterio de
"pendiente con retraso" de la tabla de Revisar, para que las dos pantallas digan lo mismo.
"""
from datetime import date, datetime

from app import db
from app.models import CloserDailyReport, ReporteDirector, ReporteDirectorPersona, SetterDailyStats, User
from app.services.comercial_service import ROL_CLOSERS, ROL_SETTERS, ComercialService


def _estado_reporte(reporto_a_las, reporto, tiene_pendientes_vencidas):
    """El chip de estado del reporte de una persona, con el tono del design system."""
    if not reporto:
        return {'key': 'sin_reportar', 'label': 'Sin reportar', 'tone': 'error'}
    hora = reporto_a_las.strftime('%H:%M') if reporto_a_las else None
    etiqueta = 'Reportó {}'.format(hora) if hora else 'Reportó'
    if tiene_pendientes_vencidas:
        return {'key': 'incompleto', 'label': '{} · incompleto'.format(etiqueta), 'tone': 'warning'}
    return {'key': 'reporto', 'label': etiqueta, 'tone': 'success'}


def _actividad_de_closer(agendas):
    return [{
        'hora': f['fecha'][11:16] if f['fecha'] else '',
        'cliente': f['cliente'],
        'detalle': '{} · {}'.format(f['fuente'], f['pre_call']['label']),
        'chip': f['post_call'],
    } for f in agendas]


def _actividad_de_setter(leads):
    return [{
        'hora': f['fecha'][11:16] if f['fecha'] else '',
        'cliente': f['cliente'],
        'detalle': '{} · {} mensajes'.format(f['fuente'], f['mensajes']),
        'chip': f['estado'],
    } for f in leads]


def dia_del_equipo(fecha=None):
    """Paso 1 del wizard: los números del día y el estado de cada persona."""
    dia = fecha or date.today()

    agendas = ComercialService.agendas(dia, dia)
    ventas = ComercialService.ventas(dia, dia)
    leads = ComercialService.leads(dia, dia)
    tot_a = ComercialService.totales_agendas(agendas)
    tot_v = ComercialService.totales_ventas(ventas)
    tot_l = ComercialService.totales_leads(leads)

    closers = ComercialService.miembros(ROL_CLOSERS)
    setters = ComercialService.miembros(ROL_SETTERS)

    reportes_closer = {r.closer_id: r for r in CloserDailyReport.query.filter_by(date=dia).all()}
    reportaron_setter = {s.setter_id for s in SetterDailyStats.query.filter_by(date=dia).all()}

    personas = []
    for c in closers:
        suyas = [f for f in agendas if f['closer_id'] == c['id']]
        vencidas = [f for f in suyas if f['retraso_dias'] > 0 or
                    (f['post_call']['key'] == 'pendiente' and f['fecha'] and
                     datetime.fromisoformat(f['fecha']) < datetime.utcnow())]
        resumen = ComercialService.totales_agendas(suyas)
        reporte = reportes_closer.get(c['id'])
        personas.append({
            **c,
            'grupo': ROL_CLOSERS,
            'resumen': '{} llamadas · {} ventas · {} no show · {} sin resultado'.format(
                resumen['realizadas'], resumen['ventas'], resumen['no_show'], resumen['pendientes']),
            'estado': _estado_reporte(reporte.created_at if reporte else None, bool(reporte), bool(vencidas)),
            'actividad': _actividad_de_closer(suyas),
        })

    for s in setters:
        suyos = [f for f in leads if f['setter'] and f['setter'].strip().lower() == s['nombre'].strip().lower()]
        generadas = [f for f in agendas if f['setter_id'] == s['id']]
        resumen = ComercialService.totales_leads(suyos)
        personas.append({
            **s,
            'grupo': ROL_SETTERS,
            'resumen': '{} leads · {} mensajes · {} agendas'.format(
                resumen['leads'], resumen['mensajes'], len(generadas)),
            'estado': _estado_reporte(None, s['id'] in reportaron_setter, False),
            'actividad': _actividad_de_setter(suyos),
        })

    return {
        'fecha': dia.isoformat(),
        'closers': {'agendas': tot_a['agendas'], 'asistieron': tot_a['asistieron'],
                    'ventas': tot_a['ventas'], 'cash': tot_v['cash']},
        'setters': {'leads': tot_l['leads'], 'mensajes': tot_l['mensajes'],
                    'respuesta': tot_l['respuesta'], 'agendas': tot_l['agendas']},
        'personas': personas,
        'sugerencias': _sugerencias(agendas, ventas, personas),
    }


def _sugerencias(agendas, ventas, personas):
    """Como máximo dos sugerencias por lista, sacadas de los datos del día. No se inventan: si no
    pasó nada que sugerir, la lista viene vacía y el director escribe lo suyo."""
    victorias = ['Cerró {} · ${:,.0f}'.format(v['cliente'], v['monto'])
                 for v in ventas if v['es_venta']][:2]
    mejoras = ['No show sin confirmar · {}'.format(f['cliente']) for f in agendas
               if f['post_call']['key'] == 'no_show' and f['pre_call']['key'] == 'sin_confirmar'][:2]
    if len(mejoras) < 2:
        mejoras += ['Sin reportar · {}'.format(p['nombre']) for p in personas
                    if p['estado']['key'] == 'sin_reportar'][:2 - len(mejoras)]
    proximos = ['Seguimiento de {}'.format(f['cliente']) for f in agendas
                if f['post_call']['key'] == 'seguimiento'][:2]
    return {'victorias': victorias, 'mejoras': mejoras, 'proximos': proximos}


def _lista_de_textos(valor):
    """Normaliza una lista del cierre: solo textos no vacíos, sin duplicados y en orden."""
    if not isinstance(valor, list):
        return []
    vistos, salida = set(), []
    for item in valor:
        texto = str(item or '').strip()
        if texto and texto not in vistos:
            vistos.add(texto)
            salida.append(texto)
    return salida


def guardar(director, datos, fecha=None):
    """Guarda (o actualiza) el reporte de un día.

    Volver a guardar el mismo día actualiza el reporte existente en vez de crear un segundo: el
    día es único por diseño y lo normal es que el director vuelva a corregir lo que escribió.
    """
    dia = fecha or date.today()
    reporte = ReporteDirector.query.filter_by(fecha=dia).first()
    if not reporte:
        reporte = ReporteDirector(director_id=director.id, fecha=dia)
        db.session.add(reporte)

    grupal = datos.get('grupal') or {}
    listas = datos.get('listas') or {}
    reporte.director_id = director.id
    reporte.grupal_closers = (grupal.get('closers') or '').strip()
    reporte.grupal_setters = (grupal.get('setters') or '').strip()
    reporte.victorias = _lista_de_textos(listas.get('victorias'))
    reporte.mejoras = _lista_de_textos(listas.get('mejoras'))
    reporte.proximos = _lista_de_textos(listas.get('proximos'))
    db.session.flush()

    # Se reemplaza el registro por persona entero: el wizard siempre manda las respuestas de
    # todas, y mezclar lo nuevo con lo viejo dejaría respuestas de una edición anterior.
    ReporteDirectorPersona.query.filter_by(reporte_id=reporte.id).delete()
    ids_validos = {u.id for u in User.query.filter(
        User.role.in_(['closer', 'setter']), User.is_active.is_(True)).all()}
    for fila in (datos.get('individual') or []):
        miembro_id = fila.get('miembro_id')
        if miembro_id not in ids_validos or fila.get('trabajo') is None:
            continue
        trabajo = bool(fila.get('trabajo'))
        db.session.add(ReporteDirectorPersona(
            reporte_id=reporte.id, miembro_id=miembro_id, trabajo=trabajo,
            texto=(fila.get('texto') or '').strip() if trabajo else None))

    db.session.commit()
    return reporte


def historial(miembro_id=None, limite=60):
    """El historial completo, o el registro de trabajo de una persona.

    Con `miembro_id` se devuelven solo los días en los que esa persona tuvo una respuesta (haya
    sido "trabajamos" o "no hizo falta"), que es la vista "Registro de trabajo · Nombre".
    """
    q = ReporteDirector.query.order_by(ReporteDirector.fecha.desc())
    if miembro_id:
        q = q.join(ReporteDirectorPersona).filter(ReporteDirectorPersona.miembro_id == miembro_id)
    reportes = [r.to_dict() for r in q.limit(limite).all()]

    if not miembro_id:
        return {'miembro_id': None, 'reportes': reportes}

    dias = []
    for r in reportes:
        suya = next((p for p in r['individual'] if p['miembro_id'] == miembro_id), None)
        if suya:
            dias.append({'fecha': r['fecha'], **suya})
    trabajados = sum(1 for d in dias if d['trabajo'])
    return {'miembro_id': miembro_id, 'reportes': reportes, 'dias': dias,
            'trabajados': trabajados, 'total': len(dias)}
