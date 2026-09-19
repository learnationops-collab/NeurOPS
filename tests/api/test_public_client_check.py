"""POST /api/public/clients/check: la pagina publica de reservas pregunta si ya conoce al visitante.

Busca por email y, si no lo encuentra, por Instagram (con o sin arroba) para precargar el formulario a
quien ya reservo antes. La busqueda por Instagram usaba `or_` sin importarlo: el NameError daba un 500
cada vez que el visitante escribia su Instagram y no coincidia su email.

La ruta es anonima a proposito (la usa la pagina de reservas sin sesion). Que devuelva telefono y
respuestas de la encuesta de cualquier cliente conocido a quien acierte un email es un riesgo de
privacidad que se trata junto con el resto de la superficie anonima (ver test_anonymous_surface).
"""
import pytest

from app.models import Client, SurveyAnswer, SurveyQuestion

URL = '/api/public/clients/check'


@pytest.fixture()
def ana(db):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', phone='+58 412 0000000', instagram='ana.g')
    db.session.add(cliente)
    db.session.commit()
    return cliente


def consultar(client, **cuerpo):
    return client.post(URL, json=cuerpo)


def test_sin_email_ni_instagram_es_400(client):
    for cuerpo in ({}, {'email': '', 'instagram': ''}):
        respuesta = consultar(client, **cuerpo)

        assert respuesta.status_code == 400
        assert respuesta.get_json() == {'error': 'Email or Instagram required'}


def test_un_cliente_conocido_se_encuentra_por_email(client, ana):
    respuesta = consultar(client, email='ana@x.com')

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'exists': True, 'client': {
        'id': ana.id, 'full_name': 'Ana Gomez', 'phone': '+58 412 0000000', 'instagram': 'ana.g', 'survey_answers': {}}}


def test_un_desconocido_no_existe(client, ana):
    respuesta = consultar(client, email='nadie@x.com')

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'exists': False}


@pytest.mark.parametrize('escrito', ['ana.g', '@ana.g', '  @ana.g  '])
def test_se_encuentra_por_instagram_con_o_sin_arroba(client, ana, escrito):
    # Antes: NameError (or_ sin importar) y un 500 en cuanto no habia email que coincidiera.
    respuesta = consultar(client, instagram=escrito)

    assert respuesta.status_code == 200
    assert respuesta.get_json()['exists'] is True
    assert respuesta.get_json()['client']['id'] == ana.id


def test_el_instagram_guardado_con_arroba_tambien_coincide(client, db, ana):
    ana.instagram = '@ana.g'
    db.session.commit()

    assert consultar(client, instagram='ana.g').get_json()['exists'] is True
    assert consultar(client, instagram='@ana.g').get_json()['exists'] is True


def test_si_el_email_no_coincide_se_prueba_con_el_instagram(client, ana):
    respuesta = consultar(client, email='otro-correo@x.com', instagram='@ana.g')

    assert respuesta.get_json()['exists'] is True
    assert respuesta.get_json()['client']['id'] == ana.id


def test_el_email_manda_sobre_el_instagram(client, db, ana):
    otra = Client(full_name='Otra Persona', email='otra@x.com', instagram='otra.p')
    db.session.add(otra)
    db.session.commit()

    respuesta = consultar(client, email='otra@x.com', instagram='ana.g')

    assert respuesta.get_json()['client']['id'] == otra.id


def test_un_instagram_desconocido_no_existe(client, ana):
    assert consultar(client, instagram='@nadie').get_json() == {'exists': False}


def test_devuelve_las_respuestas_de_la_encuesta_por_pregunta(client, db, ana):
    pregunta = SurveyQuestion(text='Cual es tu meta?')
    db.session.add(pregunta)
    db.session.commit()
    db.session.add(SurveyAnswer(client_id=ana.id, question_id=pregunta.id, answer='Vender mas'))
    db.session.commit()

    respuesta = consultar(client, email='ana@x.com')

    assert respuesta.get_json()['client']['survey_answers'] == {str(pregunta.id): 'Vender mas'}
