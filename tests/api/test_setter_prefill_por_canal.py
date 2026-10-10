"""La precarga del reporte v2 viene partida por canal: anuncios e inbound.

Inbound es el anuncio ficticio con `keyword='Inbound'`: ManyChat manda esa palabra cuando el lead
escribe sin venir de un anuncio. La suma de los dos canales tiene que dar los números de "Mis
datos" del día (los mismos que la precarga del v1).
"""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Ad, AdSet, Appointment, Campaign, Client, LeadAnswer, ManychatLead
from app.services import comercial_analitica as ca

DIA = date(2026, 10, 10)
PREFILL = '/api/public/setter-report/prefill'


@pytest.fixture()
def equipo(make_user):
    return {'closer': make_user(role='closer', username='Marlon'),
            'elias': make_user(role='setter', username='Elias')}


@pytest.fixture()
def anuncio_inbound(db):
    campana = Campaign(name='Inbound')
    db.session.add(campana)
    db.session.commit()
    grupo = AdSet(campaign_id=campana.id, name='Inbound Grupo')
    db.session.add(grupo)
    db.session.commit()
    ad = Ad(ad_set_id=grupo.id, name='Inbound', keyword='Inbound', status='active')
    db.session.add(ad)
    db.session.commit()
    return ad


def lead(db, ig, *respuestas, keyword='CURSO GRATUITO', ad_id=None, cuando=datetime(2026, 10, 10, 12)):
    l = ManychatLead(manychat_id=f'mc-{ig}', name=ig, ig=ig, setter='Elias', created_at=cuando)
    db.session.add(l)
    db.session.commit()
    for valor in respuestas:
        db.session.add(LeadAnswer(lead_id=l.id, qualification=valor, keyword=keyword, ad_id=ad_id, created_at=cuando))
    db.session.commit()
    return l


def agenda(db, equipo, ig):
    cliente = Client(full_name=ig or 'Sin IG', email=f'{ig or "sinig"}@test.local', instagram=ig)
    db.session.add(cliente)
    db.session.commit()
    db.session.add(Appointment(closer_id=equipo['closer'].id, setter_id=equipo['elias'].id, client_id=cliente.id,
                               result='Confirmado', origin='Setter', created_at=datetime(2026, 10, 10, 15),
                               start_time=datetime(2026, 10, 12, 15)))
    db.session.commit()


@freeze_time('2026-10-10 20:00:00')
def test_la_precarga_parte_los_entrantes_y_las_agendas_por_canal(client, db, equipo, anuncio_inbound, auth_headers):
    # Anuncios: uno califica, uno contestó y no califica, uno no contestó nunca.
    lead(db, 'ana', 'true')
    lead(db, 'beto', 'false')
    lead(db, 'caro', 'null')
    # Inbound: uno por la palabra clave, otro por el anuncio ficticio.
    lead(db, 'dani', 'true', keyword='Inbound')
    lead(db, 'eli', 'null', keyword=None, ad_id=anuncio_inbound.id)
    # Un lead de ayer que vino de un anuncio y hoy agendó: su agenda es de anuncios.
    lead(db, 'fede', 'true', cuando=datetime(2026, 9, 20, 10))

    agenda(db, equipo, 'ana')       # anuncios
    agenda(db, equipo, '@Fede')     # anuncios (lead viejo, ig con arroba y mayúscula)
    agenda(db, equipo, 'dani')      # inbound
    agenda(db, equipo, 'gaby')      # sin lead de ManyChat: escribió por su cuenta, inbound

    elias = equipo['elias']
    datos = client.get(PREFILL, headers=auth_headers(elias),
                       query_string={'setter_id': elias.id, 'date': DIA.isoformat()}).get_json()

    assert datos['version'] == 2
    assert datos['anuncios'] == {'entrantes': 3, 'no_lead': 1, 'inabribles': 1, 'agendas': 2}
    assert datos['inbound'] == {'entrantes': 2, 'no_lead': 0, 'inabribles': 1, 'agendas': 2}

    # Los dos canales juntos son "Mis datos" del día.
    mis_datos = ca.bloque_setters(DIA, DIA, setter_id=elias.id, setter_nombre='Elias')
    entrantes = datos['anuncios']['entrantes'] + datos['inbound']['entrantes']
    cualificados = sum(c['entrantes'] - c['no_lead'] - c['inabribles'] for c in (datos['anuncios'], datos['inbound']))
    assert (entrantes, cualificados) == (mis_datos['leads'], mis_datos['cualificados'])
    assert datos['anuncios']['agendas'] + datos['inbound']['agendas'] == mis_datos['generadas']


@freeze_time('2026-10-10 20:00:00')
def test_sin_marca_de_inbound_todo_lo_de_manychat_es_de_anuncios(client, db, equipo, auth_headers):
    """Así está la base hasta hoy: ManyChat todavía no manda la palabra Inbound."""
    lead(db, 'ana', 'true')
    lead(db, 'beto', 'null')

    elias = equipo['elias']
    datos = client.get(PREFILL, headers=auth_headers(elias),
                       query_string={'setter_id': elias.id, 'date': DIA.isoformat()}).get_json()

    assert datos['anuncios']['entrantes'] == 2
    assert datos['inbound'] == {'entrantes': 0, 'no_lead': 0, 'inabribles': 0, 'agendas': 0}
