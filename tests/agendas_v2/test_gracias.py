"""Páginas de gracias de Agendas 2.0: el recurso de Thalamus, la subida de videos al volumen por partes,
cómo se sirven (de a un pedazo) y los casos de éxito de la Academia en la página pública.
"""

import pytest

from app.agendas_v2 import api_publico, servicio, videos
from app.agendas_v2.nucleo.eventos import config_de
from app.agendas_v2.nucleo.normalizar import normal_gracias
from app.services.learnation_service import LearnationAPIError, LearnationService

URL = '/api/agendas-v2'
PUB = URL + '/publico'
CASO = {
    'id': 1,
    'name': 'Dra. Angela Luza',
    'meta': 'Medicina Física · ENARM',
    'summary': 'De reprobar a pasar',
    'quote': 'Las técnicas me volaron la cabeza.',
    'photo_url': 'https://academy.thelearnation.com/storage/a.jpg',
    'video_url': None,
}


@pytest.fixture(autouse=True)
def _limpio(monkeypatch, tmp_path):
    api_publico._pedidos.clear()
    servicio._casos.update({'en': 0.0, 'lista': []})
    monkeypatch.setenv('AGENDAS_VIDEOS_DIR', str(tmp_path / 'videos'))
    monkeypatch.setattr(
        LearnationService, 'get_success_cases', staticmethod(lambda: {'success': True, 'cases': [CASO]})
    )
    yield
    api_publico._pedidos.clear()


@pytest.fixture()
def dir_h(make_user, auth_headers):
    return auth_headers(make_user(role='director_comercial', email='dir@neuro.com'))


def _subir(client, h, contenido, tipo='video/mp4', parte=4):
    r = client.post(URL + '/videos', json={'nombre': 'gracias.mp4', 'tamano': len(contenido), 'tipo': tipo}, headers=h)
    assert r.status_code == 201
    vid = r.get_json()['video']['id']
    for desde in range(0, len(contenido), parte):
        r = client.put(
            f'{URL}/videos/{vid}?desde={desde}',
            data=contenido[desde : desde + parte],
            headers=h,
            content_type='application/octet-stream',
        )
        assert r.status_code == 200
    assert r.get_json()['video']['listo'] is True
    return vid


def test_normal_gracias_corrige_lo_que_no_vale():
    g = normal_gracias(
        'g', {'video': {'archivo': '../../etc/passwd', 'url': 'http://inseguro.com'}, 'segundos': 999, 'basura': 1}
    )
    assert g == {
        'id': 'g',
        'nombre': 'Sin nombre',
        'video': {'archivo': '', 'nombre': '', 'url': ''},
        'plan': {'archivo': '', 'nombre': '', 'url': ''},
        'segundos': 60,
        'casos': True,
        'orden': 0,
    }


def test_un_closer_no_sube_videos(client, make_user, auth_headers):
    h = auth_headers(make_user(role='closer'))
    assert (
        client.post(URL + '/videos', json={'nombre': 'x', 'tamano': 10, 'tipo': 'video/mp4'}, headers=h).status_code
        == 403
    )


def test_subida_por_partes_y_se_sirve_de_a_un_pedazo(client, dir_h, monkeypatch):
    contenido = bytes(range(10))
    vid = _subir(client, dir_h, contenido)

    monkeypatch.setattr(videos, 'SERVIR_MAX', 4)
    r = client.get(f'{PUB}/videos/{vid}', headers={'Range': 'bytes=0-'})
    assert r.status_code == 206 and r.data == contenido[:4]
    assert r.headers['Content-Range'] == 'bytes 0-3/10' and r.mimetype == 'video/mp4'
    r = client.get(f'{PUB}/videos/{vid}', headers={'Range': 'bytes=8-'})
    assert r.data == contenido[8:] and r.headers['Content-Range'] == 'bytes 8-9/10'
    assert client.get(f'{PUB}/videos/{vid}', headers={'Range': 'bytes=50-'}).status_code == 416


def test_una_parte_desfasada_devuelve_lo_recibido_para_seguir(client, dir_h):
    r = client.post(URL + '/videos', json={'nombre': 'x', 'tamano': 8, 'tipo': 'video/webm'}, headers=dir_h)
    vid = r.get_json()['video']['id']
    client.put(f'{URL}/videos/{vid}?desde=0', data=b'abcd', headers=dir_h, content_type='application/octet-stream')
    r = client.put(f'{URL}/videos/{vid}?desde=0', data=b'abcd', headers=dir_h, content_type='application/octet-stream')
    assert r.status_code == 409 and r.get_json() == {
        'code': 'desfasado',
        'message': 'La subida se desfasó.',
        'recibido': 4,
    }
    # Sin terminar no se sirve.
    assert client.get(f'{PUB}/videos/{vid}').status_code == 404


