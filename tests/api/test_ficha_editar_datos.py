"""`PATCH /api/ficha/<id>/datos`: corregir los datos del cliente desde la ficha del lead.

Hasta ahora el lapiz de la cabecera solo existia en el mazo del closer, y abria un modal que
pegaba contra `PATCH /closer/customers/<id>`: la direccion comercial recibia 403 y desde Revisar
nadie tenia como arreglar un nombre mal escrito. Esta es la misma correccion, con la misma
normalizacion, por la puerta de la ficha.

Lo que se fija aca, ademas del camino feliz y el permiso: que un correo invalido se rechace en vez
de guardarse vacio, que un contacto que ya es de OTRO cliente no se guarde callado (el cruce de
`create_or_update_client` los fusionaria en la proxima agenda), y que corregirle el correo a quien
ya compro no le haga perder sus ventas.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, FinancialSale, LeadEventLog


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
    cliente = Client(full_name='Jesus Capuchino', email='jesus@x.com', instagram='jesus.c',
                     phone='+52 55 1234 5678')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=datetime.utcnow() + timedelta(days=1),
                       origin='vsl', examen=None)
    db.session.add(appt)
    db.session.commit()
    return appt


def editar(client, auth_headers, usuario, appt, **datos):
    return client.patch(f'/api/ficha/{appt.id}/datos', json=datos, headers=auth_headers(usuario))


def otro_cliente(db, **campos):
    otro = Client(full_name=campos.pop('full_name', 'Maria Lopez'), **campos)
    db.session.add(otro)
    db.session.commit()
    return otro


def eventos(appt):
    return LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='datos_editados').all()


# --- Camino feliz -----------------------------------------------------------------------------

def test_el_closer_del_lead_corrige_los_datos_y_queda_en_la_bitacora(client, db, lead, equipo,
                                                                     auth_headers):
    r = editar(client, auth_headers, equipo['closer'], lead,
               nombre='  Jesus Armando Capuchino Mijares ', telefono='+52 55 8765 4321',
               email='Jesus.Armando@X.com', instagram='@jesus.armando', examen=' ENARM ')

    assert r.status_code == 200, r.get_json()
    cliente = lead.client
    # La misma normalizacion que `update_client`: correo en minusculas, instagram sin la arroba.
    assert (cliente.full_name, cliente.phone, cliente.email, cliente.instagram) == (
        'Jesus Armando Capuchino Mijares', '+52 55 8765 4321', 'jesus.armando@x.com', 'jesus.armando')
    assert lead.examen == 'ENARM'
    assert r.get_json()['cambios']['email'] == 'jesus.armando@x.com'

    [evento] = eventos(lead)
    assert evento.user_id == equipo['closer'].id
    assert "correo: 'jesus@x.com' → 'jesus.armando@x.com'" in evento.description
    assert "examen: vacío → 'ENARM'" in evento.description


def test_la_direccion_comercial_corrige_cualquier_lead(client, db, lead, equipo, auth_headers):
    """El motivo del cambio: por `/closer/customers` la direccion recibia 403."""
    for rol in ('director', 'admin'):
        r = editar(client, auth_headers, equipo[rol], lead, nombre=f'Jesus ({rol})')
        assert r.status_code == 200, rol

    assert lead.client.full_name == 'Jesus (admin)'


def test_solo_cuenta_lo_que_cambio(client, db, lead, equipo, auth_headers):
    """Mandar un campo igual al guardado —o igual despues de normalizar— no es un cambio."""
    r = editar(client, auth_headers, equipo['closer'], lead,
               nombre='Jesus Capuchino', instagram='@jesus.c', telefono='+52 55 1234 0000')

    assert r.get_json()['cambios'] == {'telefono': '+52 55 1234 0000'}
    [evento] = eventos(lead)
    assert 'teléfono' in evento.description
    assert 'nombre' not in evento.description and 'instagram' not in evento.description


def test_sin_cambios_no_escribe_nada_en_la_bitacora(client, db, lead, equipo, auth_headers):
    r = editar(client, auth_headers, equipo['closer'], lead, nombre='Jesus Capuchino')

    assert r.status_code == 200
    assert r.get_json()['cambios'] == {}
    assert eventos(lead) == []


def test_un_correo_vacio_borra_el_correo(client, db, lead, equipo, auth_headers):
    r = editar(client, auth_headers, equipo['closer'], lead, email='')

    assert r.status_code == 200
    assert lead.client.email is None


# --- Permisos ---------------------------------------------------------------------------------

def test_un_closer_corrige_tambien_el_lead_de_otro_closer(client, db, lead, equipo, auth_headers):
    """Decision explicita del usuario (bitacora, 5/08/2026): cualquier closer edita cualquier
    lead. Es lo que ya dejaba el lapiz del mazo, y lo que necesita quien cubre a un companero o
    trabaja un huerfano del pool de cobro."""
    r = editar(client, auth_headers, equipo['ajeno'], lead, nombre='Jesus Armando Capuchino')

    assert r.status_code == 200, r.get_json()
    assert lead.client.full_name == 'Jesus Armando Capuchino'
    [evento] = eventos(lead)
    assert evento.user_id == equipo['ajeno'].id


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_un_setter_y_triage_no_corrigen(client, db, lead, equipo, auth_headers, rol):
    """El setter de ESTE lead tampoco: confirma su agenda, pero los datos no son suyos."""
    r = editar(client, auth_headers, equipo[rol], lead, nombre='Otro nombre')

    assert r.status_code == 403, rol
    assert r.get_json()['accion'] == 'editar_datos'
    assert 'corregir los datos del cliente' in r.get_json()['message']
    assert lead.client.full_name == 'Jesus Capuchino'


def test_la_lectura_le_dice_al_frontend_quien_ve_el_lapiz(client, db, lead, equipo, auth_headers):
    def permiso(usuario):
        return client.get(f'/api/ficha/lead?appointment_id={lead.id}',
                          headers=auth_headers(usuario)).get_json()['permisos']['editar_datos']

    assert permiso(equipo['closer']) is True
    assert permiso(equipo['director']) is True
    assert permiso(equipo['ajeno']) is True
    assert permiso(equipo['setter']) is False


# --- Validacion -------------------------------------------------------------------------------

@pytest.mark.parametrize('correo', ['jesus.gmail.com', 'jesus@gmail', 'jesus @gmail.com'])
def test_un_correo_invalido_se_rechaza_y_no_se_guarda_nada(client, db, lead, equipo, auth_headers,
                                                          correo):
    """`update_client` lo guardaria VACIO callado. Aca se rechaza, y el nombre que viajaba en el
    mismo pedido tampoco se guarda: se valida todo antes de escribir."""
    r = editar(client, auth_headers, equipo['closer'], lead, nombre='Nuevo', email=correo)

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'email'
    assert 'no es un correo válido' in r.get_json()['message']
    assert (lead.client.email, lead.client.full_name) == ('jesus@x.com', 'Jesus Capuchino')


@pytest.mark.parametrize('datos,campo', [
    ({'nombre': '   '}, 'nombre'),
    ({'telefono': 'no tiene'}, 'telefono'),
    ({'telefono': '1' * 21}, 'telefono'),
    ({'nombre': 123}, 'nombre'),
])
def test_los_demas_datos_invalidos_dicen_cual_es(client, db, lead, equipo, auth_headers, datos,
                                                 campo):
    r = editar(client, auth_headers, equipo['closer'], lead, **datos)

    assert r.status_code == 400
    assert r.get_json()['campo'] == campo


def test_un_pedido_vacio_es_un_pedido_mal_hecho(client, db, lead, equipo, auth_headers):
    assert editar(client, auth_headers, equipo['closer'], lead).status_code == 400


# --- Choques con otro cliente -----------------------------------------------------------------

def test_un_correo_que_ya_es_de_otro_cliente_no_se_fusiona_callado(client, db, lead, equipo,
                                                                   auth_headers):
    otra = otro_cliente(db, email='maria@x.com')

    r = editar(client, auth_headers, equipo['closer'], lead, email='MARIA@x.com', nombre='Nuevo')

    assert r.status_code == 409
    cuerpo = r.get_json()
    assert cuerpo['campo'] == 'email'
    assert cuerpo['choque'] == {'id': otra.id, 'nombre': 'Maria Lopez'}
    assert 'Maria Lopez' in cuerpo['message']
    assert (lead.client.email, lead.client.full_name) == ('jesus@x.com', 'Jesus Capuchino')
    assert eventos(lead) == []


def test_un_instagram_que_ya_es_de_otro_cliente_tampoco(client, db, lead, equipo, auth_headers):
    otro_cliente(db, instagram='@Maria.L')

    r = editar(client, auth_headers, equipo['closer'], lead, instagram='maria.l')

    assert r.status_code == 409
    assert r.get_json()['campo'] == 'instagram'


def test_el_telefono_choca_por_los_ultimos_8_digitos_aunque_este_escrito_distinto(
        client, db, lead, equipo, auth_headers):
    otro_cliente(db, phone='591-7123 4567')

    r = editar(client, auth_headers, equipo['closer'], lead, telefono='+591 71234567')

    assert r.status_code == 409
    assert r.get_json()['campo'] == 'telefono'
    assert lead.client.phone == '+52 55 1234 5678'


def test_el_propio_correo_escrito_distinto_no_es_un_choque(client, db, lead, equipo, auth_headers):
    r = editar(client, auth_headers, equipo['closer'], lead, email='JESUS@X.COM',
               telefono='55-1234-5678')

    assert r.status_code == 200


# --- La fuente --------------------------------------------------------------------------------

def test_la_fuente_se_corrige_desde_la_cabecera_y_queda_en_la_bitacora(client, db, lead, equipo,
                                                                       auth_headers):
    """Pedido del 09/10/2026: «al darle en editar en el modal no puedo modificar la fuente del
    lead». Es la misma correccion que la del historial: un embudo no es de ningun setter."""
    r = editar(client, auth_headers, equipo['closer'], lead, fuente='workshop')

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == {'fuente': 'workshop'}
    assert (lead.origin, lead.setter_id) == ('workshop', None)
    [evento] = eventos(lead)
    assert "fuente: 'vsl' → 'workshop'" in evento.description

    ficha = client.get(f'/api/ficha/lead?appointment_id={lead.id}',
                       headers=auth_headers(equipo['closer'])).get_json()
    assert ficha['identidad']['fuente_label'] == 'Workshop'


@pytest.mark.parametrize('fuente', ['workshop_landing', 'setting', 'Desconocido'])
def test_las_fuentes_que_la_ficha_no_ofrece_no_se_eligen_pero_se_conservan(
        client, db, lead, equipo, auth_headers, fuente):
    """Pedido del 09/10/2026: la grabación del workshop, el setting sin setter y «Desconocido» ya
    no se ofrecen. Siguen en el catálogo del Tablero, así que una agenda que ya tiene una (la pone
    el sync con n8n) la conserva al corregirle otro dato."""
    r = editar(client, auth_headers, equipo['closer'], lead, fuente=fuente)
    assert r.status_code == 400
    assert r.get_json()['campo'] == 'fuente'
    assert lead.origin == 'vsl'

    lead.origin = fuente
    db.session.commit()
    r = editar(client, auth_headers, equipo['closer'], lead, fuente=fuente, telefono='+52 55 1234 0000')
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == {'telefono': '+52 55 1234 0000'}
    assert lead.origin == fuente


def test_una_fuente_que_es_un_setter_le_atribuye_la_agenda(client, db, lead, equipo, make_user,
                                                          auth_headers):
    """La regla de la edicion masiva del Tablero, que su sync vuelve a aplicar cada vez que corre."""
    paula = make_user(role='setter', username='Paula', email='paula@neuro.com')

    r = editar(client, auth_headers, equipo['director'], lead, fuente='Paula')

    assert r.status_code == 200, r.get_json()
    assert (lead.origin, lead.setter_id) == ('Paula', paula.id)


def test_una_fuente_fuera_del_catalogo_se_rechaza_y_no_se_guarda_nada(client, db, lead, equipo,
                                                                      auth_headers):
    r = editar(client, auth_headers, equipo['closer'], lead, nombre='Nuevo',
               fuente='Instagram orgánico')

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'fuente'
    assert 'catálogo' in r.get_json()['message']
    assert (lead.origin, lead.client.full_name) == ('vsl', 'Jesus Capuchino')
    assert eventos(lead) == []


def test_la_fuente_de_la_cita_ancla_se_conserva_si_no_se_toca_y_se_cambia_por_una_del_catalogo(
        client, db, lead, equipo, auth_headers):
    """La cabecera de un cliente que compró sin agenda dice «Venta histórica sin agenda»: es la
    fuente de la cita ancla (`_ensure_appointment_for_client`), fuera del catálogo. Mandarla igual
    no es un cambio ni un error; reemplazarla por la de verdad, sí se puede."""
    lead.origin = 'Venta histórica sin agenda'
    db.session.commit()

    r = editar(client, auth_headers, equipo['closer'], lead,
               fuente='Venta histórica sin agenda', telefono='+52 55 1234 0000')
    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == {'telefono': '+52 55 1234 0000'}

    r = editar(client, auth_headers, equipo['closer'], lead, fuente='vsl')
    assert r.get_json()['cambios'] == {'fuente': 'vsl'}
    assert lead.origin == 'vsl'


# --- Sin cliente ------------------------------------------------------------------------------

def test_una_agenda_sin_cliente_lo_dice_y_el_examen_se_corrige_igual(client, db, lead, equipo,
                                                                    auth_headers):
    """No deberia pasar (`client_id` es obligatorio), pero una agenda huerfana de un cliente
    borrado a mano no puede terminar en un 500. El examen es de la agenda: ese si se guarda."""
    lead.client_id = 999999
    db.session.commit()
    db.session.expire(lead)

    r = editar(client, auth_headers, equipo['director'], lead, nombre='Alguien')
    assert r.status_code == 400
    assert 'no tiene cliente' in r.get_json()['message']

    r = editar(client, auth_headers, equipo['director'], lead, examen='MIR')
    assert r.status_code == 200
    assert lead.examen == 'MIR'


# --- Las ventas no se pierden -----------------------------------------------------------------



def _venta(db, **campos):
    venta = FinancialSale(tipo_pago=campos.pop('tipo_pago', 'RR - Parcial'), monto=100,
                          estado='Completada', date=datetime(2026, 9, 1), **campos)
    db.session.add(venta)
    db.session.commit()
    return venta






# --- Instagram de relleno ---------------------------------------------------------------------

@pytest.mark.parametrize('relleno', ['No tengo', '.', '-', 'no', '@ninguno'])
def test_un_instagram_de_relleno_se_guarda_vacio_y_no_choca_con_otro_relleno(
        client, db, lead, equipo, auth_headers, relleno):
    """'no tengo' o '.' quieren decir "no tiene". Guardados, chocaban con el otro cliente que puso
    lo mismo ("ese instagram ya es de otro cliente") y se cruzaban con sus ventas."""
    otro_cliente(db, instagram=relleno.lstrip('@').lower())

    r = editar(client, auth_headers, equipo['closer'], lead, instagram=relleno)

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['cambios'] == {'instagram': None}
    assert lead.client.instagram is None




# --- Las pantallas que cruzan en lote siguen viendo la venta ----------------------------------

