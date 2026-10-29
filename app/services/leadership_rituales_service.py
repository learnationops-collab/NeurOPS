"""Los rituales de cada taller en Learnation Leadership, calculados desde su fecha y hora reales.

Cada vez que se crea, mueve o borra un `WorkshopEvent` (Workshops › Próximos) las tareas de ese
taller en Leadership se ajustan solas (ADR-W016):

  · 2 días antes:  mensaje al grupo de WhatsApp
  · 1 día antes:   otro mensaje al grupo y el broadcast
  · el mismo día:  recordatorio al grupo 5 h, 2 h y 30 min antes de empezar
  · al terminar:   registrar en Work los datos del taller

Las tareas viven en un solo proyecto («Workshops · rituales»). Cada una lleva en la primera línea
de su descripción una marca `[work-ws:<id del taller>:<clave>]`: así se reconocen sin guardar nada
en la base de Work. Las horas de Leadership son de reloj (sin zona); se calculan en `LEADERSHIP_TZ`
(por defecto America/Caracas, donde trabaja Kerwin). Los avisos de 30 y 5 minutos los lanza
`scripts/avisos_leadership.ps1` en la PC de Kerwin, leyendo estas mismas tareas.

Conexión y variables: ver `leadership_client`. Sin configurar, todo es un no-op.
"""
import logging
import os
import re
import threading
from datetime import datetime, timedelta

import pytz

from app.models import WorkshopEvent
from app.services.leadership_client import LeadershipClient, LeadershipError, configurado

logger = logging.getLogger(__name__)

PROYECTO = 'Workshops · rituales'
PROYECTO_DESCRIPCION = ('Mensajes, broadcast y recordatorios de cada workshop. Las crea y las mueve '
                        'Work solo cuando cambia la fecha u hora del taller; no las edites a mano.')
ZONA_POR_DEFECTO = 'America/Caracas'
HORA_DE_LOS_MENSAJES = (10, 0)   # 2 y 1 día antes: hora fija del día
HORA_DEL_BROADCAST = (10, 30)
REGISTRO_DESPUES = timedelta(hours=2)
DURACION_MIN = 15
# Un taller que empezó hace más que esto ya no se toca (sus tareas quedan como historial).
VENTANA_PASADA = timedelta(days=1)
# Solo los talleres de los próximos días tienen tareas: con 26 semanas programadas serían cientos.
# Cada día (cron) entra uno más; si un taller se mueve más lejos, sus tareas abiertas se quitan.
HORIZONTE = timedelta(days=10)

MARCA = re.compile(r'^\[work-ws:(\d+):([a-z0-9_]+)\]')
_candado = threading.Lock()


def zona():
    try:
        return pytz.timezone(os.environ.get('LEADERSHIP_TZ') or ZONA_POR_DEFECTO)
    except Exception:
        return pytz.timezone(ZONA_POR_DEFECTO)


def _hora_local(inicio_utc, tz):
    return pytz.UTC.localize(inicio_utc).astimezone(tz).replace(tzinfo=None)


def _plan(evento, tz):
    """clave -> (momento local, título corto, qué hacer). Vacío si el taller no tiene hora."""
    if not evento.inicio_at:
        return {}
    ini = _hora_local(evento.inicio_at, tz)
    dia = ini.replace(hour=0, minute=0)
    def a(d, hm):
        return d.replace(hour=hm[0], minute=hm[1])
    grupo = 'Abrí el grupo de WhatsApp del taller y mandá el mensaje.'
    return {
        'msg_2d': (a(dia - timedelta(days=2), HORA_DE_LOS_MENSAJES), 'Mensaje al grupo (2 días antes)', grupo),
        'msg_1d': (a(dia - timedelta(days=1), HORA_DE_LOS_MENSAJES), 'Mensaje al grupo (1 día antes)', grupo),
        'bc_1d': (a(dia - timedelta(days=1), HORA_DEL_BROADCAST), 'Broadcast (1 día antes)',
                  'Mandá el broadcast del taller a la lista.'),
        'rec_5h': (ini - timedelta(hours=5), 'Recordatorio al grupo (5 h antes)', grupo),
        'rec_2h': (ini - timedelta(hours=2), 'Recordatorio al grupo (2 h antes)', grupo),
        'rec_30m': (ini - timedelta(minutes=30), 'Recordatorio al grupo (30 min antes)', grupo),
        'registro': (ini + REGISTRO_DESPUES, 'Registrar los datos del workshop en Work',
                     'Cargá en Work (Workshops › Talleres) show up, pitch y grupo de WhatsApp de este taller.'),
    }


