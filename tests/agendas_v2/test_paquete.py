"""Configuración asistida por IA: el prompt que se exporta y el JSON («paquete») que se importa.

Lo que importa: el prompt lleva el equipo real, el paquete se valida entero antes de escribir (con
errores que dicen dónde está el problema), se crea todo en una sola vez, nunca pisa lo que existe y
el evento queda sin publicar. Y lo importado funciona: se publica y el link agenda.
"""

import copy

import pytest

from app.agendas_v2 import servicio
from app.agendas_v2.nucleo.eventos import config_de
from app.agendas_v2.paquete import EJEMPLO

URL = '/api/agendas-v2/paquete'
LV9a12 = {str(d): [['09:00', '12:00']] for d in range(1, 6)}


@pytest.fixture()
def dir_h(make_user, auth_headers):
    return auth_headers(make_user(role='director_comercial', email='dir@neuro.com'))


@pytest.fixture()
def equipo(db):
    g = servicio.guardar_doc
    g('roles', 'rc', {'nombre': 'Closer', 'atiende': True})
    g('roles', 'rs', {'nombre': 'Setter'})
    g('personas', 'p1', {'nombre': 'Ana', 'email': 'closer1@empresa.com', 'rol': 'rc', 'horario': LV9a12})
    g('personas', 'p2', {'nombre': 'Beto', 'email': 'closer2@empresa.com', 'rol': 'rc', 'horario': LV9a12})
    g('personas', 'p3', {'nombre': 'Juan', 'email': 'setter@empresa.com', 'rol': 'rs'})


def _paquete(**cambios):
    p = copy.deepcopy(EJEMPLO)
    for ruta, valor in cambios.items():
        *camino, clave = ruta.split('__')
        x = p
        for k in camino:
            x = x[int(k)] if k.isdigit() else x[k]
        x[int(clave) if clave.isdigit() else clave] = valor
    return p


def test_el_prompt_trae_el_equipo_real_y_el_formato(client, equipo, dir_h):
    r = client.get(URL + '/prompt', headers=dir_h)
    assert r.status_code == 200
    texto = r.get_json()['prompt']
    assert 'Ana <closer1@empresa.com> (closer)' in texto and 'setter@empresa.com' not in texto  # Team es solo de closers
    assert '"paquete_thalamus": 1' in texto and 'Empezá preguntándome' in texto


def test_solo_la_direccion(client, equipo, make_user, auth_headers):
    assert client.get(URL + '/prompt').status_code == 401
    closer = auth_headers(make_user(role='closer'))
    assert client.post(URL, json={'paquete': EJEMPLO}, headers=closer).status_code == 403


def test_simular_no_escribe_y_resume(client, equipo, dir_h):
    r = client.post(URL, json={'paquete': EJEMPLO, 'simular': True}, headers=dir_h)
    assert r.status_code == 200
    res = r.get_json()['resumen']
    assert res['funnel'] == 'Workshop octubre' and res['preguntas'] == 2 and res['reglas'] == 1
    assert [g['nombre'] for g in res['prioridades']] == ['Ultra', 'General']
    assert servicio.colecciones()['funnels'] == []


def test_importar_crea_todo_unido_y_sin_publicar(client, equipo, dir_h):
    r = client.post(URL, json={'paquete': EJEMPLO}, headers=dir_h)
    assert r.status_code == 201
    creados = r.get_json()['creados']
    d = servicio.colecciones()

    ultra, general = d['grupos']
    assert ultra['nombre'] == 'Ultra' and ultra['miembros'] == ['p1'] and general['miembros'] == ['p1', 'p2']
    assert general['estrategia'] == 'repartir'

    (fo,) = d['formularios']
    assert fo['contacto']['instagram'] is False
    inversion = fo['preguntas'][0]
    assert inversion['id'] == 'inversion' and inversion['peso'] == 3
    assert [o['id'] for o in inversion['opciones']] == ['alta', 'media', 'nada']
    assert inversion['opciones'][2]['descalifica'] is True
    assert fo['reglas'][0]['grupo'] == ultra['id'] and fo['reglas'][0]['cond'] == [{'q': 'inversion', 'ops': ['alta']}]
    assert fo['resto'] == general['id']

    (fu,) = d['funnels']
    assert fu['slug'] == 'workshop' and fu['setting'] is False and [o['nombre'] for o in fu['origenes']] == ['Instagram', 'Grabación']

    (ev,) = d['eventos']
    assert ev['id'] == creados['evento'] and ev['funnel'] == fu['id'] and ev['formulario'] == fo['id']
    assert ev['duracion'] == 45 and ev['publicado'] == '' and ev['slug'] == 'diagnostico'


