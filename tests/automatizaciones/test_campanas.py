"""Campañas: varias palabras clave → un flujo, con vigencia; una palabra se reusa en el tiempo."""
from datetime import timedelta

import pytest

from app.automatizaciones import campanas, servicio
from app.automatizaciones.modelos import AutCampana, AutEjecucion, AutFlujo, IgContacto
from tests.automatizaciones import flujos as f
from tests.automatizaciones.test_motor import T0, Escenario, ms

URL = '/api/inbox/campanas'


def un_mensaje(texto):
    """Un flujo de un solo mensaje, sin disparadores propios (lo dispara la campaña)."""
    return f.guia(disparadores=[{'id': 'd1', 'canal': 'dm', 'palabras': ['NO SE USA'], 'coincidencia': 'exacta'}],
                  inicio='n1', conexiones=[],
                  nodos=[{'id': 'n1', 'tipo': 'mensaje', 'contenido': [{'tipo': 'texto', 'texto': texto}]}])


@pytest.fixture()
def flujo(db):
    def _crear(texto, nombre='Flujo'):
        nuevo = AutFlujo(nombre=nombre, grafo=un_mensaje(texto))
        db.session.add(nuevo)
        db.session.commit()
        assert servicio.publicar(nuevo, momento=T0 - timedelta(days=60)) == []
        return nuevo
    return _crear


@pytest.fixture()
def campana(db):
    def _crear(palabras, flujo=None, desde=T0 - timedelta(days=1), hasta=None, nombre='Campaña'):
        nueva = campanas.guardar(AutCampana(), {'nombre': nombre, 'palabras': palabras, 'desde': desde,
                                                'hasta': hasta, 'flujo_id': flujo.id if flujo else None})
        db.session.add(nueva)
        db.session.commit()
        return nueva
    return _crear


@pytest.fixture()
def lead(db):
    return Escenario()


# --- Ruteo del motor ----------------------------------------------------------------------------

def test_varias_palabras_de_una_campana_llevan_al_mismo_flujo(flujo, campana, lead, db):
    guia = flujo('Te mando la guía')
    nueva = campana(['GUIA', 'Guía MIR'], guia)

    lead.escribe('guia mir')

    assert lead.textos() == ['Te mando la guía']
    ejecucion = lead.ejecucion()
    assert (ejecucion.campana_id, ejecucion.clave) == (nueva.id, 'GUIA MIR')
    assert ejecucion.meta_ad_id is None


def test_el_dm_de_un_anuncio_guarda_de_que_anuncio_vino(flujo, campana, lead):
    campana(['GUÍA PERÚ'], flujo('Te mando la guía'))

    lead.escribe('GUÍA PERÚ', anuncio='120248557350530532')

    assert lead.textos() == ['Te mando la guía']
    assert lead.ejecucion().meta_ad_id == '120248557350530532'


def test_dos_campanas_comparten_un_flujo(flujo, campana, lead):
    guia = flujo('Te mando la guía')
    campana(['APUNTES'], guia, nombre='Orgánico')
    pago = campana(['PDF'], guia, nombre='Pago')

    lead.escribe('PDF')

    assert lead.ejecucion().campana_id == pago.id


def test_la_misma_palabra_significa_otra_cosa_el_mes_siguiente(flujo, campana, lead):
    octubre, noviembre = flujo('Flujo de octubre'), flujo('Flujo de noviembre')
    corte = T0 + timedelta(days=1)
    campana(['EXAMEN'], octubre, desde=T0 - timedelta(days=10), hasta=corte, nombre='Octubre')
    de_noviembre = campana(['EXAMEN'], noviembre, desde=corte, nombre='Noviembre')

    lead.escribe('EXAMEN')
    lead.escribe('EXAMEN', minutos=2 * 24 * 60)

    assert lead.textos() == ['Flujo de octubre', 'Flujo de noviembre']
    assert lead.ejecucion().campana_id == de_noviembre.id


