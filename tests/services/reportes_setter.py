"""Reportes diarios y agendas generadas de un setter, para los tests del tablero de setters.

Lo comparten los tests de `setter_analitica` (el bloque) y los de Comparativas, el resumen y
Variabilidad, que miran las mismas cuentas desde otro lado.
"""
import itertools
from datetime import date, datetime, timedelta

from app.models import Appointment, Client, SetterDailyStats
from app.services import setter_reporte_v2 as rv2

SEPT = (date(2026, 9, 1), date(2026, 9, 30))
AGOSTO = (date(2026, 8, 1), date(2026, 8, 31))
_mails = itertools.count(1)


def v2(db, setter, dia, *, ads=(0, 0, 0, 0, 0, 0), inb=(0, 0, 0, 0, 0, 0), bnv=(0, 0, 0),
       embudo=(0, 0, 0), fu=(0, 0, 0, 0), fur=(0, 0, 0, 0), win='', no_laborable=False):
    """Un reporte v2. `ads`/`inb`: (entrantes, no_lead, inabribles, ap_entrantes, ap_dolor, agendas);
    `fu`/`fur`: los follow-ups y cuántos respondieron, por etapa (entrantes, dolor, oferta, link)."""
    datos = rv2.vacio()
    for canal, valores in (('anuncios', ads), ('inbound', inb)):
        datos[canal].update(dict(zip(rv2.CAMPOS_CANAL, valores)))
    datos['bienvenidas'].update(dict(zip(('hechas', 'respondidas', 'aperturas'), bnv)))
    datos['embudo'].update(dict(zip(('dolor', 'oferta', 'link'), embudo)))
    datos['followups'].update(dict(zip(('entrantes', 'dolor', 'oferta', 'link'), fu)))
    datos['followups_respondidos'] = dict(zip(('entrantes', 'dolor', 'oferta', 'link'), fur))
    datos['reflexion']['win_del_dia'] = win
    stat = rv2.escribir(SetterDailyStats(setter_id=setter.id, date=dia), datos)
    stat.is_non_working_day = no_laborable
    db.session.add(stat)
    db.session.commit()
    return stat


def v1(db, setter, dia, *, entrantes=0, no_lead=0, inabribles=0, respondieron=0, dolor=0,
       oferta=0, link=0, agenda=0, win=None):
    """Un reporte como los de antes del 10/10/2026: solo totales, sin canales ni bienvenidas."""
    stat = SetterDailyStats(
        setter_id=setter.id, date=dia, inbox_entrantes=entrantes, not_lead=no_lead,
        inbox_inabribles=inabribles, funnel_qualification=respondieron, funnel_pain=dolor,
        funnel_offer=oferta, funnel_link=link, funnel_agenda=agenda,
        reflections={'daily_reflection': 'algo', 'win_of_day': win} if win is not None else None)
    db.session.add(stat)
    db.session.commit()
    return stat


def generada(db, setter, closer, *, creada=datetime(2026, 9, 10, 15), reunion=None,
             closer_result='Pendiente', result='Confirmado'):
    """Una agenda que generó el setter, con el resultado que le haya puesto el closer."""
    cli = Client(full_name=f'Lead {next(_mails)}', email=f'lead{next(_mails)}@test.local')
    db.session.add(cli)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cli.id, setter_id=setter.id, origin='Setter',
                    start_time=reunion or creada + timedelta(days=2), created_at=creada,
                    result=result, closer_result=closer_result)
    db.session.add(a)
    db.session.commit()
    return a