@pytest.mark.parametrize(
    'cuerpo',
    [
        {'nombre': 'x', 'tamano': 10, 'tipo': 'image/png'},
        {'nombre': 'x', 'tamano': videos.TAMANO_MAX + 1, 'tipo': 'video/mp4'},
        {'nombre': 'x', 'tamano': True, 'tipo': 'video/mp4'},
    ],
)
def test_rechaza_tipos_y_tamanos_invalidos(client, dir_h, cuerpo):
    assert client.post(URL + '/videos', json=cuerpo, headers=dir_h).get_json()['code'] == 'invalido'


def test_sin_volumen_avisa(client, dir_h, monkeypatch):
    monkeypatch.delenv('AGENDAS_VIDEOS_DIR')
    r = client.post(URL + '/videos', json={'nombre': 'x', 'tamano': 10, 'tipo': 'video/mp4'}, headers=dir_h)
    assert r.status_code == 503 and r.get_json()['code'] == 'sin_volumen'


def test_borrar_un_video_que_usa_otra_pagina_no_lo_borra(client, dir_h):
    vid = _subir(client, dir_h, b'12345678')
    servicio.guardar_doc('gracias', 'g1', {'video': {'archivo': vid}})
    servicio.guardar_doc('gracias', 'g2', {'video': {'archivo': vid}})
    assert client.delete(f'{URL}/videos/{vid}?salvo=g1', headers=dir_h).get_json() == {'ok': True, 'enUso': True}
    servicio.borrar_doc('gracias', 'g2')
    assert client.delete(f'{URL}/videos/{vid}?salvo=g1', headers=dir_h).get_json() == {'ok': True}
    assert client.get(f'{URL}/videos/{vid}', headers=dir_h).status_code == 404


def test_la_pagina_publica_trae_videos_y_casos(client, db):
    servicio.guardar_doc(
        'gracias',
        'g1',
        {
            'nombre': 'Workshop',
            'video': {'archivo': 'v' + 'a' * 20},
            'plan': {'url': 'https://www.loom.com/share/abc'},
            'segundos': 3,
        },
    )
    r = client.get(PUB + '/gracias/g1')
    assert r.status_code == 200
    assert r.get_json()['gracias'] == {
        'id': 'g1',
        'video': {'tipo': 'archivo', 'src': '/api/agendas-v2/publico/videos/v' + 'a' * 20},
        'plan': {'tipo': 'link', 'src': 'https://www.loom.com/share/abc'},
        'segundos': 3,
        'casos': [
            {
                'nombre': 'Dra. Angela Luza',
                'meta': 'Medicina Física · ENARM',
                'resumen': 'De reprobar a pasar',
                'cita': 'Las técnicas me volaron la cabeza.',
                'foto': 'https://academy.thelearnation.com/storage/a.jpg',
                'video': '',
            }
        ],
    }
    assert client.get(PUB + '/gracias/nada').status_code == 404


def test_sin_casos_no_le_pregunta_a_la_academia(client, db, monkeypatch):
    def no_llamar():
        raise AssertionError('no tenía que llamar a la Academia')

    monkeypatch.setattr(LearnationService, 'get_success_cases', staticmethod(no_llamar))
    servicio.guardar_doc('gracias', 'g1', {'casos': False})
    assert client.get(PUB + '/gracias/g1').get_json()['gracias']['casos'] == []


def test_si_la_academia_falla_quedan_los_ultimos_casos(monkeypatch):
    assert servicio.casos_de_exito(ahora=1000)[0]['nombre'] == 'Dra. Angela Luza'

    def falla():
        raise LearnationAPIError('caída')

    monkeypatch.setattr(LearnationService, 'get_success_cases', staticmethod(falla))
    assert servicio.casos_de_exito(ahora=1000 + 60)[0]['nombre'] == 'Dra. Angela Luza'  # en caché
    assert servicio.casos_de_exito(ahora=1000 + servicio.CACHE_CASOS_S + 1)[0]['nombre'] == 'Dra. Angela Luza'


def test_el_evento_publicado_lleva_la_pagina_de_gracias_en_vivo(client, db):
    g = servicio.guardar_doc
    g('eventos', 'ev', {'nombre': 'Llamada', 'slug': 'llamada', 'persona': 'p1'})
    d = servicio.colecciones()
    g('eventos', 'ev', {'publicado': config_de(d['eventos'][0], None)}, parcial=True)
    assert client.get(PUB + '/eventos/llamada').get_json()['evento']['gracias'] == ''

    # Elegirla no pide volver a publicar; si la borran, el evento sigue sin ella.
    g('gracias', 'g1', {'nombre': 'Workshop'})
    g('eventos', 'ev', {'gracias': 'g1'}, parcial=True)
    assert client.get(PUB + '/eventos/llamada').get_json()['evento']['gracias'] == 'g1'
    servicio.borrar_doc('gracias', 'g1')
    assert client.get(PUB + '/eventos/llamada').get_json()['evento']['gracias'] == ''