def tareas_de(evento, tz=None):
    """Las tareas que Leadership debe tener para el taller: clave -> campos del POST/PATCH."""
    tz = tz or zona()
    ini = _hora_local(evento.inicio_at, tz) if evento.inicio_at else None
    salida = {}
    for clave, (momento, titulo, que) in _plan(evento, tz).items():
        lineas = [f'[work-ws:{evento.id}:{clave}]', que, f'Taller: {ini:%d/%m/%Y %H:%M} (hora de {tz.zone}).']
        if evento.whatsapp_url:
            lineas.append(f'Grupo de WhatsApp: {evento.whatsapp_url}')
        if evento.meet_url:
            lineas.append(f'Meet: {evento.meet_url}')
        salida[clave] = {
            'title': f'Workshop {ini:%d/%m} · {titulo}',
            'description': '\n'.join(lineas),
            'due_date': momento.date().isoformat(),
            'start_time': momento.strftime('%H:%M'),
            'end_time': (momento + timedelta(minutes=DURACION_MIN)).strftime('%H:%M')
            if (momento + timedelta(minutes=DURACION_MIN)).date() == momento.date() else None,
            'estimated_minutes': DURACION_MIN,
            'value_score': 3, 'speed_score': 3, 'urgency_score': 3, 'gap_score': 2,
            '_momento': momento,
        }
    return salida


def _marca(tarea):
    m = MARCA.match(tarea.get('description') or '')
    return (int(m.group(1)), m.group(2)) if m else None


def _proyecto_id(cliente):
    fijo = (os.environ.get('LEADERSHIP_PROJECT_ID') or '').strip()
    if fijo.isdigit():
        return int(fijo)
    for p in cliente.proyectos():
        if p.get('name') == PROYECTO:
            return p['id']
    return cliente.crear_proyecto(PROYECTO, PROYECTO_DESCRIPCION)['id']


def _cambios(actual, deseado):
    """Lo que difiere entre la tarea de Leadership y la deseada (campos del PATCH)."""
    return {k: v for k, v in deseado.items()
            if not k.startswith('_') and k in actual and actual.get(k) != v
            and k not in ('value_score', 'speed_score', 'urgency_score', 'gap_score')}


def reconciliar(cliente, project_id, eventos, borrados=(), ahora=None):
    """Deja las tareas de `eventos` como pide su hora. Devuelve la lista de acciones hechas.

    `ahora` es hora de reloj en la zona de Leadership. Una tarea cuya hora ya pasó no se crea
    (sería ruido: el taller se agendó con menos de 2 días); si ya existe, se mueve igual.
    """
    tz = zona()
    ahora = ahora or datetime.now(tz).replace(tzinfo=None)
    por_taller = {}
    for t in cliente.tareas(project_id):
        marca = _marca(t)
        if marca:
            por_taller.setdefault(marca[0], {})[marca[1]] = t

    hecho = []
    for ev in eventos:
        if ev.inicio_at and _hora_local(ev.inicio_at, tz) < ahora - VENTANA_PASADA:
            continue
        lejos = ev.inicio_at and _hora_local(ev.inicio_at, tz) > ahora + HORIZONTE
        deseado = {} if lejos else tareas_de(ev, tz)
        existentes = por_taller.get(ev.id, {})
        for clave, campos in deseado.items():
            momento = campos['_momento']
            cuerpo = {k: v for k, v in campos.items() if not k.startswith('_')}
            actual = existentes.get(clave)
            if not actual:
                if momento >= ahora:
                    cliente.crear_tarea({**cuerpo, 'project_id': project_id})
                    hecho.append(f'crear {ev.id}:{clave} {momento:%d/%m %H:%M}')
                continue
            cambios = _cambios(actual, cuerpo)
            if cambios:
                cliente.editar_tarea(actual['id'], cambios)
                hecho.append(f'mover {ev.id}:{clave} -> {momento:%d/%m %H:%M}')
                # Cambió la hora: hay que volver a hacerla aunque ya estuviera marcada.
                if actual.get('status') == 'completed' and momento >= ahora \
                        and ('due_date' in cambios or 'start_time' in cambios):
                    cliente.alternar_tarea(actual['id'])
                    hecho.append(f'reabrir {ev.id}:{clave}')
        for clave, actual in existentes.items():
            if clave not in deseado and actual.get('status') != 'completed':
                cliente.borrar_tarea(actual['id'])
                hecho.append(f'quitar {ev.id}:{clave}')
    for ev_id in borrados:
        for clave, actual in por_taller.get(ev_id, {}).items():
            if actual.get('status') != 'completed':
                cliente.borrar_tarea(actual['id'])
                hecho.append(f'quitar {ev_id}:{clave}')
    return hecho


def sincronizar(ids_taller=None, borrados=(), cliente=None):
    """Ajusta en Leadership las tareas de los talleres `ids_taller` (None = todos los que vienen)."""
    if cliente is None and not configurado():
        return []
    with _candado:
        cliente = cliente or LeadershipClient()
        q = WorkshopEvent.query
        if ids_taller is not None:
            q = q.filter(WorkshopEvent.id.in_(list(ids_taller)))
        return reconciliar(cliente, _proyecto_id(cliente), q.all(), borrados)


def sincronizar_en_segundo_plano(app, ids_taller=None, borrados=()):
    """Lo llama el guardado del taller: nunca demora ni rompe la respuesta."""
    if not configurado():
        return

    def correr():
        with app.app_context():
            try:
                hecho = sincronizar(ids_taller, borrados)
                if hecho:
                    logger.info('Leadership: %s', '; '.join(hecho))
            except LeadershipError as e:
                logger.error('Leadership no se pudo sincronizar: %s', e)
            except Exception:
                logger.exception('Falló la sincronización con Leadership')

    threading.Thread(target=correr, daemon=True, name='leadership-sync').start()
