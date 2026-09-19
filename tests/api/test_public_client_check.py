"""POST /api/public/clients/check: la pagina publica de reservas pregunta si ya conoce al visitante.

Busca por email y, si no lo encuentra, por Instagram (con o sin arroba) para precargar el formulario a
quien ya reservo antes. La busqueda por Instagram usaba `or_` sin importarlo: el NameError daba un 500
cada vez que el visitante escribia su Instagram y no coincidia su email.

La ruta es anonima a proposito (la usa la pagina de reservas sin sesion). A un anonimo se le devuelven
solo los datos que la pagina usa para precargar el formulario (id, nombre, telefono e Instagram); las
respuestas de la encuesta, que la pagina no usa, solo van a un usuario logueado o a un sistema con el
secreto de ingesta (n8n, Apps Script). Que telefono y nombre se devuelvan a quien acierte un email o un
Instagram sigue siendo un riesgo de privacidad que exige rehacer la experiencia de la reserva (verificar
al visitante); queda como decision pendiente.
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
        'id': ana.id, 'full_name': 'Ana Gomez', 'phone': '+58 412 0000000', 'instagram': 'ana.g'}}


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


@pytest.fixture()
def respuesta_de_ana(db, ana):
    pregunta = SurveyQuestion(text='Cual es tu meta?')
    db.session.add(pregunta)
    db.session.commit()
    db.session.add(SurveyAnswer(client_id=ana.id, question_id=pregunta.id, answer='Vender mas'))
    db.session.commit()
    return pregunta


def test_un_anonimo_no_recibe_las_respuestas_de_la_encuesta(client, respuesta_de_ana):
    # La pagina de reservas es publica y ni usa las respuestas: no se le entregan a cualquiera que acierte un email.
    respuesta = consultar(client, email='ana@x.com')

    assert 'survey_answers' not in respuesta.get_json()['client']
    assert 'Vender mas' not in respuesta.get_data(as_text=True)


def test_un_usuario_logueado_recibe_las_respuestas_de_la_encuesta_por_pregunta(
        client, respuesta_de_ana, make_user, auth_headers):
    respuesta = client.post(URL, json={'email': 'ana@x.com'}, headers=auth_headers(make_user(role='closer')))

    assert respuesta.get_json()['client']['survey_answers'] == {str(respuesta_de_ana.id): 'Vender mas'}


def test_un_sistema_con_el_secreto_de_ingesta_recibe_las_respuestas(client, respuesta_de_ana, monkeypatch):
    monkeypatch.setenv('INGEST_API_TOKEN', 'secreto-de-ingesta-de-prueba-con-mas-de-veinte-caracteres')

    respuesta = client.post(URL, json={'email': 'ana@x.com'},
                            headers={'X-Api-Token': 'secreto-de-ingesta-de-prueba-con-mas-de-veinte-caracteres'})

    assert respuesta.get_json()['client']['survey_answers'] == {str(respuesta_de_ana.id): 'Vender mas'}


def test_un_secreto_equivocado_se_trata_como_anonimo(client, respuesta_de_ana, monkeypatch):
    monkeypatch.setenv('INGEST_API_TOKEN', 'secreto-de-ingesta-de-prueba-con-mas-de-veinte-caracteres')

    respuesta = client.post(URL, json={'email': 'ana@x.com'}, headers={'X-Api-Token': 'mal'})

    assert respuesta.status_code == 200
    assert 'survey_answers' not in respuesta.get_json()['client']
