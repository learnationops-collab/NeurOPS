"""POST /api/webhooks/manychat: ManyChat manda aqui cada lead de Instagram (crear o actualizar).

No hay usuario detras: la unica proteccion es el header X-ManyChat-Token contra la variable de entorno
MANYCHAT_WEBHOOK_TOKEN. El token estaba escrito en el codigo (conocido por cualquiera con acceso al
repositorio, imposible de rotar sin desplegar) y ahora, sin la variable, la ruta queda CERRADA (503).
"""
import pytest

from app.models import Lead, Pipeline, PipelineStage

URL = '/api/webhooks/manychat'
TOKEN = 'token-de-manychat-de-prueba-largo-1234'
# Valor que estuvo escrito en el codigo. Ya no vale en ningun caso.
TOKEN_ANTERIOR = 'neur_ops_manychat_secure_token_2026'
LEAD = {'manychat_id': 'mc-100', 'name': 'Ana Gomez'}


@pytest.fixture()
def token_configurado(monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', TOKEN)


def enviar(client, cuerpo=None, token=TOKEN, **extra):
    cabeceras = {'X-ManyChat-Token': token} if token is not None else {}
    return client.post(URL, json=LEAD if cuerpo is None else cuerpo, headers=cabeceras, **extra)


# --- El token ---------------------------------------------------------------------------------

@pytest.mark.parametrize('enviado', [TOKEN, TOKEN_ANTERIOR, None])
def test_sin_la_variable_de_entorno_la_ruta_queda_cerrada(client, enviado):
    respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 503
    assert 'MANYCHAT_WEBHOOK_TOKEN' in respuesta.get_json()['message']
    assert Lead.query.count() == 0


def test_un_token_configurado_demasiado_corto_no_abre_la_puerta(client, monkeypatch):
    monkeypatch.setenv('MANYCHAT_WEBHOOK_TOKEN', 'corto')

    assert enviar(client, token='corto').status_code == 503
    assert Lead.query.count() == 0


@pytest.mark.parametrize('enviado', [None, '', 'mal', TOKEN[:-1], TOKEN + 'x', TOKEN.upper(), 'tokén', TOKEN_ANTERIOR])
def test_un_token_que_no_es_el_configurado_es_401_y_no_crea_nada(client, token_configurado, enviado):
    respuesta = enviar(client, token=enviado)

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'status': 'error', 'message': 'Unauthorized'}
    assert Lead.query.count() == 0


def test_el_token_por_otra_via_no_sirve(client, token_configurado):
    # Solo el header X-ManyChat-Token: ni un Bearer ni el parametro de la URL.
    por_bearer = client.post(URL, json=LEAD, headers={'Authorization': f'Bearer {TOKEN}'})
    por_parametro = client.post(URL, json=LEAD, query_string={'token': TOKEN})

    assert (por_bearer.status_code, por_parametro.status_code) == (401, 401)
    assert Lead.query.count() == 0


# --- El cuerpo --------------------------------------------------------------------------------

def test_un_cuerpo_que_no_es_json_es_400(client, token_configurado):
    respuesta = client.post(URL, data='manychat_id=1', headers={'X-ManyChat-Token': TOKEN})

    assert respuesta.status_code == 400
    assert respuesta.get_json()['message'] == 'Request must be JSON'


@pytest.mark.parametrize('cuerpo', [{'name': 'Ana'}, {'manychat_id': 'mc-1'}, {'manychat_id': '', 'name': 'Ana'}, {}])
def test_faltan_campos_obligatorios_es_400(client, token_configurado, cuerpo):
    respuesta = enviar(client, cuerpo)

    assert respuesta.status_code == 400
    assert 'manychat_id, name' in respuesta.get_json()['message']
    assert Lead.query.count() == 0


# --- Crear ------------------------------------------------------------------------------------

