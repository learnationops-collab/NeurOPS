"""El formulario público de Asistente lee sus preguntas del formulario activo y
guarda con cuál contestó (`form_id`) y las respuestas sin columna
(`respuestas_extra`)."""
import copy

from app.models import AssistantApplication, HiringConfig, HiringForm
from app.services import hiring_forms as hf

FORM = '/api/public/assistant-form'
ALTA = '/api/public/assistant-applications'


def _form(db, nombre='Otro', activo=False, extra=None, apagar=()):
    preguntas = copy.deepcopy(hf.PREGUNTAS_BASE)
    for p in preguntas:
        if p['id'] in apagar:
            p['on'] = False
    preguntas += extra or []
    form = HiringForm(nombre=nombre, activo=activo, preguntas=preguntas)
    db.session.add(form)
    db.session.commit()
    return form


LINKEDIN = {'id': 'linkedin', 'bloque': 'Video y CV', 'tipo': 'link', 'req': True, 't': 'Tu LinkedIn',
            'on': True, 'base': False}
HERRAMIENTAS = {'id': 'otras_apps', 'bloque': 'Herramientas', 'tipo': 'check', 'req': False,
                't': '¿Qué otras usás?', 'o': [{'t': 'Canva'}, {'t': 'Trello'}], 'on': True, 'base': False}


# --- GET -----------------------------------------------------------------------------------------

def test_sin_formularios_siembra_el_base_y_lo_devuelve(client):
    cuerpo = client.get(FORM).get_json()

    assert cuerpo['activo'] is True
    assert cuerpo['nombre'] == 'Asistente Administrativa y Personal'
    assert [p['id'] for p in cuerpo['preguntas']] == hf.IDS_BASE
    assert not any('on' in p or 'base' in p for p in cuerpo['preguntas'])
    assert cuerpo['config'] == {'puesto': 'Asistente Administrativa y Personal', 'cierre': None,
                                'tasa_brl': 5.4, 'presupuesto_min': 200, 'presupuesto_max': 400}
    assert 'preview' not in cuerpo


def test_devuelve_solo_las_prendidas_del_activo(client, db):
    client.get(FORM)  # siembra
    HiringForm.query.update({HiringForm.activo: False})
    activo = _form(db, 'B', activo=True, extra=[LINKEDIN], apagar=('notion', 'meta'))

    cuerpo = client.get(FORM).get_json()

    ids = [p['id'] for p in cuerpo['preguntas']]
    assert cuerpo['id'] == activo.id
    assert 'notion' not in ids and 'meta' not in ids and ids[-1] == 'linkedin'


def test_sin_formulario_activo_y_con_la_config_guardada(client, db):
    client.get(FORM)
    HiringForm.query.update({HiringForm.activo: False})
    db.session.add(HiringConfig(puesto='Asistente', presupuesto_min=250, presupuesto_max=450, tasa_brl=5.7))
    db.session.commit()

    r = client.get(FORM)

    assert r.status_code == 200
    assert r.get_json() == {'activo': False, 'config': {
        'puesto': 'Asistente', 'cierre': None, 'tasa_brl': 5.7, 'presupuesto_min': 250, 'presupuesto_max': 450}}


def test_preview_devuelve_uno_inactivo(client, db):
    client.get(FORM)
    borrador = _form(db, 'Borrador', apagar=('notion',))

    cuerpo = client.get(FORM, query_string={'preview': borrador.id}).get_json()

    assert cuerpo['id'] == borrador.id and cuerpo['preview'] is True
    assert 'notion' not in [p['id'] for p in cuerpo['preguntas']]
    assert client.get(FORM, query_string={'preview': 999}).status_code == 404


def test_es_publico(client):
    assert client.get(FORM).status_code == 200


# --- POST ----------------------------------------------------------------------------------------

def _post(client, **campos):
    campos.setdefault('dedupe_key', 'k-1')
    campos.setdefault('nombre', 'Ana Pérez')
    return client.post(ALTA, json=campos)


def test_guarda_el_form_id_una_sola_vez(client, db):
    a = _form(db, 'A')
    b = _form(db, 'B')

    _post(client, form_id=a.id)
    _post(client, form_id=b.id)

    assert AssistantApplication.query.one().form_id == a.id


def test_un_form_id_inexistente_se_ignora(client):
    assert _post(client, form_id=999).status_code == 201
    assert AssistantApplication.query.one().form_id is None


def test_las_respuestas_sin_columna_van_a_respuestas_extra(client, db):
    form = _form(db, extra=[LINKEDIN, HERRAMIENTAS])

    _post(client, form_id=form.id, pais='Argentina', linkedin='  https://linkedin.com/in/ana  ',
          otras_apps=['Canva', 'Trello'], inventada='no es una pregunta', completo=False)

    fila = AssistantApplication.query.one()
    assert fila.respuestas_extra == {'linkedin': 'https://linkedin.com/in/ana', 'otras_apps': 'Canva | Trello'}
    assert fila.pais == 'Argentina'


def test_un_post_parcial_no_borra_las_extra(client, db):
    form = _form(db, extra=[LINKEDIN, HERRAMIENTAS])
    _post(client, form_id=form.id, linkedin='https://linkedin.com/in/ana')
    _post(client, form_id=form.id, otras_apps=['Canva'])
    _post(client, form_id=form.id, linkedin='')

    assert AssistantApplication.query.one().respuestas_extra == {
        'linkedin': 'https://linkedin.com/in/ana', 'otras_apps': 'Canva'}


def test_sin_form_id_usa_el_activo(client, db):
    _form(db, activo=True, extra=[LINKEDIN])

    _post(client, linkedin='https://linkedin.com/in/ana')

    fila = AssistantApplication.query.one()
    assert fila.form_id is None
    assert fila.respuestas_extra == {'linkedin': 'https://linkedin.com/in/ana'}


def test_una_pregunta_nueva_no_pisa_columnas_ni_claves_reservadas(client, db):
    raras = [{'id': i, 'tipo': 'texto', 't': i, 'on': True, 'base': False}
             for i in ('completo', 'dedupe_key', 'motivo_descarte')]
    form = _form(db, extra=raras)

    _post(client, form_id=form.id, completo=True, motivo_descarte='x', email='ana@test.local')

    fila = AssistantApplication.query.one()
    assert fila.respuestas_extra is None
    assert fila.email == 'ana@test.local' and fila.completo is True
