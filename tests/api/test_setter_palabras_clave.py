"""«Mis agendas»: la bandeja de palabras clave del setter (pedido de Kerwin, 10/10/2026).

"Estas agendas son las que llegaron con fuente de ese setter, y los setters deben agregar la palabra
clave del anuncio por el que llegó el lead [...] 'Mis agendas' debe vaciarse."

Lo que se fija acá:

  1. Qué agendas entran: las del setter con la regla de sus números (`es_agenda_del_setter`), una
     por persona, desde julio de 2026, y solo las que Marketing todavía no atribuye a un anuncio.
  2. Asignar deja la agenda atribuida PARA MARKETING (se comprueba con su propio cálculo), también
     la agenda vieja de quien reagendó, y sale de la bandeja.
  3. Quién puede: solo el setter de la agenda; el Instagram hace falta porque es la llave.
  4. El juego: cuántas asignó hoy y la racha de días con la bandeja vacía, reconstruida sin
     inventar días.
"""
import itertools
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import (Ad, AdSet, Appointment, Campaign, Client, LeadAnswer, LeadEventLog,
                        ManychatLead)
from app.models.financial import FinancialAgenda
from app.services import palabra_clave_service as servicio
from app.services.comercial_service import ComercialService

URL = '/api/setter/palabras-clave'
HOY = '2026-10-10 15:00:00'  # 11:00 en La Paz

_n = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'marlon': make_user(role='closer', username='Marlon'),
        'elias': make_user(role='setter', username='Elias', timezone='America/La_Paz'),
        'paula': make_user(role='setter', username='Paula', timezone='America/La_Paz'),
    }


@pytest.fixture()
def anuncios(db):
    campana = Campaign(name='Captación')
    db.session.add(campana)
    db.session.flush()
    conjunto = AdSet(campaign_id=campana.id, name='Frío')
    db.session.add(conjunto)
    db.session.flush()
    salida = {}
    for keyword, estado, creado in [('GUIA', 'active', datetime(2026, 7, 31)),
                                    ('PROTOCOLO', 'active', datetime(2026, 7, 27)),
                                    ('VIEJO', 'paused', datetime(2026, 8, 30))]:
        ad = Ad(ad_set_id=conjunto.id, name=keyword, keyword=keyword, status=estado, created_at=creado)
        db.session.add(ad)
        salida[keyword] = ad
    db.session.commit()
    return salida


def cliente(db, nombre, ig=None):
    c = Client(full_name=nombre, email=f'lead{next(_n)}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, equipo, cli, setter='elias', creada=datetime(2026, 10, 8, 14), reunion=datetime(2026, 10, 12, 14),
           result='Confirmado', espejo=True):
    fuente = setter.capitalize() if setter else 'workshop'
    a = Appointment(closer_id=equipo['marlon'].id, client_id=cli.id, start_time=reunion, created_at=creada,
                    result=result, closer_result='Pendiente', origin=fuente,
                    setter_id=equipo[setter].id if setter else None)
    db.session.add(a)
    if espejo:
        # La fila del Tablero: es la que Marketing cuenta.
        db.session.add(FinancialAgenda(nombre=fuente, lead=cli.full_name,
                                       mail=cli.email, instagram=cli.instagram, date=reunion, created_at=creada))
    db.session.commit()
    return a


def conversacion(db, ig, ad=None, cuando=datetime(2026, 10, 7, 10)):
    """La conversación de ManyChat del lead, con una respuesta (con o sin anuncio)."""
    lead = ManychatLead(manychat_id=f'mc_{next(_n)}', name=ig, ig=ig)
    db.session.add(lead)
    db.session.flush()
    db.session.add(LeadAnswer(lead_id=lead.id, ad_id=ad.id if ad else None, keyword='Obtener Guia',
                              created_at=cuando))
    db.session.commit()
    return lead


def bandeja(client, user, auth_headers):
    r = client.get(URL, headers=auth_headers(user))
    assert r.status_code == 200, r.get_json()
    return r.get_json()


def asignar(client, user, auth_headers, appt, ad, **extra):
    return client.post(URL, headers=auth_headers(user), json={'appointment_id': appt.id, 'ad_id': ad.id, **extra})


def agendas_de_marketing(ad):
    from app.services.marketing_service import MarketingService
    filas = MarketingService.get_ad_performance_data(None, '2026-10-01', '2026-10-31')
    return {f['ad_id']: f['agendas'] for f in filas}.get(ad.id, 0)