def test_crea_un_lead_nuevo_en_la_etapa_entrante(client, token_configurado):
    respuesta = enviar(client, {**LEAD, 'email': 'ana@x.com', 'instagram_username': 'ana.g', 'funnel_step': 'paso-2',
                                'last_stage': 3, 'tags': ['vsl'], 'coment': 'pidio info'})

    assert respuesta.status_code == 201
    cuerpo = respuesta.get_json()
    assert (cuerpo['status'], cuerpo['action']) == ('success', 'created')
    assert cuerpo['lead']['manychat_id'] == 'mc-100'
    lead = Lead.query.one()
    assert (lead.name, lead.email, lead.instagram_username) == ('Ana Gomez', 'ana@x.com', 'ana.g')
    assert (lead.funnel_step, lead.last_stage, lead.tags, lead.notes) == ('paso-2', 3, ['vsl'], 'pidio info')
    assert (lead.stage.name, lead.stage.pipeline.name, lead.stage.is_active) == ('Entrante', 'General', True)


def test_la_etapa_entrante_se_crea_una_sola_vez(client, token_configurado):
    enviar(client, LEAD)
    enviar(client, {'manychat_id': 'mc-101', 'name': 'Beto Ruiz'})

    assert (Pipeline.query.count(), PipelineStage.query.count(), Lead.query.count()) == (1, 1, 2)
    assert len({lead.stage_id for lead in Lead.query.all()}) == 1


def test_la_palabra_clave_llena_el_origen_y_deja_una_etiqueta(client, token_configurado):
    enviar(client, {**LEAD, 'keyword': 'MASTERCLASS'})

    lead = Lead.query.one()
    assert lead.ad_source == 'MASTERCLASS'
    assert lead.tags == ['kw:MASTERCLASS']


def test_un_origen_explicito_gana_a_la_palabra_clave(client, token_configurado):
    enviar(client, {**LEAD, 'keyword': 'MASTERCLASS', 'ad_source': 'reel-septiembre'})

    assert Lead.query.one().ad_source == 'reel-septiembre'


def test_el_comentario_tambien_puede_llegar_como_notes(client, token_configurado):
    enviar(client, {**LEAD, 'notes': 'nota directa'})

    assert Lead.query.one().notes == 'nota directa'


# --- Actualizar -------------------------------------------------------------------------------

def test_el_mismo_manychat_id_actualiza_al_lead_y_no_lo_duplica(client, token_configurado):
    enviar(client, {**LEAD, 'email': 'ana@x.com', 'ad_source': 'reel'})

    respuesta = enviar(client, {**LEAD, 'name': 'Ana G. Gomez', 'funnel_step': 'paso-5', 'last_stage': '4'})

    assert respuesta.status_code == 200
    assert respuesta.get_json()['action'] == 'updated'
    lead = Lead.query.one()
    assert (lead.name, lead.funnel_step, lead.last_stage) == ('Ana G. Gomez', 'paso-5', 4)
    assert lead.email == 'ana@x.com'  # solo se actualiza lo que viene en el payload
    assert lead.ad_source == 'reel'


def test_al_actualizar_la_palabra_clave_no_pisa_un_origen_existente_pero_si_llena_uno_vacio(client, token_configurado):
    enviar(client, {**LEAD, 'ad_source': 'reel'})
    enviar(client, {**LEAD, 'keyword': 'OTRA'})
    assert Lead.query.one().ad_source == 'reel'

    enviar(client, {'manychat_id': 'mc-200', 'name': 'Beto'})
    enviar(client, {'manychat_id': 'mc-200', 'name': 'Beto', 'keyword': 'NUEVA'})

    assert Lead.query.filter_by(manychat_id='mc-200').one().ad_source == 'NUEVA'


def test_al_actualizar_las_etiquetas_se_reemplazan_y_se_agrega_la_de_la_palabra_clave(client, token_configurado):
    enviar(client, {**LEAD, 'tags': ['a']})

    enviar(client, {**LEAD, 'tags': ['b'], 'keyword': 'K'})
    enviar(client, {**LEAD, 'keyword': 'K'})  # repetir la palabra clave no duplica la etiqueta

    assert Lead.query.one().tags == ['b', 'kw:K']