def test_la_campana_manda_sobre_el_disparador_propio_de_otro_flujo(flujo, campana, lead, db):
    viejo = AutFlujo(nombre='Viejo', grafo=f.guia())  # su disparador es «OBTENER GUIA»
    db.session.add(viejo)
    db.session.commit()
    servicio.publicar(viejo, momento=T0 - timedelta(days=60))
    campana(['OBTENER GUIA'], flujo('Nuevo'))

    lead.escribe('Obtener guía')

    assert lead.textos() == ['Nuevo']


def test_fuera_de_vigencia_no_dispara(flujo, campana, lead):
    campana(['EXAMEN'], flujo('x'), desde=T0 - timedelta(days=10), hasta=T0 - timedelta(days=1))

    lead.escribe('EXAMEN')

    assert lead.textos() == []
    assert AutEjecucion.query.count() == 0


def test_sin_flujo_o_con_el_flujo_pausado_no_dispara(flujo, campana, lead, db):
    campana(['SIN FLUJO'])
    pausado = flujo('pausado')
    pausado.estado = AutFlujo.PAUSADO
    db.session.commit()
    campana(['PAUSADO'], pausado)

    lead.escribe('SIN FLUJO')
    lead.escribe('PAUSADO', minutos=1)

    assert lead.textos() == []
    assert AutEjecucion.query.count() == 0


def test_la_palabra_tiene_que_ser_todo_el_mensaje(flujo, campana, lead):
    campana(['GUIA'], flujo('x'))

    lead.escribe('hola quiero la guia')

    assert lead.textos() == []


def test_la_palabra_de_una_campana_pasa_aunque_el_bot_este_pausado(flujo, campana, lead, monkeypatch):
    monkeypatch.setenv('IG_MOTOR_MODO', 'real')
    campana(['GUIA PERU'], flujo('Te mando la guía'))
    lead.escribe('hola')
    lead.llega(f.eco('mensaje de ManyChat o de un setter', 'otro-1', ms(lead.ahora)))
    contacto = IgContacto.query.one()
    assert contacto.bot_pausado_hasta > lead.ahora

    lead.escribe('Guía Perú', minutos=1)

    assert lead.textos() == ['Te mando la guía']
    assert lead.ejecucion().campana_id is not None
    assert contacto.bot_pausado_hasta is None  # el flujo puede seguir con los botones


def test_al_entrar_trae_el_usuario_de_instagram_para_los_tableros(flujo, campana, lead):
    from app.models import ManychatLead
    lead.transporte.perfiles[f.LEAD] = {'username': 'tavo_lev', 'name': 'Gustavo Levano', 'is_user_follow_business': True}
    campana(['GUIA PERU'], flujo('Te mando la guía'))

    lead.escribe('GUÍA PERÚ')

    contacto = IgContacto.query.one()
    assert (contacto.username, contacto.nombre) == ('tavo_lev', 'Gustavo Levano')
    fila = ManychatLead.query.filter_by(manychat_id=f'ig:{f.LEAD}').one()
    assert (fila.ig, fila.name, fila.follower) == ('tavo_lev', 'Gustavo Levano', True)

    # Dejó de seguir: la próxima entrada lo actualiza.
    lead.transporte.perfiles[f.LEAD] = {'username': 'tavo_lev', 'is_user_follow_business': False}
    lead.escribe('MIR', minutos=1)
    lead.escribe('GUIA PERU', minutos=60)
    assert ManychatLead.query.filter_by(manychat_id=f'ig:{f.LEAD}').one().follower is False


def test_con_el_bot_pausado_lo_que_no_es_palabra_de_campana_sigue_ignorado(flujo, campana, lead, monkeypatch):
    monkeypatch.setenv('IG_MOTOR_MODO', 'real')
    campana(['GUIA PERU'], flujo('Te mando la guía'))
    lead.llega(f.eco('hola, soy Elias', 'otro-1', ms(lead.ahora)))

    lead.escribe('quiero la guia peru', minutos=1)

    assert lead.textos() == []
    assert IgContacto.query.one().bot_pausado_hasta > lead.ahora


# --- Reglas de la campaña -------------------------------------------------------------------------

