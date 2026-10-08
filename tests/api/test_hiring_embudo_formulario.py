"""Embudo del formulario en Estadísticas: dónde se queda la gente, pregunta por pregunta."""
import pytest

from app.models import AssistantApplication
from app.models.assistant_application import CAMPOS_FORMULARIO

EXCLUYENTES_OK = {
    'equipo': 'Sí, las tres cosas',
    'disponibilidad': 'Sí, las 4 horas ahora y las 8 desde el tercer mes',
    'horario': 'Sí, me organizo sin problema',
    'empleo': 'No',
}
STATS = '/api/assistant-applications/stats'


@pytest.fixture()
def hiring_headers(make_user, auth_headers):
    return auth_headers(make_user(role='hiring'))


def _alta(db, hasta=None, **extra):
    """Postulación que contestó las preguntas del formulario hasta `hasta` inclusive."""
    campos = {'nombre': 'Ana Pérez'}
    if hasta is not None:
        for campo in CAMPOS_FORMULARIO[:CAMPOS_FORMULARIO.index(hasta) + 1]:
            campos[campo] = 'respuesta'
    # Respuestas que no cortan la postulación en los excluyentes.
    for campo, ok in EXCLUYENTES_OK.items():
        if campo in campos:
            campos[campo] = ok
    campos.update(extra)
    fila = AssistantApplication(**campos)
    db.session.add(fila)
    db.session.commit()
    return fila


def _embudo(client, headers, **params):
    r = client.get(STATS, headers=headers, query_string=params)
    assert r.status_code == 200
    return {e['campo']: e for e in r.get_json()['embudo_formulario']}


def test_una_entrada_por_pregunta_en_el_orden_del_formulario(client, db, hiring_headers):
    r = client.get(STATS, headers=hiring_headers)
    embudo = r.get_json()['embudo_formulario']

    assert [e['campo'] for e in embudo] == CAMPOS_FORMULARIO
    assert [e['orden'] for e in embudo] == list(range(1, 36))
    assert embudo[0]['bloque'] == 'Identificación'
    assert embudo[-1]['bloque'] == 'Video y CV'
    assert all(e['etapa'] and e['cantidad'] == 0 and e['pct_del_total'] == 0 for e in embudo)


def test_cantidad_es_cuantas_llegaron_y_abandonaron_las_que_se_quedaron_ahi(client, db, hiring_headers):
    _alta(db, hasta='edad')
    _alta(db, hasta='edad')
    _alta(db, hasta='remuneracion')
    _alta(db, hasta='cv', completo=True)

    e = _embudo(client, hiring_headers)

    assert e['nombre']['cantidad'] == 4 and e['nombre']['pct_del_total'] == 100
    assert e['edad']['cantidad'] == 4
    assert e['edad']['abandonaron_aca'] == 2
    assert e['edad']['pct_abandono'] == 50
    # Las dos que cortaron en `edad` ya no llegan a la siguiente.
    assert e['equipo']['cantidad'] == 2
    assert e['equipo']['pct_del_total'] == 50
    assert e['remuneracion']['abandonaron_aca'] == 1
    assert e['remuneracion']['pct_abandono'] == 50
    assert e['experiencia']['cantidad'] == 1
    assert e['cv']['cantidad'] == 1 and e['cv']['abandonaron_aca'] == 0


def test_una_opcional_saltada_no_cuenta_como_abandono(client, db, hiring_headers):
    # Contestó hasta el CV pero se salteó la automatización (opcional) y la
    # de presupuesto de Meta (condicional): llegó a las dos igual.
    campos = {c: 'respuesta' for c in CAMPOS_FORMULARIO if c not in ('automatizacion_ejemplo', 'meta_presupuesto')}
    campos.update(EXCLUYENTES_OK)
    campos['nombre'] = 'Ana'
    db.session.add(AssistantApplication(**campos))
    db.session.commit()

    e = _embudo(client, hiring_headers)

    assert e['automatizacion_ejemplo']['cantidad'] == 1
    assert e['automatizacion_ejemplo']['abandonaron_aca'] == 0
    assert e['meta_presupuesto']['cantidad'] == 1
    assert e['meta_presupuesto']['abandonaron_aca'] == 0
    assert e['automatizacion_ejemplo']['opcional'] is True
    assert e['cv']['abandonaron_aca'] == 1  # sin `completo`, se quedó en la última


def test_completa_llega_a_todas_aunque_le_falte_alguna(client, db, hiring_headers):
    _alta(db, hasta='nombre', completo=True)

    e = _embudo(client, hiring_headers)

    assert all(x['cantidad'] == 1 for x in e.values())
    assert all(x['abandonaron_aca'] == 0 for x in e.values())


def test_las_cortadas_por_el_formulario_se_distinguen_de_las_que_se_fueron(client, db, hiring_headers):
    # El motivo es el texto de la opción excluyente, y sigue elegida (si la hubiera cambiado, el
    # descarte ya no valdría: ver test_hiring_descarte_vigente.py).
    fijo = 'No, necesito un horario fijo y cerrado'
    _alta(db, hasta='horario', horario=fijo, descartado=True, motivo_descarte=fijo)
    _alta(db, hasta='horario')

    e = _embudo(client, hiring_headers)

    assert e['horario']['abandonaron_aca'] == 2
    assert e['horario']['descartadas_aca'] == 1


def test_el_embudo_ignora_el_segmento(client, db, hiring_headers):
    _alta(db, hasta='edad')
    _alta(db, hasta='cv', completo=True, video_verificado='Sí, lo verifiqué')

    todos = _embudo(client, hiring_headers, segmento='todos')
    finalistas = _embudo(client, hiring_headers, segmento='finalistas')

    assert todos == finalistas
    assert todos['nombre']['cantidad'] == 2
