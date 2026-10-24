"""Las agendas de uno o varios talleres, en la MISMA fila que muestra Revisar (Closing y Dirección).

El número «15 agendas» de un taller sale de `workshop_metrics_service`: personas con una agenda en la
ventana del taller (de su día al anterior al siguiente), una vez cada una. Esas agendas son filas del
libro (`FinancialAgenda`); lo que Closing y la Dirección Comercial muestran son las citas
(`Appointment`) con su estado, closer, asistencia y venta. Acá se hace el puente, solo lectura:

  · la persona se reconoce igual que en la métrica (`_agendas_por_embudo` + `_agrupar_por_persona`),
    así que la lista tiene tantas filas como dice el número;
  · de cada persona se muestra su cita (la del mismo día de la agenda; si no, la primera desde el
    taller) con `ComercialService.filas_de_citas`, el cálculo único de la tabla Agendas;
  · quien no tiene cita (la agenda quedó solo en el libro) igual aparece, con el estado de la hoja,
    para que la lista no tenga menos filas que el número. Lleva `sin_cita`.

No toca `workshop_metrics_service`: solo usa sus funciones de agrupación.
"""
from sqlalchemy.orm import joinedload

from app.models import Appointment, WorkshopEvent
from app.services import workshop_metrics_service as metricas
from app.services.comercial_service import ComercialService
from app.services.comercial_vocabulario import ASISTIO, DESCARTADAS, REALIZADAS, chip

MAX_TALLERES = 60

# Bucket del estado de la hoja (`_bucket_estado`) -> post call del tablero, para quien no tiene cita.
_POST_DE_LA_HOJA = {'Show Up': 'asistio', 'No Show': 'no_show', 'Cancelada': 'cancelo',
                    'Reagendada': 'reagendo'}
# Para elegir entre varias citas de la misma persona: la venta y la seña ganan, como en la tabla de
# agendas generadas (`_una_por_persona`); después la más reciente.
_PESO_CIERRE = {'venta': 2, 'sena': 1}


def _peso(fila):
    return (_PESO_CIERRE.get(fila['post_call']['key'], 0), fila['fecha'] or '', fila['id'])


def _fila_sin_cita(agendas, taller):
    """La fila de una persona que solo está en el libro de agendas, con el estado de la hoja."""
    agenda = max(agendas, key=lambda a: (a.date is not None, a.date))
    contacto = agenda.contacto()
    raw = agenda.raw_data or {}
    post = _POST_DE_LA_HOJA.get(metricas._bucket_estado(agenda.estado or 'Pendiente'), 'pendiente')
    closer = (agenda.closer or '').strip()
    return {
        'id': -agenda.id,   # negativo: no choca con el id de ninguna cita
        'tipo': 'agenda',
        'creada': agenda.created_at.isoformat() if agenda.created_at else None,
        'fecha': agenda.date.isoformat() if agenda.date else None,
        'cliente': contacto['lead'] or contacto['mail'] or 'Sin nombre',
        'ig': contacto['instagram'] or '',
        'email': contacto['mail'] or '',
        'telefono': contacto['whatsapp'] or '',
        'client_id': None,
        'person_uuid': agenda.person_uuid,
        'fuente': raw.get('fuente') or taller.name,
        'palabra_clave': '',
        'closer': closer if closer and closer.lower() != 'sin asignar' else 'Sin closer',
        'closer_id': None,
        'setter': '',
        'setter_id': None,
        'pre_call': chip('pre_call', 'sin_confirmar'),
        'post_call': chip('post_call', post),
        'estado_libro': post,
        'asistio': post in ASISTIO,
        'no_cerrada': post in ASISTIO,
        'realizada': post in REALIZADAS,
        'presento': False,
        'retraso_dias': 0,
        'ya_paso': bool(agenda.date),
        'descartada': post in DESCARTADAS,
        'con_venta': False,
        'venta_tipo': None,
        'con_sena': False,
        'sin_cita': True,
    }


