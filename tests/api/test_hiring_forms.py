"""Panel de Hiring → Forms y Búsqueda: endpoints del editor de formularios y de la
configuración de la búsqueda."""
import copy

import pytest

from app.models import AssistantApplication, HiringConfig, HiringForm
from app.services import hiring_forms as hf

FORMS = '/api/hiring/forms'
CONFIG = '/api/hiring/config'


@pytest.fixture()
def h(make_user, auth_headers):
    return auth_headers(make_user(role='hiring'))


def preguntas_base():
    return copy.deepcopy(hf.PREGUNTAS_BASE)


def _activos():
    return [f.id for f in HiringForm.query.filter_by(activo=True)]


# --- Acceso --------------------------------------------------------------------------------------

@pytest.mark.parametrize('metodo, url', [
    ('get', FORMS), ('post', FORMS), ('get', f'{FORMS}/1'), ('put', f'{FORMS}/1'),
    ('post', f'{FORMS}/1/activar'), ('post', f'{FORMS}/1/duplicar'), ('delete', f'{FORMS}/1'),
    ('get', CONFIG), ('put', CONFIG),
])
def test_anonimo_y_otro_rol_no_entran(client, make_user, auth_headers, metodo, url):
    assert getattr(client, metodo)(url, json={}).status_code == 401
    closer = auth_headers(make_user(role='closer'))
    assert getattr(client, metodo)(url, json={}, headers=closer).status_code == 403


def test_admin_tambien_entra(client, make_user, auth_headers):
    assert client.get(FORMS, headers=auth_headers(make_user(role='admin'))).status_code == 200


# --- Lista y semilla -----------------------------------------------------------------------------

def test_la_lista_siembra_el_formulario_base_y_le_asigna_las_postulaciones(client, db, h):
    db.session.add_all([AssistantApplication(nombre='A', completo=True), AssistantApplication(nombre='B')])
    db.session.commit()

    cuerpo = client.get(FORMS, headers=h).get_json()

    assert len(cuerpo['forms']) == 1
    form = cuerpo['forms'][0]
    assert cuerpo['activo_id'] == form['id'] and form['activo'] is True
    assert form['nombre'] == 'Asistente Administrativa y Personal'
    assert form['resumen'] == {"activas": 35, "total": 35, "excluyentes": 4, "respuestas": 1}
    assert 'preguntas' not in form
    assert {a.form_id for a in AssistantApplication.query} == {form['id']}


