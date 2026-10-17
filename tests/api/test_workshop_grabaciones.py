"""La grabación de Drive de cada taller y su carga masiva por CSV (17/10/2026).

Pedido de Kerwin: tener el link del Meet grabado de cada taller pasado, aparte del Loom de la
landing. Claude in Chrome recorre Drive y arma un CSV; el panel lo pega, muestra la vista previa
y recién después guarda.
"""
from datetime import date

import pytest

from app.models import WorkshopEvent
from app.services.workshop_grabaciones_service import UrlInvalida, normalizar_url

URL = '/api/workshop/events/grabaciones'
DRIVE = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=drive_link'
LIMPIO = 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view'


@pytest.fixture()
def director(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing'))


def taller(db, dia, grabacion=None):
    evento = WorkshopEvent(date=dia, name=f'WEBINAR {dia.isoformat()}', grabacion_url=grabacion)
    db.session.add(evento)
    db.session.commit()
    return evento


@pytest.mark.parametrize('crudo, esperado', [
    (DRIVE, LIMPIO),
    ('https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp', LIMPIO),
    ('drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview', LIMPIO),
    ('https://drive.google.com/drive/folders/1Carpeta123456', 'https://drive.google.com/drive/folders/1Carpeta123456'),
    ('  ', None),
])
def test_el_link_de_drive_queda_como_el_del_archivo(crudo, esperado):
    assert normalizar_url(crudo) == esperado


@pytest.mark.parametrize('crudo', ['https://www.loom.com/share/abc', 'javascript:alert(1)', 'https://evil.com/drive.google.com'])
def test_un_link_que_no_es_de_drive_se_rechaza(crudo):
    with pytest.raises(UrlInvalida):
        normalizar_url(crudo)


def test_el_put_del_taller_guarda_la_grabacion_sin_tocar_el_loom(client, db, director):
    evento = taller(db, date(2026, 10, 12))
    evento.replay_loom_id = 'loom-de-la-landing'
    db.session.commit()

    respuesta = client.put(f'/api/workshop/events/{evento.id}', json={'grabacion_url': DRIVE}, headers=director)

    assert respuesta.status_code == 200
    assert respuesta.get_json()['grabacion_url'] == LIMPIO
    assert respuesta.get_json()['replay_loom_id'] == 'loom-de-la-landing'


def test_el_put_rechaza_un_link_que_no_es_de_drive(client, db, director):
    evento = taller(db, date(2026, 10, 12))

    respuesta = client.put(f'/api/workshop/events/{evento.id}', json={'grabacion_url': 'https://otro.com/x'}, headers=director)

    assert respuesta.status_code == 400
    assert db.session.get(WorkshopEvent, evento.id).grabacion_url is None


def test_la_vista_previa_no_guarda_nada(client, db, director):
    evento = taller(db, date(2026, 10, 12))
    csv = f'event_id,fecha,nombre,link_drive\n{evento.id},2026-10-12,Clase grupal para médicos,{DRIVE}\n'

    datos = client.post(URL, json={'csv': csv}, headers=director).get_json()

    assert datos['guardado'] is False
    assert datos['filas'][0]['estado'] == 'nueva'
    assert db.session.get(WorkshopEvent, evento.id).grabacion_url is None


def test_guardar_carga_por_id_y_por_fecha_y_cuenta_cada_estado(client, db, director):
    por_id = taller(db, date(2026, 10, 12))
    por_fecha = taller(db, date(2026, 10, 5))
    ya_tenia = taller(db, date(2026, 9, 28), grabacion='https://drive.google.com/file/d/1Otraaaaaaaaaa/view')
    sin_link = taller(db, date(2026, 9, 21))
    csv = (
        'event_id;fecha;link_drive;notas\n'
        f'{por_id.id};;{DRIVE};\n'
        ';05/10/2026;https://drive.google.com/file/d/1Segundoooooo/view;\n'
        f'{ya_tenia.id};2026-09-28;{DRIVE};\n'
        f'{sin_link.id};2026-09-21;;SIN GRABACIÓN\n'
        '9999;;https://drive.google.com/file/d/1Nadieeeeeeee/view;\n'
    )

    datos = client.post(URL, json={'csv': csv, 'simular': False}, headers=director).get_json()

    assert [f['estado'] for f in datos['filas']] == ['nueva', 'nueva', 'ya_tenia', 'sin_link', 'error']
    assert datos['resumen'] == {'nueva': 2, 'ya_tenia': 1, 'sin_link': 1, 'error': 1}
    assert db.session.get(WorkshopEvent, por_id.id).grabacion_url == LIMPIO
    assert db.session.get(WorkshopEvent, por_fecha.id).grabacion_url.endswith('1Segundoooooo/view')
    assert db.session.get(WorkshopEvent, ya_tenia.id).grabacion_url.endswith('1Otraaaaaaaaaa/view')


def test_sobrescribir_reemplaza_la_que_ya_tenia(client, db, director):
    evento = taller(db, date(2026, 9, 28), grabacion='https://drive.google.com/file/d/1Otraaaaaaaaaa/view')
    csv = f'event_id,link_drive\n{evento.id},{DRIVE}\n'

    datos = client.post(URL, json={'csv': csv, 'simular': False, 'sobrescribir': True}, headers=director).get_json()

    assert datos['filas'][0]['estado'] == 'reemplaza'
    assert db.session.get(WorkshopEvent, evento.id).grabacion_url == LIMPIO


def test_el_id_y_la_fecha_tienen_que_coincidir_y_un_taller_no_se_repite(client, db, director):
    evento = taller(db, date(2026, 10, 12))
    csv = (
        'event_id,fecha,link_drive\n'
        f'{evento.id},2026-10-13,{DRIVE}\n'
        f'{evento.id},2026-10-12,{DRIVE}\n'
        f'{evento.id},2026-10-12,{DRIVE}\n'
    )

    filas = client.post(URL, json={'csv': csv}, headers=director).get_json()['filas']

    assert [f['estado'] for f in filas] == ['error', 'nueva', 'error']
    assert 'no del 2026-10-13' in filas[0]['motivo']
    assert filas[2]['motivo'] == 'El taller ya vino en otra fila'


def test_acepta_el_csv_dentro_de_un_bloque_de_codigo(client, db, director):
    evento = taller(db, date(2026, 10, 12))
    csv = f'```csv\nevent_id,link_drive\n{evento.id},{DRIVE}\n```'

    assert client.post(URL, json={'csv': csv}, headers=director).get_json()['resumen'] == {'nueva': 1}


def test_sin_la_columna_del_link_es_un_error_claro(client, db, director):
    respuesta = client.post(URL, json={'csv': 'event_id,fecha\n1,2026-10-12\n'}, headers=director)

    assert respuesta.status_code == 400
    assert respuesta.get_json()['error'] == 'Falta la columna link_drive'


def test_un_closer_no_puede_cargar_grabaciones(client, db, make_user, auth_headers):
    respuesta = client.post(URL, json={'csv': 'event_id,link_drive\n'}, headers=auth_headers(make_user(role='closer')))

    assert respuesta.status_code in (401, 403)