def _personas_del_taller(taller, tz_nombre):
    """[(embudo, [FinancialAgenda de la persona])] del taller y su ventana, como las cuenta la métrica."""
    tz = metricas._tz(tz_nombre)
    desde, hasta, siguiente = metricas.ventana_evento(taller.date, tz)
    grupos = metricas._agendas_por_embudo(desde, hasta, tz)
    vistas = set()
    personas = [('vivo', p) for p in metricas._agrupar_por_persona(grupos['vivo'], vistas)]
    personas += [('landing', p) for p in metricas._agrupar_por_persona(grupos['landing'], vistas)]
    inicio, _ = metricas._limites_utc(desde, hasta, tz)
    ventana = {'desde': desde.strftime('%Y-%m-%d'), 'hasta': hasta.strftime('%Y-%m-%d'),
               'abierta': siguiente is None}
    return personas, inicio, ventana


def _filas_de(personas, inicio, taller):
    """Una fila por persona: su cita si la tiene (mismo día de la agenda), si no la hoja."""
    uuids = {a.person_uuid for _, ags in personas for a in ags if a.person_uuid}
    citas = []
    if uuids:
        citas = (Appointment.query
                 .options(joinedload(Appointment.client), joinedload(Appointment.closer),
                          joinedload(Appointment.setter))
                 .filter(Appointment.person_uuid.in_(uuids), Appointment.start_time >= inicio)
                 .all())
    por_cita = {f['id']: f for f in ComercialService.filas_de_citas(citas)}
    por_persona = {}
    for cita in citas:
        por_persona.setdefault(cita.person_uuid, []).append(cita)

    filas = []
    for embudo, agendas in personas:
        dias = {a.date.date() for a in agendas if a.date}
        propias = [c for a in agendas for c in por_persona.get(a.person_uuid, [])]
        propias = list({c.id: c for c in propias}.values())
        del_dia = [c for c in propias if c.start_time and c.start_time.date() in dias]
        # Sin cita ese día, la primera desde el taller: la persona reagendó o la llamada se corrió.
        elegidas = del_dia or sorted((c for c in propias if c.start_time), key=lambda c: c.start_time)[:1]
        if elegidas:
            fila = dict(max((por_cita[c.id] for c in elegidas), key=_peso))
        else:
            fila = _fila_sin_cita(agendas, taller)
        fila.update({'embudo': embudo, 'taller_id': taller.id, 'taller': taller.name,
                     'taller_fecha': taller.date.isoformat()})
        filas.append(fila)
    return filas


def agendas_de_talleres(talleres, tz_nombre='America/La_Paz'):
    """`{filas, total, talleres}` de los talleres pedidos (WorkshopEvent), de nuevo a viejo.

    `talleres[i].agendas` es lo que cuenta cada taller: la suma de las filas con su `taller_id`.
    """
    filas = []
    resumen = []
    for taller in talleres:
        personas, inicio, ventana = _personas_del_taller(taller, tz_nombre)
        propias = _filas_de(personas, inicio, taller)
        filas += propias
        resumen.append({'id': taller.id, 'name': taller.name, 'date': taller.date.isoformat(),
                        'agendas': len(propias),
                        'vivo': sum(1 for f in propias if f['embudo'] == 'vivo'),
                        'landing': sum(1 for f in propias if f['embudo'] == 'landing'),
                        'ventana': ventana})
    filas.sort(key=lambda f: (f['fecha'] or '', f['id']), reverse=True)
    return {'filas': filas, 'total': len(filas), 'talleres': resumen}


def talleres_por_ids(ids):
    """Los WorkshopEvent de esos ids, de nuevo a viejo. Los ids que no existen se ignoran."""
    if not ids:
        return []
    return (WorkshopEvent.query.filter(WorkshopEvent.id.in_(ids[:MAX_TALLERES]))
            .order_by(WorkshopEvent.date.desc()).all())
