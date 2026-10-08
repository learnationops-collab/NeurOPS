"""El país llega con la bandera de la opción («🇦🇷  Argentina») y hay filas guardadas así.

Se limpia al guardar y al leer (sin migrar): si no, una postulación de Salta con bandera
quedaba como online y la matriz de países del panel no la contaba.
"""
import pytest

from app.models import AssistantApplication
from app.models.assistant_application import pais_limpio


@pytest.mark.parametrize('crudo, limpio', [
    ('🇻🇪  Venezuela', 'Venezuela'),
    ('🇦🇷  Argentina', 'Argentina'),
    ('🇧🇷Brasil', 'Brasil'),
    ('Argentina', 'Argentina'),
    ('  🇦🇷   Costa   Rica ', 'Costa Rica'),
    ('🇦🇷', None),
    ('', ''),
    (None, None),
])
def test_pais_limpio(crudo, limpio):
    assert pais_limpio(crudo) == limpio


def test_el_alta_lo_guarda_sin_bandera(client):
    client.post('/api/public/assistant-applications', json={'dedupe_key': 'k', 'nombre': 'Ana', 'pais': '🇧🇷  Brasil'})

    assert AssistantApplication.query.one().pais == 'Brasil'


def test_una_fila_vieja_con_bandera_es_hibrida_y_sale_limpia():
    fila = AssistantApplication(nombre='Ana', pais='🇦🇷  Argentina', provincia='Salta')

    assert fila.modalidad() == 'hibrido'
    assert fila.to_dict(include_respuestas=True)['pais'] == 'Argentina'
    assert AssistantApplication(nombre='B', pais='🇧🇷  Brasil', provincia='Paraná').modalidad() == 'hibrido'


def test_las_estadisticas_juntan_con_y_sin_bandera(client, db, make_user, auth_headers):
    db.session.add_all([
        AssistantApplication(nombre='A', pais='🇻🇪  Venezuela', completo=True),
        AssistantApplication(nombre='B', pais='Venezuela', completo=True),
        AssistantApplication(nombre='C', pais='🇦🇷  Argentina', completo=True),
    ])
    db.session.commit()

    stats = client.get('/api/assistant-applications/stats',
                       headers=auth_headers(make_user(role='hiring'))).get_json()

    assert {p['pais']: p['cantidad'] for p in stats['comparacion']['paises']} == \
        {'Argentina': 1, 'Venezuela': 2, 'Brasil': 0}
    fila_postulaciones = next(f for f in stats['comparacion']['filas'] if f.get('label') == 'Postulaciones')
    assert fila_postulaciones['valores'] == [1, 2, 0]
    assert {d['opcion']: d['cantidad'] for d in stats['distribucion_pais']} == {'Venezuela': 2, 'Argentina': 1}