# --- 1. Qué agendas entran ------------------------------------------------------------------------

@freeze_time(HOY)
def test_la_bandeja_son_sus_agendas_sin_anuncio_una_por_persona(client, db, equipo, anuncios, auth_headers):
    ana = cliente(db, 'Ana', 'ana.ig')
    agenda(db, equipo, ana)
    # Beto ya llegó por un anuncio que Marketing ve (respuesta antes de la reunión): no entra.
    beto = cliente(db, 'Beto', 'beto')
    agenda(db, equipo, beto)
    conversacion(db, 'beto', anuncios['GUIA'])
    # Caro respondió a un anuncio, pero DESPUÉS de la reunión: Marketing no la cuenta, entra.
    caro = cliente(db, 'Caro', '@Caro')
    agenda(db, equipo, caro, creada=datetime(2026, 10, 7, 14), reunion=datetime(2026, 10, 9, 14))
    conversacion(db, 'caro', anuncios['GUIA'], cuando=datetime(2026, 10, 9, 20))
    # Dani reagendó: dos agendas, una persona.
    dani = cliente(db, 'Dani', 'dani')
    agenda(db, equipo, dani, creada=datetime(2026, 10, 1, 9), reunion=datetime(2026, 10, 3, 14))
    agenda(db, equipo, dani, creada=datetime(2026, 10, 4, 9), reunion=datetime(2026, 10, 6, 14))
    # Lo que no es suyo: de Paula, sin setter, el marcador de cualificar y lo de antes de julio.
    agenda(db, equipo, cliente(db, 'Eli', 'eli'), setter='paula')
    agenda(db, equipo, cliente(db, 'Fede', 'fede'), setter=None)
    agenda(db, equipo, cliente(db, 'Gabi', 'gabi'), result='Cualificado', espejo=False)
    agenda(db, equipo, cliente(db, 'Hugo', 'hugo'), creada=datetime(2026, 6, 20), reunion=datetime(2026, 6, 25))

    datos = bandeja(client, equipo['elias'], auth_headers)

    assert [p['cliente'] for p in datos['pendientes']] == ['Ana', 'Caro', 'Dani']
    assert datos['resumen'] == {'pendientes': 3, 'hoy': 0, 'racha': 0}
    ana_fila = datos['pendientes'][0]
    assert ana_fila['instagram'] == 'ana.ig'
    assert ana_fila['closer'] == 'Marlon'
    assert ana_fila['reunion'] == '2026-10-12T14:00:00'
    assert ana_fila['estado']['label']
    # Dani: la de la reunión más reciente, como "Agendas generadas".
    assert datos['pendientes'][2]['reunion'] == '2026-10-06T14:00:00'


@freeze_time(HOY)
def test_el_dock_puede_pedir_solo_el_resumen(client, db, equipo, anuncios, auth_headers):
    agenda(db, equipo, cliente(db, 'Ana', 'ana'))

    r = client.get(URL, headers=auth_headers(equipo['elias']), query_string={'solo': 'resumen'})

    assert r.get_json() == {'resumen': {'pendientes': 1, 'hoy': 0, 'racha': 0}}


@freeze_time(HOY)
def test_la_bandeja_y_agendas_generadas_son_las_mismas_filas(db, equipo, anuncios):
    """La misma regla que sus números: lo pendiente más lo atribuido es "Agendas generadas"."""
    for nombre in ('Ana', 'Beto', 'Caro'):
        agenda(db, equipo, cliente(db, nombre, nombre.lower()))
    conversacion(db, 'beto', anuncios['GUIA'])
    agenda(db, equipo, cliente(db, 'Gabi', 'gabi'), result='Cualificado', espejo=False)

    generadas = ComercialService.generadas(date(2026, 7, 1), date(2026, 10, 10), setter_id=equipo['elias'].id)
    pendientes, filas, anuncio = servicio._bandeja(equipo['elias'])

    assert {f['id'] for f in filas} == {f['id'] for f in generadas}
    assert len(pendientes) + len(anuncio) == len(generadas) == 3


