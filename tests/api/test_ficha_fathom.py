"""`PATCH /api/ficha/<id>/fathom`: el link de la grabacion de la llamada, y la fuente en la cabecera.

Pedido del 02/10/2026: el closer pega en el resultado de la agenda el link de Fathom (grabacion y
transcripcion en la misma pagina) y la cabecera de la ficha lo abre; ahi mismo tiene que verse la
fuente del lead, que no estaba.

Lo que se fija aca: que el link se guarde solo, sin reportar la llamada, y que se pueda cambiar y
quitar; que lo que no es un link http(s) no llegue a la base (la cabecera lo pone en un `href`);
el permiso, que es el de reportar; y que la lectura de la ficha traiga el link y la fuente.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, LeadEventLog

FATHOM = 'https://fathom.video/share/AbC123xyz'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'admin': make_user(role='admin', username='raiz', email='raiz@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'ajeno': make_user(role='closer', username='ajeno', email='ajeno@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    cliente = Client(full_name='Lucia Paredes', email='lucia@x.com', phone='+51 999 111 222')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=datetime.utcnow() - timedelta(hours=2),
                       origin='workshop_landing')
    db.session.add(appt)
    db.session.commit()
    return appt


def guardar(client, auth_headers, usuario, appt, **datos):
    return client.patch(f'/api/ficha/{appt.id}/fathom', json=datos, headers=auth_headers(usuario))


def leer(client, auth_headers, usuario, appt):
    return client.get(f'/api/ficha/lead?appointment_id={appt.id}',
                      headers=auth_headers(usuario)).get_json()


def eventos(appt):
    return LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='fathom_editado').all()


# --- La columna -------------------------------------------------------------------------------

def test_la_columna_guarda_y_devuelve_el_link(db, lead):
    lead.fathom_url = FATHOM
    db.session.commit()
    db.session.expire_all()

    assert db.session.get(Appointment, lead.id).fathom_url == FATHOM


def test_una_agenda_nueva_no_trae_link(db, lead):
    assert lead.fathom_url is None


# --- Camino feliz -----------------------------------------------------------------------------

def test_el_closer_pega_el_link_sin_reportar_la_llamada(client, db, lead, equipo, auth_headers):
    r = guardar(client, auth_headers, equipo['closer'], lead, fathom_url=f'  {FATHOM} ')

    assert r.status_code == 200, r.get_json()
    assert r.get_json() == {'id': lead.id, 'fathom_url': FATHOM, 'es_fathom': True, 'cambio': True}
    assert lead.fathom_url == FATHOM
    # Guardar el link no es reportar: la llamada sigue en el mazo como estaba.
    assert lead.closer_processed is False
    [evento] = eventos(lead)
    assert evento.user_id == equipo['closer'].id
    assert FATHOM in evento.description


def test_el_link_se_cambia_y_la_bitacora_guarda_el_anterior(client, db, lead, equipo, auth_headers):
    guardar(client, auth_headers, equipo['closer'], lead, fathom_url=FATHOM)
    nuevo = 'https://fathom.video/share/Otro999'
    r = guardar(client, auth_headers, equipo['closer'], lead, fathom_url=nuevo)

    assert r.status_code == 200
    assert lead.fathom_url == nuevo
    ultimo = eventos(lead)[-1]
    assert FATHOM in ultimo.description and nuevo in ultimo.description


@pytest.mark.parametrize('vacio', ['', '   ', None])
def test_un_valor_vacio_quita_el_link(client, db, lead, equipo, auth_headers, vacio):
    lead.fathom_url = FATHOM
    db.session.commit()

    r = guardar(client, auth_headers, equipo['closer'], lead, fathom_url=vacio)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['fathom_url'] is None
    assert lead.fathom_url is None
    assert 'quitó' in eventos(lead)[-1].description


def test_el_mismo_link_no_escribe_nada(client, db, lead, equipo, auth_headers):
    lead.fathom_url = FATHOM
    db.session.commit()

    r = guardar(client, auth_headers, equipo['closer'], lead, fathom_url=FATHOM)

    assert r.get_json()['cambio'] is False
    assert eventos(lead) == []


def test_sin_esquema_se_le_pone_https(client, db, lead, equipo, auth_headers):
    r = guardar(client, auth_headers, equipo['closer'], lead,
                fathom_url='fathom.video/share/AbC123xyz')

    assert r.status_code == 200
    assert lead.fathom_url == FATHOM


def test_un_link_que_no_es_de_fathom_se_guarda_pero_se_avisa(client, db, lead, equipo,
                                                            auth_headers):
    """No se bloquea: si el equipo graba con otra herramienta, el campo sigue sirviendo."""
    r = guardar(client, auth_headers, equipo['closer'], lead,
                fathom_url='https://drive.google.com/file/d/123')

    assert r.status_code == 200
    assert r.get_json()['es_fathom'] is False
    assert lead.fathom_url == 'https://drive.google.com/file/d/123'


# --- Validacion -------------------------------------------------------------------------------

@pytest.mark.parametrize('valor', [
    'grabacion de ayer',
    'javascript:alert(1)',
    'javascript://fathom.video/%0aalert(1)',
    'ftp://fathom.video/share/x',
    'https://fathom',
    'https://[fathom.video',
    'https://fathom.video/share/' + 'x' * 500,
    123,
])
def test_lo_que_no_es_un_link_se_rechaza_sin_tocar_el_guardado(client, db, lead, equipo,
                                                              auth_headers, valor):
    lead.fathom_url = FATHOM
    db.session.commit()

    r = guardar(client, auth_headers, equipo['closer'], lead, fathom_url=valor)

    assert r.status_code == 400, valor
    assert r.get_json()['campo'] == 'fathom_url'
    assert lead.fathom_url == FATHOM
    assert eventos(lead) == []


def test_sin_la_clave_es_un_pedido_mal_hecho(client, db, lead, equipo, auth_headers):
    r = guardar(client, auth_headers, equipo['closer'], lead, otra='cosa')

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'fathom_url'


# --- Permisos ---------------------------------------------------------------------------------

@pytest.mark.parametrize('rol', ['director', 'admin'])
def test_la_direccion_carga_el_link_de_cualquier_agenda(client, db, lead, equipo, auth_headers,
                                                       rol):
    r = guardar(client, auth_headers, equipo[rol], lead, fathom_url=FATHOM)

    assert r.status_code == 200, rol
    assert lead.fathom_url == FATHOM


def test_otro_closer_tambien_puede_como_con_el_reporte(client, db, lead, equipo, auth_headers):
    """El permiso es `reportar`, que cualquier closer tiene sobre cualquier lead (decision del
    usuario, bitacora 05/08/2026): quien cubre a un compañero reporta su llamada y pega su
    grabacion."""
    r = guardar(client, auth_headers, equipo['ajeno'], lead, fathom_url=FATHOM)

    assert r.status_code == 200
    assert eventos(lead)[0].user_id == equipo['ajeno'].id


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_setter_y_triage_no_cargan_el_link(client, db, lead, equipo, auth_headers, rol):
    r = guardar(client, auth_headers, equipo[rol], lead, fathom_url=FATHOM)

    assert r.status_code == 403, rol
    assert r.get_json()['accion'] == 'reportar'
    assert lead.fathom_url is None


def test_una_agenda_que_no_existe_da_404(client, db, equipo, auth_headers):
    r = client.patch('/api/ficha/999999/fathom', json={'fathom_url': FATHOM},
                     headers=auth_headers(equipo['closer']))

    assert r.status_code == 404


def test_un_anonimo_no_entra(client, db, lead):
    r = client.patch(f'/api/ficha/{lead.id}/fathom', json={'fathom_url': FATHOM})

    assert r.status_code in (401, 403)
    assert lead.fathom_url is None


# --- La lectura de la ficha -------------------------------------------------------------------

def test_la_ficha_trae_el_link_y_la_fuente_en_la_identidad(client, db, lead, equipo, auth_headers):
    lead.fathom_url = FATHOM
    db.session.commit()

    identidad = leer(client, auth_headers, equipo['closer'], lead)['identidad']

    assert identidad['fathom_url'] == FATHOM
    # La clave tal cual (la corrige el historial) y como se lee en la cabecera.
    assert identidad['fuente'] == 'workshop_landing'
    assert identidad['fuente_label'] == 'Workshop · grabación'


def test_sin_link_ni_fuente_viajan_en_null(client, db, lead, equipo, auth_headers):
    lead.origin = None
    db.session.commit()

    identidad = leer(client, auth_headers, equipo['closer'], lead)['identidad']

    assert identidad['fathom_url'] is None
    assert identidad['fuente'] is None and identidad['fuente_label'] is None


@pytest.mark.parametrize('origen,etiqueta', [
    ('vsl', 'VSL'),
    ('Paula', 'Paula'),
    ('workshop manychat', 'workshop manychat'),
])
def test_un_setter_o_una_fuente_vieja_se_leen_tal_cual(client, db, lead, equipo, auth_headers,
                                                      origen, etiqueta):
    lead.origin = origen
    db.session.commit()

    assert leer(client, auth_headers, equipo['closer'], lead)['identidad']['fuente_label'] == etiqueta


def test_un_cliente_sin_agenda_no_trae_link_ni_fuente(client, db, equipo, auth_headers):
    cliente = Client(full_name='Solo nombre')
    db.session.add(cliente)
    db.session.commit()

    identidad = client.get(f'/api/ficha/lead?client_id={cliente.id}',
                           headers=auth_headers(equipo['director'])).get_json()['identidad']

    assert identidad['fathom_url'] is None and identidad['fuente_label'] is None