def test_lo_importado_se_publica_y_rutea(client, equipo, dir_h):
    client.post(URL, json={'paquete': EJEMPLO}, headers=dir_h)
    d = servicio.colecciones()
    ev, fo = d['eventos'][0], d['formularios'][0]
    servicio.guardar_doc('eventos', ev['id'], {'publicado': config_de(ev, fo)}, parcial=True)
    r = client.get('/api/agendas-v2/publico/eventos/workshop/diagnostico')
    assert r.status_code == 200 and r.get_json()['form']['preguntas'][0]['id'] == 'inversion'


def test_importar_dos_veces_no_pisa_nada(client, equipo, dir_h):
    assert client.post(URL, json={'paquete': EJEMPLO}, headers=dir_h).status_code == 201
    r = client.post(URL, json={'paquete': EJEMPLO}, headers=dir_h)
    assert r.status_code == 400 and 'ya existe un funnel con el slug "workshop"' in r.get_json()['errores'][0]
    otro = _paquete(funnel__slug='workshop-2')
    assert client.post(URL, json={'paquete': otro}, headers=dir_h).status_code == 201
    d = servicio.colecciones()
    assert len(d['funnels']) == 2 and len(d['grupos']) == 4 and len(d['eventos']) == 2


@pytest.mark.parametrize(
    'cambios, esperado',
    [
        ({'paquete_thalamus': 2}, '"paquete_thalamus" tiene que ser 1'),
        ({'prioridades__0__closers': ['nadie@x.com']}, 'prioridades[0] (Ultra): "nadie@x.com" no está en Team'),
        ({'prioridades__0__closers': ['setter@empresa.com']}, 'Juan no tiene un rol que atienda llamadas'),
        ({'prioridades__1__nombre': 'Ultra'}, 'el nombre "Ultra" está repetido'),
        ({'formulario__reglas__0__prioridad': 'VIP'}, 'la prioridad "VIP" no está en "prioridades"'),
        (
            {'formulario__reglas__0__si__0__respuestas': ['carisima']},
            'respuestas que no existen en "inversion": carisima',
        ),
        ({'formulario__reglas__0__si__0__pregunta': 'profesion'}, '"profesion" no es una pregunta con opciones'),
        ({'formulario__preguntas__1__id': 'c-mail'}, 'formulario.preguntas[1]: "id" falta o empieza con "c-"'),
        ({'formulario__preguntas__0__tipo': 'checkbox'}, '"tipo" tiene que ser opciones, lista, texto o parrafo'),
        ({'evento__duracion': 50}, '"duracion" tiene que ser uno de 15, 30, 45, 60, 90'),
        ({'funnel__origenes__1__setter': 'otro@x.com'}, 'funnel.origenes[1]: los setters ya no van en los orígenes'),
    ],
)
def test_errores_que_dicen_donde(client, equipo, dir_h, cambios, esperado):
    r = client.post(URL, json={'paquete': _paquete(**cambios)}, headers=dir_h)
    assert r.status_code == 400
    assert any(esperado in e for e in r.get_json()['errores']), r.get_json()['errores']
    assert servicio.colecciones()['grupos'] == []  # con un error no se crea nada


def test_un_paquete_que_no_es_un_objeto(client, equipo, dir_h):
    r = client.post(URL, json={'paquete': 'hola'}, headers=dir_h)
    assert r.status_code == 400 and r.get_json()['errores']


