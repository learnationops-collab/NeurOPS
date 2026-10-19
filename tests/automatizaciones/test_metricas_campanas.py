"""Métricas por campaña: entradas, respuestas, calificación, agendas y gasto de Meta, sin mirar ManyChat."""
from datetime import date, timedelta

from app.automatizaciones import metricas_campanas
from app.automatizaciones.modelos import AutCampana, AutCampanaMeta, IgContacto
from app.models import Appointment, Client, ConversationalMessage, MetaAnuncio, MetaGastoDiario
from tests.automatizaciones.test_registro import T0, boton, campana, guia, lead  # noqa: F401  (fixtures)

URL = '/api/inbox'


def metricas(campana_id, desde=T0.date(), hasta=T0.date(), ahora=T0 + timedelta(days=1)):
    return metricas_campanas.de_campanas(desde, hasta, ahora)[campana_id]


def test_cuenta_entradas_respuestas_y_calificacion(guia, campana, lead):  # noqa: F811
    nueva = campana(['GUIA'], guia)
    lead.escribe('GUIA')
    lead.toca(boton(guia, 'opening', 'medico'), 'Médico', minutos=1)

    m = metricas(nueva.id)
    assert (m['entradas'], m['personas'], m['respondieron'], m['calificados'], m['descalificados']) == (1, 1, 1, 1, 0)


def test_quien_no_contesta_no_respondio_y_la_rama_descalifica(guia, campana, lead):  # noqa: F811
    nueva = campana(['GUIA'], guia)
    lead.escribe('GUIA')
    assert metricas(nueva.id)['respondieron'] == 0

    lead.toca(boton(guia, 'opening', 'estudiante'), 'Estudiante', minutos=1)
    assert (metricas(nueva.id)['respondieron'], metricas(nueva.id)['descalificados']) == (1, 1)


def test_la_agenda_va_a_la_entrada_de_su_tramo(guia, campana, lead, make_user, db):  # noqa: F811
    primera, segunda = campana(['GUIA'], guia), campana(['PDF'], guia, nombre='PDF')
    lead.escribe('GUIA')
    IgContacto.query.one().username = 'ana.mir'
    lead.escribe('PDF', minutos=60)  # otra campaña: entrada nueva, desde acá el tramo es de PDF
    cliente = Client(full_name='Ana Mir', instagram='@Ana.Mir')
    db.session.add(cliente)
    db.session.flush()
    db.session.add(Appointment(client_id=cliente.id, closer_id=make_user().id, created_at=T0 + timedelta(hours=2)))
    db.session.commit()

    assert (metricas(primera.id)['agendas'], metricas(segunda.id)['agendas']) == (0, 1)


def test_el_gasto_sale_de_sus_campanas_de_meta_dentro_de_la_vigencia(campana, guia, db):  # noqa: F811
    nueva = campana(['GUIA'], guia)
    nueva.campanas_meta.append(AutCampanaMeta(meta_campana_id='C1'))
    db.session.add_all([
        MetaAnuncio(meta_ad_id='A1', campana_id='C1', campana='Guía'),
        MetaAnuncio(meta_ad_id='A2', campana_id='C2', campana='Otra'),
        MetaGastoDiario(meta_ad_id='A1', fecha=T0.date(), gasto=10.0),
        MetaGastoDiario(meta_ad_id='A1', fecha=T0.date() - timedelta(days=5), gasto=99.0),  # antes de la vigencia
        MetaGastoDiario(meta_ad_id='A2', fecha=T0.date(), gasto=50.0),
    ])
    db.session.commit()

    m = metricas(nueva.id, desde=T0.date() - timedelta(days=10))
    assert m['gasto'] == 10.0
    assert m['costo_entrada'] is None  # sin entradas no hay costo por entrada


def test_la_api_lista_las_campanas_con_sus_metricas_y_el_catalogo(client, make_user, auth_headers, guia, campana, db):  # noqa: F811
    campana(['GUIA'], guia)
    cabeceras = auth_headers(make_user(role='director_comercial'))

    respuesta = client.get(f'{URL}/campanas', query_string={'desde': '2026-10-01', 'hasta': '2026-10-31'},
                           headers=cabeceras).get_json()
    assert respuesta['desde'] == '2026-10-01'
    assert respuesta['campanas'][0]['metricas']['entradas'] == 0
    assert client.get(f'{URL}/campanas', query_string={'desde': 'ayer'}, headers=cabeceras).status_code == 400

    db.session.add(ConversationalMessage(message_id='1', title='Opening'))
    db.session.commit()
    mensajes = client.get(f'{URL}/catalogo', headers=cabeceras).get_json()['mensajes']
    assert [(m['id'], m['titulo']) for m in mensajes] == [('1', 'Opening'), ('8', '¿Qué quiere mejorar?')]


def test_una_campana_sin_entradas_da_ceros(campana, guia):  # noqa: F811
    nueva = campana(['X'], guia)
    m = metricas_campanas.de_campanas(date(2026, 1, 1), date(2026, 1, 2), T0)[nueva.id]
    assert (m['entradas'], m['agendas'], m['gasto'], m['costo_agenda']) == (0, 0, 0.0, None)
    assert AutCampana.query.count() == 1
