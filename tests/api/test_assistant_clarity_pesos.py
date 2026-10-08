"""Pestaña Clarity del panel de Hiring: los pesos de la rúbrica nueva (07/10/2026).

La base trae sembrados los 8 criterios de la rúbrica anterior (hasta que corra la migración
`f2b8d4a6c910`); el panel tiene que mostrar siempre los 10 vigentes y el score no puede
distorsionarse por una fila de un criterio que ya no existe.
"""
import pytest

from app.models import AssistantApplication, AssistantClarityWeight
from app.services import assistant_clarity

PESOS = '/api/assistant-applications/clarity-weights'
LISTA = '/api/assistant-applications'

ANTERIORES = {'criterio': 18, 'experiencia': 16, 'escritura': 14, 'herramientas': 14,
              'ia': 14, 'digital': 10, 'video': 10, 'dinero': 4}


@pytest.fixture()
def hiring(make_user):
    return make_user(role='hiring')


@pytest.fixture()
def sembrada_con_la_rubrica_vieja(db):
    for criterio, peso in ANTERIORES.items():
        db.session.add(AssistantClarityWeight(criterion=criterio, label='viejo', weight=peso, default_weight=peso))
    db.session.commit()


def test_sin_filas_el_panel_ofrece_los_10_criterios_de_fabrica(client, auth_headers, hiring):
    respuesta = client.get(PESOS, headers=auth_headers(hiring))

    criterios = respuesta.get_json()
    assert [c['criterion'] for c in criterios] == [c['criterion'] for c in assistant_clarity.CLARITY_CRITERIA]
    assert sum(c['weight'] for c in criterios) == 100
    assert all(c['detalle'] and c['weight'] == c['default_weight'] for c in criterios)


def test_con_la_rubrica_vieja_sembrada_se_ven_los_criterios_nuevos(
        client, auth_headers, hiring, sembrada_con_la_rubrica_vieja):
    criterios = client.get(PESOS, headers=auth_headers(hiring)).get_json()

    nombres = [c['criterion'] for c in criterios]
    assert 'escritura' not in nombres
    assert {'aporte', 'idiomas', 'pretension'} <= set(nombres)
    pesos = {c['criterion']: c['weight'] for c in criterios}
    assert pesos['criterio'] == 18          # el guardado manda en los que siguen existiendo
    assert pesos['aporte'] == 10            # los nuevos entran con el de fábrica
    assert all(c['label'] != 'viejo' for c in criterios)  # el rótulo sale del código


def test_guardar_pesos_se_refleja_y_ignora_criterios_inexistentes(client, auth_headers, hiring):
    cabeceras = auth_headers(hiring)

    respuesta = client.put(PESOS, headers=cabeceras, json={'weights': {'ia': 30, 'escritura': 99, 'idiomas': 0}})

    assert respuesta.status_code == 200
    pesos = {c['criterion']: c['weight'] for c in client.get(PESOS, headers=cabeceras).get_json()}
    assert pesos['ia'] == 30 and pesos['idiomas'] == 0
    assert 'escritura' not in pesos
    assert AssistantClarityWeight.query.filter_by(criterion='escritura').first() is None


def test_el_score_del_listado_no_se_distorsiona_con_el_peso_de_un_criterio_viejo(
        client, auth_headers, hiring, db, sembrada_con_la_rubrica_vieja):
    db.session.add(AssistantApplication(nombre='Ana', completo=True, experiencia='Más de 5 años'))
    db.session.commit()

    score = client.get(LISTA, headers=auth_headers(hiring)).get_json()['postulaciones'][0]['score']

    esperado = assistant_clarity.score_de(AssistantApplication.query.first(), {
        **assistant_clarity.DEFAULT_WEIGHTS, **{k: v for k, v in ANTERIORES.items() if k in assistant_clarity.DEFAULT_WEIGHTS}})
    assert score == esperado


