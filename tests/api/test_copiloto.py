"""Learnito en Work: todo el equipo le pregunta al cerebro de la Academia (LearnationService.learnito), que guarda la
conversación y el gasto. Acá: quién entra, qué viaja y cómo vuelven los errores."""
import pytest

from app.services.learnation_service import LearnationAPIError, LearnationService

URL = '/api/copiloto/learnito'
CONFIRMAR = '/api/copiloto/learnito/confirmar'


@pytest.fixture()
def cerebro(monkeypatch):
    llamadas = []

    def _instalar(respuesta=None, error=None):
        def learnito(accion, cuerpo):
            llamadas.append((accion, cuerpo))
            if error:
                raise error
            return respuesta or {'conversacion_id': 5, 'mensaje_indice': 1, 'mensaje': {'text': 'Hola'}, 'uso': {}}
        monkeypatch.setattr(LearnationService, 'learnito', staticmethod(learnito))
        return llamadas
    return _instalar


@pytest.mark.parametrize('rol', ['closer', 'setter', 'triage', 'admin', 'director_marketing'])
def test_todo_el_equipo_pregunta_con_quien_es(client, auth_headers, make_user, cerebro, rol):
    user = make_user(role=rol)
    llamadas = cerebro()

    r = client.post(URL, headers=auth_headers(user), json={'pregunta': '  mis agendas  '})

    assert r.status_code == 200 and r.get_json()['mensaje'] == {'text': 'Hola'}
    accion, cuerpo = llamadas[0]
    assert accion == 'ask' and cuerpo['pregunta'] == 'mis agendas'
    assert cuerpo['quien']['id'] == user.id and cuerpo['quien']['rol'] == rol


def test_fulfillment_no_entra(client, auth_headers, make_user, cerebro):
    llamadas = cerebro()
    r = client.post(URL, headers=auth_headers(make_user(role='fulfillment')), json={'pregunta': 'x'})
    assert r.status_code == 403 and llamadas == []


def test_sin_pregunta_ni_boton(client, auth_headers, make_user, cerebro):
    cerebro()
    assert client.post(URL, headers=auth_headers(make_user()), json={'pregunta': '  '}).status_code == 400


def test_un_error_del_cerebro_vuelve_con_su_mensaje(client, auth_headers, make_user, cerebro):
    cerebro(error=LearnationAPIError('tope', status_code=429,
                                     payload={'codigo': 'tope', 'mensaje': 'Llegaste al tope.'}))
    r = client.post(URL, headers=auth_headers(make_user()), json={'pregunta': 'x'})
    assert r.status_code == 429 and r.get_json()['error'] == 'Llegaste al tope.'


def test_confirmar_pasa_el_texto_o_descarta(client, auth_headers, make_user, cerebro):
    llamadas = cerebro(respuesta={'success': True, 'accion': {'estado': 'hecha'}})
    h = auth_headers(make_user())

    assert client.post(CONFIRMAR, headers=h, json={'conversacion_id': 5}).status_code == 400
    r = client.post(CONFIRMAR, headers=h, json={'conversacion_id': 5, 'mensaje': 1, 'texto': ' Ok '})
    assert r.status_code == 200
    client.post(CONFIRMAR, headers=h, json={'conversacion_id': 5, 'mensaje': 1, 'descartar': True, 'texto': 'x'})

    assert llamadas[0][0] == 'confirm' and llamadas[0][1]['texto'] == 'Ok'
    assert llamadas[1][1]['descartar'] is True and 'texto' not in llamadas[1][1]


def test_para_abrir_otra_hay_que_calificar_las_anteriores(client, auth_headers, make_user, cerebro):
    pendiente = {'id': 9, 'titulo': 'Mis agendas', 'fecha': '2026-10-24T10:00:00Z', 'porcentaje': 20}
    cerebro(error=LearnationAPIError('x', status_code=409, payload={
        'codigo': 'calificar_pendientes', 'mensaje': 'Para empezar otra conversación, calificá las anteriores.',
        'pendientes': [pendiente]}))
    r = client.post(URL, headers=auth_headers(make_user()), json={'pregunta': 'hola'})
    assert r.status_code == 409 and r.get_json()['pendientes'] == [pendiente]


def test_lista_las_pendientes(client, auth_headers, make_user, cerebro):
    llamadas = cerebro(respuesta={'success': True, 'pendientes': [{'id': 9}]})
    r = client.get('/api/copiloto/learnito/pendientes', headers=auth_headers(make_user()))
    assert r.get_json() == {'pendientes': [{'id': 9}]} and llamadas[0][0] == 'pending'


def test_lista_el_historial_y_una_conversacion(client, auth_headers, make_user, cerebro):
    h = auth_headers(make_user())
    llamadas = cerebro(respuesta={'success': True, 'conversaciones': [{'id': 9, 'titulo': 'Mis agendas'}]})
    r = client.get('/api/copiloto/learnito/historial', headers=h)
    assert r.get_json() == {'conversaciones': [{'id': 9, 'titulo': 'Mis agendas'}]} and llamadas[0][0] == 'history'

    llamadas = cerebro(respuesta={'success': True, 'conversacion': {'id': 9, 'mensajes': []}})
    r = client.get('/api/copiloto/learnito/historial/9', headers=h)
    assert r.get_json() == {'conversacion': {'id': 9, 'mensajes': []}}
    assert llamadas[-1][0] == 'conversation' and llamadas[-1][1]['conversacion_id'] == 9


def test_una_conversacion_ajena_no_se_encuentra(client, auth_headers, make_user, cerebro):
    cerebro(error=LearnationAPIError('x', status_code=404, payload={
        'codigo': 'conversacion_no_encontrada', 'mensaje': 'No encontré esa conversación de esa persona.'}))
    r = client.get('/api/copiloto/learnito/historial/77', headers=auth_headers(make_user()))
    assert r.status_code == 404 and 'No encontré' in r.get_json()['error']


def test_una_accion_que_no_se_pudo_hacer_dice_por_que(client, auth_headers, make_user, cerebro):
    cerebro(error=LearnationAPIError('x', status_code=422, payload={
        'codigo': 'pedido_invalido', 'mensaje': 'Pedido inválido.',
        'detalle': ['work no respondió «executeAction»: Esa acción es de otra persona.']}))
    r = client.post(CONFIRMAR, headers=auth_headers(make_user()), json={'conversacion_id': 5, 'mensaje': 1})
    assert r.status_code == 422 and r.get_json()['error'] == 'Esa acción es de otra persona.'