def test_la_lista_va_activo_primero_y_despues_el_mas_nuevo(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']
    a = client.post(FORMS, json={'nombre': 'A'}, headers=h).get_json()['id']
    b = client.post(FORMS, json={'nombre': 'B'}, headers=h).get_json()['id']

    ids = [f['id'] for f in client.get(FORMS, headers=h).get_json()['forms']]

    assert ids == [base_id, b, a]


# --- Crear, ver, editar --------------------------------------------------------------------------

def test_crear_copia_el_activo_y_queda_inactivo(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']
    preguntas = preguntas_base()
    next(p for p in preguntas if p['id'] == 'notion')['on'] = False
    client.put(f'{FORMS}/{base_id}', json={'preguntas': preguntas}, headers=h)

    r = client.post(FORMS, json={'nombre': '  Versión B  '}, headers=h)

    assert r.status_code == 201
    nuevo = r.get_json()
    assert nuevo['nombre'] == 'Versión B' and nuevo['activo'] is False
    assert nuevo['preguntas'] == preguntas
    assert _activos() == [base_id]


def test_crear_desde_otro_formulario(client, h):
    client.get(FORMS, headers=h)
    origen = client.post(FORMS, json={'nombre': 'Origen'}, headers=h).get_json()
    preguntas = preguntas_base() + [{'id': 'linkedin', 'tipo': 'link', 't': 'LinkedIn', 'on': True, 'base': False}]
    client.put(f"{FORMS}/{origen['id']}", json={'preguntas': preguntas}, headers=h)

    nuevo = client.post(FORMS, json={'nombre': 'Hijo', 'desde_id': origen['id']}, headers=h).get_json()

    assert nuevo['preguntas'][-1]['id'] == 'linkedin'


def test_crear_sin_nombre_o_desde_uno_que_no_existe(client, h):
    assert client.post(FORMS, json={'nombre': '  '}, headers=h).status_code == 400
    assert client.post(FORMS, json={'nombre': 'x', 'desde_id': 999}, headers=h).status_code == 404


def test_ver_un_formulario_trae_las_preguntas(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']

    cuerpo = client.get(f'{FORMS}/{base_id}', headers=h).get_json()

    assert cuerpo['preguntas'] == hf.PREGUNTAS_BASE
    assert set(cuerpo) == {'id', 'nombre', 'activo', 'created_at', 'updated_at', 'resumen', 'preguntas'}
    assert client.get(f'{FORMS}/999', headers=h).status_code == 404


def test_editar_nombre_y_preguntas(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']
    preguntas = preguntas_base()
    next(p for p in preguntas if p['id'] == 'notion')['on'] = False

    r = client.put(f'{FORMS}/{base_id}', json={'nombre': 'Renombrado', 'preguntas': preguntas}, headers=h)

    assert r.status_code == 200
    cuerpo = r.get_json()
    assert cuerpo['nombre'] == 'Renombrado'
    assert cuerpo['resumen']['activas'] == 34
    assert db_preguntas(base_id)[next(i for i, p in enumerate(preguntas) if p['id'] == 'notion')]['on'] is False


def db_preguntas(form_id):
    from app import db
    db.session.expire_all()
    return db.session.get(HiringForm, form_id).preguntas


def test_editar_con_preguntas_invalidas_no_guarda_nada(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']
    sin_notion = [p for p in preguntas_base() if p['id'] != 'notion']

    r = client.put(f'{FORMS}/{base_id}', json={'nombre': 'Otro', 'preguntas': sin_notion}, headers=h)

    assert r.status_code == 400
    assert 'notion' in r.get_json()['message']
    from app import db
    db.session.expire_all()
    form = db.session.get(HiringForm, base_id)
    assert form.nombre == 'Asistente Administrativa y Personal'
    assert len(form.preguntas) == 36


# --- Activar -------------------------------------------------------------------------------------

def test_activar_deja_uno_solo_activo_y_desactivar_deja_ninguno(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']
    otro = client.post(FORMS, json={'nombre': 'Otro'}, headers=h).get_json()['id']

    cuerpo = client.post(f'{FORMS}/{otro}/activar', json={'activo': True}, headers=h).get_json()
    assert cuerpo['activo_id'] == otro
    assert cuerpo['forms'][0]['id'] == otro
    assert _activos() == [otro]

    cuerpo = client.post(f'{FORMS}/{otro}/activar', json={'activo': False}, headers=h).get_json()
    assert cuerpo['activo_id'] is None
    assert _activos() == []

    client.post(f'{FORMS}/{base_id}/activar', json={'activo': True}, headers=h)
    assert _activos() == [base_id]
    assert client.post(f'{FORMS}/{base_id}/activar', json={'activo': 'si'}, headers=h).status_code == 400


# --- Duplicar y borrar ---------------------------------------------------------------------------

def test_duplicar(client, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']

    r = client.post(f'{FORMS}/{base_id}/duplicar', headers=h)

    assert r.status_code == 201
    copia = r.get_json()
    assert copia['nombre'] == 'Asistente Administrativa y Personal · copia'
    assert copia['activo'] is False and copia['preguntas'] == hf.PREGUNTAS_BASE


def test_no_se_borra_el_activo_ni_uno_con_postulaciones(client, db, h):
    base_id = client.get(FORMS, headers=h).get_json()['activo_id']
    r = client.delete(f'{FORMS}/{base_id}', headers=h)
    assert r.status_code == 409 and 'activo' in r.get_json()['message']

    otro = client.post(FORMS, json={'nombre': 'Otro'}, headers=h).get_json()['id']
    db.session.add(AssistantApplication(nombre='A', form_id=otro))
    db.session.commit()
    r = client.delete(f'{FORMS}/{otro}', headers=h)
    assert r.status_code == 409 and 'postulaci' in r.get_json()['message']


def test_borrar_uno_inactivo_y_sin_postulaciones(client, h):
    client.get(FORMS, headers=h)
    otro = client.post(FORMS, json={'nombre': 'Otro'}, headers=h).get_json()['id']

    assert client.delete(f'{FORMS}/{otro}', headers=h).get_json() == {'status': 'success', 'id': otro}
    assert HiringForm.query.get(otro) is None


# --- Configuración de la búsqueda ----------------------------------------------------------------

def test_config_sin_guardar_trae_los_defaults(client, h):
    assert client.get(CONFIG, headers=h).get_json() == {
        'puesto': 'Asistente Administrativa y Personal', 'cierre': None,
        'presupuesto_min': 200, 'presupuesto_max': 400, 'tasa_brl': 5.4,
    }
    assert HiringConfig.query.count() == 0


def test_config_se_guarda_y_se_lee(client, h):
    cuerpo = {'puesto': 'Asistente', 'cierre': '2026-11-30', 'presupuesto_min': 250,
              'presupuesto_max': 450, 'tasa_brl': 5.6}

    assert client.put(CONFIG, json=cuerpo, headers=h).get_json() == cuerpo
    assert client.get(CONFIG, headers=h).get_json() == cuerpo
    # Parcial: lo que no viene queda como estaba; `cierre: null` lo borra.
    assert client.put(CONFIG, json={'cierre': None}, headers=h).get_json() == {**cuerpo, 'cierre': None}
    assert HiringConfig.query.count() == 1


@pytest.mark.parametrize('cuerpo, fragmento', [
    ({'presupuesto_min': 500}, 'mínimo'),
    ({'presupuesto_max': 100}, 'mínimo'),
    ({'presupuesto_min': -5}, 'mayor que cero'),
    ({'presupuesto_max': 'mucho'}, 'mayor que cero'),
    ({'tasa_brl': 0}, 'tasa'),
    ({'tasa_brl': 150}, 'tasa'),
    ({'cierre': '30/11/2026'}, 'AAAA-MM-DD'),
    ({'puesto': ''}, 'puesto'),
])
def test_config_invalida(client, h, cuerpo, fragmento):
    r = client.put(CONFIG, json=cuerpo, headers=h)

    assert r.status_code == 400
    assert fragmento in r.get_json()['message']
    assert HiringConfig.query.count() == 0