def test_un_funnel_de_setting_no_lleva_origenes(client, equipo, dir_h):
    r = client.post(URL, json={'paquete': _paquete(funnel__tipo='setting')}, headers=dir_h)
    assert r.status_code == 201 and r.get_json()['resumen']['tipo'] == 'setting'
    (fu,) = servicio.colecciones()['funnels']
    assert fu['setting'] is True and fu['origenes'] == []


# --- Edición con IA: el funnel actual va en el prompt y el JSON editado se escribe encima ---------


def _importado(client, dir_h):
    r = client.post(URL, json={'paquete': EJEMPLO}, headers=dir_h)
    return r.get_json()['creados']


def test_el_prompt_de_edicion_trae_el_funnel_como_esta(client, equipo, dir_h):
    creados = _importado(client, dir_h)
    r = client.get(URL + '/prompt?evento=' + creados['evento'], headers=dir_h)
    assert r.status_code == 200
    texto = r.get_json()['prompt']
    assert 'TAL COMO ESTÁ HOY' in texto and 'qué quiero cambiar' in texto
    assert '¿Cuánto podrías invertir en tu formación?' in texto and '"closer2@empresa.com"' in texto
    assert client.get(URL + '/prompt?evento=nada', headers=dir_h).status_code == 404


def test_exportar_y_volver_a_aplicar_no_cambia_nada(client, equipo, dir_h):
    from app.agendas_v2 import paquete
    creados = _importado(client, dir_h)
    antes = servicio.colecciones()
    actual = paquete.exportar(antes, creados['evento'])
    r = client.post(URL, json={'paquete': actual, 'evento': creados['evento']}, headers=dir_h)
    assert r.status_code == 200
    despues = servicio.colecciones()
    for col in ('funnels', 'formularios', 'grupos', 'eventos'):
        assert despues[col] == antes[col], col


def test_editar_escribe_encima_conserva_los_links_y_queda_en_borrador(client, equipo, dir_h):
    from app.agendas_v2 import paquete
    creados = _importado(client, dir_h)
    d = servicio.colecciones()
    ev, fo = d['eventos'][0], d['formularios'][0]
    servicio.guardar_doc('eventos', ev['id'], {'publicado': config_de(ev, fo)}, parcial=True)

    editado = paquete.exportar(servicio.colecciones(), creados['evento'])
    editado['funnel'].update({'slug': 'otro-link', 'tipo': 'vsl'})
    editado['evento'].update({'slug': 'otro', 'duracion': 60})
    editado['formulario']['preguntas'][1]['titulo'] = '¿A qué te dedicás hoy?'
    editado['prioridades'][0]['closers'] = ['closer2@empresa.com']
    editado['prioridades'].append({'nombre': 'Nueva', 'estrategia': 'llenar', 'closers': ['closer1@empresa.com']})
    r = client.post(URL, json={'paquete': editado, 'evento': creados['evento']}, headers=dir_h)
    assert r.status_code == 200

    d = servicio.colecciones()
    (fu,), (ev,), (fo,) = d['funnels'], d['eventos'], d['formularios']
    assert fu['id'] == creados['funnel'] and fu['slug'] == 'workshop' and fu['tipo'] == 'vsl'  # el link no cambia
    assert ev['id'] == creados['evento'] and ev['slug'] == 'diagnostico' and ev['duracion'] == 60
    assert fo['preguntas'][1]['titulo'] == '¿A qué te dedicás hoy?'
    ultra = next(g for g in d['grupos'] if g['nombre'] == 'Ultra')
    assert ultra['miembros'] == ['p2'] and len(d['grupos']) == 3  # Ultra se edita; Nueva se crea
    # Lo publicado sigue igual hasta que se publique de nuevo.
    r = client.get('/api/agendas-v2/publico/eventos/workshop/diagnostico')
    assert r.get_json()['form']['preguntas'][1]['titulo'] == '¿A qué te dedicás?'