def test_una_palabra_no_puede_estar_en_dos_campanas_que_se_pisan(campana):
    campana(['EXAMEN'], desde=T0, hasta=T0 + timedelta(days=30), nombre='Octubre')

    with pytest.raises(campanas.ErrorDeCampana, match='EXAMEN \\(Octubre\\)'):
        campana(['examen'], desde=T0 + timedelta(days=10), nombre='Otra')
    with pytest.raises(campanas.ErrorDeCampana):
        campana(['EXAMEN'], desde=T0 - timedelta(days=5), hasta=T0 + timedelta(days=1), nombre='Antes')
    campana(['EXAMEN'], desde=T0 + timedelta(days=30), nombre='Noviembre')  # empieza justo cuando termina


def test_editar_una_campana_no_choca_consigo_misma(campana, db):
    propia = campana(['EXAMEN'], desde=T0)
    campanas.guardar(propia, {'hasta': T0 + timedelta(days=3), 'palabras': ['EXAMEN', 'NUEVA']})
    db.session.commit()

    assert sorted(p.clave for p in propia.palabras) == ['EXAMEN', 'NUEVA']


@pytest.mark.parametrize('datos, mensaje', [
    ({'nombre': ''}, 'nombre'),
    ({'embudo': 'tiktok'}, 'embudo'),
    ({'tipo': 'mixto'}, 'tipo'),
    ({'desde': None}, 'inicio'),
    ({'hasta': T0 - timedelta(days=1)}, 'terminar'),
    ({'palabras': ['¿?']}, 'válida'),
    ({'flujo_id': 999}, 'flujo'),
])
def test_valida_antes_de_guardar(db, datos, mensaje):
    with pytest.raises(campanas.ErrorDeCampana, match=mensaje):
        campanas.guardar(AutCampana(), {'nombre': 'X', 'desde': T0, 'palabras': ['A'], **datos})


# --- API ------------------------------------------------------------------------------------------

@pytest.fixture()
def como(make_user, auth_headers):
    gente = {rol: make_user(role=rol) for rol in ('director_comercial', 'setter')}
    return lambda rol: auth_headers(gente[rol])


def test_api_crea_lista_y_rechaza_el_choque(client, como, flujo):
    guia = flujo('x')
    cuerpo = {'nombre': 'Guía MIR octubre', 'embudo': 'setting', 'tipo': 'pago', 'flujo_id': guia.id,
              'desde': '2026-10-01', 'hasta': '2026-11-01T00:00:00Z', 'palabras': ['GUIA MIR', 'Guía'],
              'campanas_meta': ['120200', '120201']}

    creada = client.post(URL, json=cuerpo, headers=como('director_comercial'))
    assert creada.status_code == 201
    assert creada.get_json()['palabras'] == ['GUIA MIR', 'Guía']
    assert creada.get_json()['campanas_meta'] == ['120200', '120201']

    choque = client.post(URL, json={**cuerpo, 'nombre': 'Otra', 'palabras': ['guia']},
                         headers=como('director_comercial'))
    assert choque.status_code == 400
    assert 'GUIA (Guía MIR octubre)' in choque.get_json()['message']

    listado = client.get(URL, headers=como('setter')).get_json()['campanas']
    assert [c['nombre'] for c in listado] == ['Guía MIR octubre']
    assert client.post(URL, json=cuerpo, headers=como('setter')).status_code == 403


def test_api_fecha_invalida_es_400(client, como):
    respuesta = client.post(URL, json={'nombre': 'X', 'desde': 'mañana', 'palabras': ['A']},
                            headers=como('director_comercial'))
    assert respuesta.status_code == 400


def test_api_no_borra_una_campana_por_la_que_entro_gente(client, como, flujo, campana, lead):
    usada = campana(['GUIA'], flujo('x'))
    vacia = campana(['OTRA'])
    lead.escribe('GUIA')

    assert client.delete(f'{URL}/{usada.id}', headers=como('director_comercial')).status_code == 409
    assert client.delete(f'{URL}/{vacia.id}', headers=como('director_comercial')).status_code == 204