@freeze_time(HOY)
def test_los_anuncios_van_activos_primero_y_despues_los_que_mas_usa(client, db, equipo, anuncios, auth_headers):
    for nombre in ('Ana', 'Beto'):
        agenda(db, equipo, cliente(db, nombre, nombre.lower()))
        conversacion(db, nombre.lower(), anuncios['PROTOCOLO'])

    datos = bandeja(client, equipo['elias'], auth_headers)

    assert [(a['keyword'], a['activo'], a['usos']) for a in datos['anuncios']] == [
        ('PROTOCOLO', True, 2), ('GUIA', True, 0), ('VIEJO', False, 0)]


# --- 2. Asignar ---------------------------------------------------------------------------------

@freeze_time(HOY)
def test_asignar_la_deja_atribuida_para_marketing_y_sale_de_la_bandeja(client, db, equipo, anuncios, auth_headers):
    ana = cliente(db, 'Ana', 'ana.ig')
    appt = agenda(db, equipo, ana)
    agenda(db, equipo, cliente(db, 'Beto', 'beto'))
    assert agendas_de_marketing(anuncios['GUIA']) == 0

    r = asignar(client, equipo['elias'], auth_headers, appt, anuncios['GUIA'])

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['resumen'] == {'pendientes': 1, 'hoy': 1, 'racha': 0}
    assert agendas_de_marketing(anuncios['GUIA']) == 1
    assert [p['cliente'] for p in bandeja(client, equipo['elias'], auth_headers)['pendientes']] == ['Beto']
    # Lo mismo que dejaba la atribución manual: la conversación con el nombre del LEAD (no el de
    # la fuente), la palabra clave en la cita y el registro en el historial del lead.
    lead = ManychatLead.query.filter_by(ig='@ana.ig').one()
    assert lead.name == 'Ana'
    assert db.session.get(Appointment, appt.id).keyword == 'GUIA'
    evento = LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='palabra_clave').one()
    assert evento.user_id == equipo['elias'].id
    assert 'GUIA' in evento.description


@freeze_time(HOY)
def test_quien_reagendo_queda_atribuido_en_sus_dos_agendas(client, db, equipo, anuncios, auth_headers):
    """La respuesta va antes de la PRIMERA agenda: si fuera un minuto antes de la última, la vieja
    quedaba sin anuncio en Marketing."""
    dani = cliente(db, 'Dani', 'dani')
    agenda(db, equipo, dani, creada=datetime(2026, 10, 1, 9), reunion=datetime(2026, 10, 3, 14))
    nueva = agenda(db, equipo, dani, creada=datetime(2026, 10, 4, 9), reunion=datetime(2026, 10, 6, 14))

    assert asignar(client, equipo['elias'], auth_headers, nueva, anuncios['GUIA']).status_code == 200

    assert agendas_de_marketing(anuncios['GUIA']) == 2
    respuesta = LeadAnswer.query.filter(LeadAnswer.ad_id == anuncios['GUIA'].id).one()
    assert respuesta.created_at < datetime(2026, 10, 1, 9)


@freeze_time(HOY)
def test_la_respuesta_real_sin_anuncio_es_la_que_recibe_el_anuncio(client, db, equipo, anuncios, auth_headers):
    """Llegó por ManyChat y no se supo de qué anuncio: se completa esa respuesta, no se inventa otra."""
    appt = agenda(db, equipo, cliente(db, 'Ana', 'ana'))
    lead = conversacion(db, 'ana', ad=None, cuando=datetime(2026, 10, 7, 10))

    assert asignar(client, equipo['elias'], auth_headers, appt, anuncios['PROTOCOLO']).status_code == 200

    respuestas = LeadAnswer.query.filter_by(lead_id=lead.id).all()
    assert [(r.ad_id, r.created_at) for r in respuestas] == [(anuncios['PROTOCOLO'].id, datetime(2026, 10, 7, 10))]


@freeze_time(HOY)
def test_el_instagram_nuevo_se_corrige_en_el_cliente_y_en_el_tablero(client, db, equipo, anuncios, auth_headers):
    ana = cliente(db, 'Ana', None)
    appt = agenda(db, equipo, ana)

    r = asignar(client, equipo['elias'], auth_headers, appt, anuncios['GUIA'], instagram='@Ana.Real ')

    assert r.status_code == 200, r.get_json()
    assert db.session.get(Client, ana.id).instagram == 'ana.real'
    assert FinancialAgenda.query.filter_by(lead='Ana').one().instagram == '@ana.real'
    assert agendas_de_marketing(anuncios['GUIA']) == 1


