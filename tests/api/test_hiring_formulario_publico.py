"""El alta pública de Asistente tiene que guardar lo que el formulario REAL manda.

El formulario vive en otro repo (institute-site) y se reescribió: manda `ciudad`
(no `provincia`), `aporte` y `ia_avanzado` como lista. Si el backend descarta
alguno, el embudo y la completitud del panel mienten.
"""
from app.models import AssistantApplication

URL = '/api/public/assistant-applications'


def _post(client, **campos):
    campos.setdefault('dedupe_key', 'k-1')
    campos.setdefault('nombre', 'Ana Pérez')
    return client.post(URL, json=campos)


def test_ciudad_se_guarda_como_provincia(client):
    assert _post(client, pais='🇦🇷  Argentina', ciudad='Salta').status_code == 201

    fila = AssistantApplication.query.one()
    assert fila.provincia == 'Salta'


def test_aporte_se_guarda(client):
    _post(client, aporte='Armo tableros de Notion para equipos de ventas.')

    assert AssistantApplication.query.one().aporte == 'Armo tableros de Notion para equipos de ventas.'


def test_ia_avanzado_multiple_se_guarda_unido_sin_corchetes(client):
    opciones = [
        'Construí herramientas o automatizaciones con IA que después funcionan solas: un dashboard, un script, un flujo conectado con otras aplicaciones',
        'Creé mis propios GPTs o asistentes personalizados para tareas que repito',
    ]
    _post(client, ia_avanzado=opciones)

    guardado = AssistantApplication.query.one().ia_avanzado
    assert guardado == ' | '.join(opciones)
    assert '[' not in guardado and "'" not in guardado


def test_guardado_progresivo_no_borra_lo_ya_contestado(client):
    _post(client, ciudad='Salta', aporte='Algo concreto')
    _post(client, pais='Argentina')

    fila = AssistantApplication.query.one()
    assert AssistantApplication.query.count() == 1
    assert (fila.provincia, fila.aporte) == ('Salta', 'Algo concreto')


def test_las_columnas_del_formulario_actual_existen(app):
    from app.models.assistant_application import CAMPOS_FORMULARIO, CAMPOS_LEGACY

    assert len(CAMPOS_FORMULARIO) == 35
    assert not set(CAMPOS_FORMULARIO) & set(CAMPOS_LEGACY)
    for campo in CAMPOS_FORMULARIO + CAMPOS_LEGACY:
        assert hasattr(AssistantApplication, campo), campo
