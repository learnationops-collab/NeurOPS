"""clarity: score 0-100 de una postulacion a Closer, ponderado por criterio.

Cada `_valor_<criterio>` devuelve un float 0-1; `score_de` los combina con pesos que se normalizan
solos. Las postulaciones se simulan con SimpleNamespace (la logica no toca la base).
"""
from types import SimpleNamespace

import pytest

from app.models import CLARITY_CRITERIA
from app.services import clarity

LARGO = clarity.LARGO_COMPLETO
TODAS_LAS_HERRAMIENTAS = list(clarity.HERRAMIENTA_PESO)


def postulacion(**campos):
    base = dict(formacion=None, conocimiento=None, dedicacion=None, cierre=None, ingles=None,
                herramientas=None, video=None, llamada=None, obstaculo=None, objetivos=None)
    base.update(campos)
    return SimpleNamespace(**base)


def postulacion_perfecta():
    return postulacion(
        formacion='x' * LARGO['formacion'], conocimiento='Tengo formación + experiencia',
        dedicacion='x' * LARGO['dedicacion'], cierre=30, ingles='Fluido',
        herramientas=TODAS_LAS_HERRAMIENTAS, video='https://loom.com/a', llamada='https://loom.com/b',
        obstaculo='x' * LARGO['obstaculo'], objetivos='x' * LARGO['objetivos'],
    )


# --- Respuestas abiertas: el largo del texto --------------------------------------------------

@pytest.mark.parametrize('texto,esperado', [
    (None, 0.0), ('', 0.0), ('     ', 0.0),
    ('x' * 140, 0.5),  # la mitad de lo que se considera una respuesta completa (280)
    ('x' * 280, 1.0),
    ('x' * 900, 1.0),  # nunca pasa de 1
    ('   ' + 'x' * 140 + '   ', 0.5),  # los espacios de los bordes no suman
])
def test_una_respuesta_abierta_vale_su_largo_sobre_el_largo_completo(texto, esperado):
    assert clarity._valor_formacion(postulacion(formacion=texto)) == esperado