def test_las_estadisticas_cuentan_cada_opcion_marcada_de_ia_y_no_cada_combinacion(client, auth_headers, hiring, db):
    uno = 'La uso para redactar, resumir, corregir textos y hacer consultas puntuales'
    dos = 'Creé mis propios GPTs o asistentes personalizados para tareas que repito'
    db.session.add_all([
        AssistantApplication(nombre='A', ia_avanzado=f'{uno} | {dos}'),
        AssistantApplication(nombre='B', ia_avanzado=uno),
    ])
    db.session.commit()

    stats = client.get('/api/assistant-applications/stats', headers=auth_headers(hiring)).get_json()

    assert {d['opcion']: d['cantidad'] for d in stats['distribucion_ia_avanzado']} == {uno: 2, dos: 1}


# --- Previsualizar pesos (sliders en vivo) ----------------------------------------------------

PREVIEW = f'{PESOS}/preview'


@pytest.fixture()
def dos_postulaciones(db):
    """Una fuerte en experiencia y otra fuerte en idiomas: según los pesos, cambia quién va primero."""
    exp = AssistantApplication(nombre='Exp', completo=True, aporte='x', experiencia='Más de 5 años')
    idi = AssistantApplication(nombre='Idi', completo=True, aporte='x',
                               ingles='Avanzado o nativo', idioma2='Avanzado o nativo')
    db.session.add_all([exp, idi])
    db.session.commit()
    return exp, idi


def test_preview_reordena_sin_guardar(client, auth_headers, hiring, dos_postulaciones):
    exp, idi = dos_postulaciones
    solo_idiomas = {c: 0 for c in assistant_clarity.DEFAULT_WEIGHTS}
    solo_idiomas['idiomas'] = 10

    respuesta = client.post(PREVIEW, headers=auth_headers(hiring), json={'weights': solo_idiomas})

    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'scores': {str(exp.id): 0, str(idi.id): 100}}
    assert AssistantClarityWeight.query.count() == 0


def test_preview_completa_con_los_pesos_guardados_e_ignora_lo_desconocido(
        client, db, auth_headers, hiring, dos_postulaciones):
    cabeceras = auth_headers(hiring)
    client.put(PESOS, headers=cabeceras, json={'weights': {'idiomas': 50}})

    scores = client.post(PREVIEW, headers=cabeceras,
                         json={'weights': {'experiencia': -3, 'escritura': 99}}).get_json()['scores']

    esperados = {**assistant_clarity.DEFAULT_WEIGHTS, 'idiomas': 50, 'experiencia': 0}
    for a in dos_postulaciones:
        assert scores[str(a.id)] == assistant_clarity.score_de(a, esperados)
    assert AssistantClarityWeight.query.filter_by(criterion='experiencia').first() is None


def test_preview_respeta_las_preguntas_apagadas(client, db, auth_headers, hiring):
    import copy

    from app.models import HiringForm
    from app.services.hiring_forms import PREGUNTAS_BASE

    preguntas = copy.deepcopy(PREGUNTAS_BASE)
    for p in preguntas:
        if p['id'] in ('ingles', 'idioma2'):
            p['on'] = False
    form = HiringForm(nombre='Sin idiomas', preguntas=preguntas)
    db.session.add(form)
    db.session.flush()
    fila = AssistantApplication(nombre='Ana', completo=True, aporte='x', form_id=form.id,
                                experiencia='Más de 5 años')
    db.session.add(fila)
    db.session.commit()

    solo_idiomas_y_exp = {c: 0 for c in assistant_clarity.DEFAULT_WEIGHTS}
    solo_idiomas_y_exp.update(idiomas=90, experiencia=10)
    scores = client.post(PREVIEW, headers=auth_headers(hiring), json={'weights': solo_idiomas_y_exp}).get_json()

    # Idiomas no se le preguntó: queda solo experiencia, que tiene al máximo.
    assert scores['scores'][str(fila.id)] == 100


def test_preview_con_un_peso_que_no_es_numero(client, auth_headers, hiring):
    respuesta = client.post(PREVIEW, headers=auth_headers(hiring), json={'weights': {'ia': 'mucho'}})
    assert respuesta.status_code == 400


def test_preview_pide_rol_de_hiring(client, auth_headers, make_user):
    assert client.post(PREVIEW, json={}).status_code == 401
    assert client.post(PREVIEW, json={}, headers=auth_headers(make_user(role='closer'))).status_code == 403