# --- 3. Quién puede y qué hace falta -------------------------------------------------------------

@freeze_time(HOY)
def test_sin_instagram_no_hay_atribucion_posible(client, db, equipo, anuncios, auth_headers):
    appt = agenda(db, equipo, cliente(db, 'Ana', None))

    r = asignar(client, equipo['elias'], auth_headers, appt, anuncios['GUIA'])

    assert r.status_code == 400
    assert 'Instagram' in r.get_json()['error']
    assert LeadAnswer.query.count() == 0
    assert asignar(client, equipo['elias'], auth_headers, appt, anuncios['GUIA'],
                   instagram='https://instagram.com/x').status_code == 400


@freeze_time(HOY)
def test_no_se_puede_asignar_la_agenda_de_otro_ni_un_anuncio_que_no_existe(client, db, equipo, anuncios,
                                                                           auth_headers):
    de_paula = agenda(db, equipo, cliente(db, 'Eli', 'eli'), setter='paula')
    mia = agenda(db, equipo, cliente(db, 'Ana', 'ana'))

    assert asignar(client, equipo['elias'], auth_headers, de_paula, anuncios['GUIA']).status_code == 403
    r = client.post(URL, headers=auth_headers(equipo['elias']), json={'appointment_id': mia.id, 'ad_id': 999})
    assert r.status_code == 404
    r = client.post(URL, headers=auth_headers(equipo['elias']), json={'appointment_id': 'x'})
    assert r.status_code == 400
    assert asignar(client, equipo['marlon'], auth_headers, mia, anuncios['GUIA']).status_code == 403
    assert LeadEventLog.query.count() == 0


# --- 4. El juego --------------------------------------------------------------------------------

def test_la_racha_cuenta_los_dias_que_terminaron_con_la_bandeja_vacia(client, db, equipo, anuncios, auth_headers):
    elias = equipo['elias']
    with freeze_time('2026-10-07 15:00:00'):
        primera = agenda(db, equipo, cliente(db, 'Ana', 'ana'), creada=datetime(2026, 10, 7, 13))
        # Antes de la primera asignación no hay racha: la bandeja todavía no existía.
        assert bandeja(client, elias, auth_headers)['resumen']['racha'] == 0
        assert asignar(client, elias, auth_headers, primera, anuncios['GUIA']).get_json()['resumen'] == \
            {'pendientes': 0, 'hoy': 1, 'racha': 1}

    with freeze_time('2026-10-08 15:00:00'):
        # Un día sin agendas nuevas: la bandeja sigue vacía y la racha sube.
        assert bandeja(client, elias, auth_headers)['resumen'] == {'pendientes': 0, 'hoy': 0, 'racha': 2}
        # Llega una y todavía no la asignó: hoy sigue en juego, la racha es la de ayer.
        nueva = agenda(db, equipo, cliente(db, 'Beto', 'beto'), creada=datetime(2026, 10, 8, 14))
        assert bandeja(client, elias, auth_headers)['resumen'] == {'pendientes': 1, 'hoy': 0, 'racha': 1}

    with freeze_time('2026-10-09 15:00:00'):
        # El 8 cerró con una pendiente: la racha se cortó.
        assert bandeja(client, elias, auth_headers)['resumen']['racha'] == 0
        r = asignar(client, elias, auth_headers, nueva, anuncios['GUIA'])
        assert r.get_json()['resumen'] == {'pendientes': 0, 'hoy': 1, 'racha': 1}


def test_las_de_hoy_se_cuentan_en_el_dia_del_setter(client, db, equipo, anuncios, auth_headers):
    """A las 22:00 de La Paz ya es mañana en UTC: lo de esa noche sigue siendo de hoy."""
    elias = equipo['elias']
    with freeze_time('2026-10-10 02:00:00'):  # 9/10 22:00 en La Paz
        appt = agenda(db, equipo, cliente(db, 'Ana', 'ana'), creada=datetime(2026, 10, 9, 20))
        asignar(client, elias, auth_headers, appt, anuncios['GUIA'])
    with freeze_time('2026-10-10 03:30:00'):  # 9/10 23:30 en La Paz
        assert bandeja(client, elias, auth_headers)['resumen']['hoy'] == 1
    with freeze_time('2026-10-10 05:00:00'):  # 10/10 01:00 en La Paz
        assert bandeja(client, elias, auth_headers)['resumen']['hoy'] == 0