def test_cada_pregunta_abierta_tiene_su_propio_largo_completo():
    assert clarity._valor_obstaculo(postulacion(obstaculo='x' * LARGO['obstaculo'])) == 1.0
    assert clarity._valor_objetivos(postulacion(objetivos='x' * LARGO['objetivos'])) == 1.0
    assert clarity._valor_obstaculo(postulacion(obstaculo='x' * (LARGO['obstaculo'] // 2))) == 0.5


# --- Experiencia ------------------------------------------------------------------------------

@pytest.mark.parametrize('conocimiento,dedicacion,esperado', [
    ('Tengo formación + experiencia', 'x' * 150, 1.0),  # 1.0*0.8 + 1.0*0.2
    ('Tengo formación + experiencia', None, 0.8),
    ('Tengo experiencia', None, 0.6),  # 0.75*0.8
    ('Tengo formación', None, 0.36),  # 0.45*0.8
    ('algo que no esta en la lista', None, 0.16),  # base 0.2 * 0.8
    (None, None, 0.16),
    ('Tengo experiencia', 'x' * 75, 0.7),  # 0.6 + 0.5*0.2
])
def test_valor_experiencia(conocimiento, dedicacion, esperado):
    assert clarity._valor_experiencia(postulacion(conocimiento=conocimiento, dedicacion=dedicacion)) == esperado


# --- Porcentaje de cierre ---------------------------------------------------------------------

@pytest.mark.parametrize('cierre,esperado', [
    (35, 1.0), (30, 1.0),
    (29.9, 0.75), (20, 0.75),
    (19.9, 0.5), (10, 0.5),
    (9.9, 0.3), (5, 0.3), (0.1, 0.3),
    (0, 0.25), (-5, 0.25),
    ('25', 0.75),  # llega como texto desde el formulario
    (None, 0.25), ('', 0.25), ('nada', 0.25), ('no se', 0.25),
])
def test_valor_cierre(cierre, esperado):
    assert clarity._valor_cierre(postulacion(cierre=cierre)) == esperado


# --- Ingles -----------------------------------------------------------------------------------

@pytest.mark.parametrize('nivel,esperado', [
    ('Fluido', 1.0), ('Intermedio', 0.6), ('Básico', 0.3), ('Nada', 0.0),
    ('Nativo', 0.0), (None, 0.0), ('', 0.0),  # cualquier cosa fuera de la lista vale 0
])
def test_valor_ingles(nivel, esperado):
    assert clarity._valor_ingles(postulacion(ingles=nivel)) == esperado


# --- Herramientas -----------------------------------------------------------------------------

def test_el_peso_maximo_es_la_suma_de_todas_las_herramientas():
    assert clarity.HERRAMIENTA_PESO_MAX == sum(clarity.HERRAMIENTA_PESO.values()) == 14


@pytest.mark.parametrize('herramientas,esperado', [
    (None, 0.0), ([], 0.0),
    (TODAS_LAS_HERRAMIENTAS, 1.0),
    (['CRM (HubSpot, Pipedrive, Close, GoHighLevel, Kommo)'], round(3 / 14, 4)),
    (['Slack / Discord'], round(0.5 / 14, 4)),
    (['Excel'], round(0.5 / 14, 4)),  # una herramienta que no esta en la lista suma el peso minimo
])
def test_valor_herramientas(herramientas, esperado):
    assert clarity._valor_herramientas(postulacion(herramientas=herramientas)) == esperado


def test_las_herramientas_de_valor_pesan_mas_que_las_de_oficina():
    crm = clarity._valor_herramientas(postulacion(herramientas=['CRM (HubSpot, Pipedrive, Close, GoHighLevel, Kommo)']))
    oficina = clarity._valor_herramientas(postulacion(herramientas=['Zoom / Google Meet']))

    assert crm > oficina


def test_las_herramientas_repetidas_nunca_pasan_de_1():
    assert clarity._valor_herramientas(postulacion(herramientas=TODAS_LAS_HERRAMIENTAS * 3)) == 1.0


# --- Video y llamada --------------------------------------------------------------------------

@pytest.mark.parametrize('video,llamada,esperado', [
    ('https://loom.com/a', 'http://loom.com/b', 1.0),
    ('https://loom.com/a', None, 0.5),
    (None, 'https://loom.com/b', 0.5),
    (None, None, 0.0),
    ('loom.com/a', 'www.loom.com/b', 0.0),  # sin http(s):// no es un link
    ('ftp://loom.com/a', '', 0.0),
])
def test_valor_video(video, llamada, esperado):
    assert clarity._valor_video(postulacion(video=video, llamada=llamada)) == esperado


# --- compute_criteria_values ------------------------------------------------------------------

def test_hay_una_regla_por_cada_criterio_del_modelo():
    assert set(clarity.compute_criteria_values(postulacion())) == {c['criterion'] for c in CLARITY_CRITERIA}


@pytest.mark.parametrize('datos', [
    {}, {'cierre': 1_000_000}, {'cierre': -1}, {'herramientas': ['?'] * 50}, {'formacion': 'x' * 10_000},
])
def test_todos_los_valores_quedan_entre_0_y_1(datos):
    valores = clarity.compute_criteria_values(postulacion(**datos))

    assert all(0.0 <= v <= 1.0 for v in valores.values())


# --- score_de ---------------------------------------------------------------------------------

PESOS_POR_DEFECTO = {c['criterion']: c['default_weight'] for c in CLARITY_CRITERIA}


def test_los_pesos_por_defecto_suman_100():
    assert sum(PESOS_POR_DEFECTO.values()) == 100


def test_una_postulacion_perfecta_saca_100():
    assert clarity.score_de(postulacion_perfecta(), PESOS_POR_DEFECTO) == 100


def test_una_postulacion_vacia_saca_muy_poco_pero_no_cero():
    # Solo suman los minimos de "experiencia" (0.16) y "cierre" (0.25): 0.41 / 8 criterios iguales.
    pesos_iguales = {c: 1 for c in PESOS_POR_DEFECTO}

    assert clarity.score_de(postulacion(), pesos_iguales) == round(0.41 / 8 * 100)


def test_un_solo_criterio_con_peso_da_su_valor_en_porcentaje():
    assert clarity.score_de(postulacion(cierre=30), {'cierre': 1}) == 100
    assert clarity.score_de(postulacion(cierre=None), {'cierre': 1}) == 25


def test_los_pesos_se_normalizan_solos():
    app = postulacion(cierre=30, ingles='Nada')

    assert clarity.score_de(app, {'cierre': 3, 'ingles': 1}) == 75
    assert clarity.score_de(app, {'cierre': 300, 'ingles': 100}) == 75  # mismo reparto, otra escala


def test_un_criterio_con_mas_peso_mueve_mas_el_resultado():
    bueno_en_cierre = postulacion(cierre=30, ingles='Nada')

    pesa_cierre = clarity.score_de(bueno_en_cierre, {'cierre': 9, 'ingles': 1})
    pesa_ingles = clarity.score_de(bueno_en_cierre, {'cierre': 1, 'ingles': 9})

    assert pesa_cierre > pesa_ingles


@pytest.mark.parametrize('pesos', [None, {}, {'cierre': 0}, {'cierre': None, 'ingles': 0}])
def test_sin_pesos_utiles_el_score_es_0(pesos):
    assert clarity.score_de(postulacion_perfecta(), pesos) == 0
