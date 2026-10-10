"""«Agregar objeción» en el historial de la ficha: `POST /ficha/<id>/objecion`.

Pedido de Kerwin (09/10/2026): desde ese día la objeción es obligatoria al reportar «No cerró», y el
historial ofrece agregársela a las llamadas que se reportaron antes. Cada agenda del historial dice
cuál es su objeción vigente y si se le puede agregar una (asistió y no cerró, con la misma cuenta que
la ficha usa para su post call y su hito de Cierre). La escritura es la del contrato de
`objeciones_service`: la fila de `lead_event_logs` y la nota en Comunicación.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, ClientComment, FinancialSale, LeadEventLog
from app.services import objeciones_service

AHORA = datetime.utcnow().replace(microsecond=0)


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'relevo': make_user(role='closer', username='relevo', email='relevo@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
        'triage': make_user(role='triage', username='triaje', email='triaje@neuro.com'),
    }


@pytest.fixture()
def cliente(db):
    c = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', phone='+59171234567')
    db.session.add(c)
    db.session.commit()
    return c


@pytest.fixture()
def agenda(db, equipo, cliente):
    """agenda(dias_atras, **columnas) -> una llamada del cliente, del closer `vendedor`."""
    def _crear(dias_atras=10, **columnas):
        columnas.setdefault('closer_processed', True)
        appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                           client_id=cliente.id, start_time=AHORA - timedelta(days=dias_atras),
                           origin='vsl', **columnas)
        db.session.add(appt)
        db.session.commit()
        return appt
    return _crear


def vender(db, tipo):
    db.session.add(FinancialSale(mail_cliente='ana@x.com', nombre_cliente='Ana Gomez',
                                 tipo_pago=tipo, monto=500, estado='Completada',
                                 date=AHORA - timedelta(days=1), email_vendedor='vendedor@neuro.com'))
    db.session.commit()


def leer_agendas(client, auth_headers, usuario, appt):
    r = client.get(f'/api/ficha/lead?appointment_id={appt.id}', headers=auth_headers(usuario))
    assert r.status_code == 200
    return {a['id']: a for a in r.get_json()['historial']['agendas']}


def agregar(client, auth_headers, usuario, appt, texto='Lo tiene que hablar con su pareja'):
    return client.post(f'/api/ficha/{appt.id}/objecion', json={'texto': texto},
                       headers=auth_headers(usuario))


def objeciones(appt):
    return LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='objecion').all()


# --- La lectura: qué agenda admite objeción ---------------------------------------------------

def test_cada_agenda_dice_si_admite_objecion(client, db, equipo, agenda, auth_headers):
    asistio = agenda(10, closer_result='Show up', offer_presented=True)
    sin_dato = agenda(20, closer_result='Show up')  # carga vieja: nadie tildó la oferta
    sin_oferta = agenda(30, closer_result='Show up', offer_presented=False)
    no_show = agenda(40, closer_result='No Show')
    perdido = agenda(50, closer_result='Lead Perdido', offer_presented=True)
    perdido_sin_oferta = agenda(60, closer_result='Lead Perdido')
    proxima = agenda(-2, closer_result='Pendiente', closer_processed=False)

    agendas = leer_agendas(client, auth_headers, equipo['closer'], asistio)

    assert {a.id: agendas[a.id]['admite_objecion'] for a in (
        asistio, sin_dato, sin_oferta, no_show, perdido, perdido_sin_oferta, proxima)} == {
        asistio.id: True, sin_dato.id: True, sin_oferta.id: False, no_show.id: False,
        # «No cerró → Lead perdido» del árbol: vio la oferta y no la tomó.
        perdido.id: True, perdido_sin_oferta.id: False, proxima.id: False}
    assert all(a['objecion'] is None for a in agendas.values())


@pytest.mark.parametrize('tipo', ['RR - Completo', 'RR - Parcial', 'RR - Seña'])
def test_un_cliente_que_compro_o_dejo_sena_no_tiene_llamadas_sin_cerrar(client, db, equipo,
                                                                         agenda, auth_headers,
                                                                         tipo):
    """La misma cuenta del hito de Cierre: la venta no guarda de qué agenda salió."""
    appt = agenda(10, closer_result='Show up', offer_presented=True)
    vender(db, tipo)

    assert leer_agendas(client, auth_headers, equipo['closer'], appt)[appt.id]['admite_objecion'] is False


def test_la_lectura_trae_la_objecion_vigente_de_cada_agenda(client, db, equipo, agenda, auth_headers):
    vieja = agenda(30, closer_result='Show up', offer_presented=True)
    nueva = agenda(5, closer_result='Show up', offer_presented=True)
    objeciones_service.registrar_objecion(vieja, equipo['closer'], 'Primera versión de la objeción')
    objeciones_service.registrar_objecion(vieja, equipo['relevo'], 'No le da el presupuesto este mes')
    db.session.commit()

    agendas = leer_agendas(client, auth_headers, equipo['director'], nueva)

    assert agendas[nueva.id]['objecion'] is None
    assert agendas[vieja.id]['objecion']['texto'] == 'No le da el presupuesto este mes'
    assert agendas[vieja.id]['objecion']['autor'] == 'relevo'


# --- Agregarla --------------------------------------------------------------------------------

def test_agregar_una_objecion_a_una_llamada_vieja(client, db, equipo, agenda, auth_headers):
    appt = agenda(10, closer_result='Show up', offer_presented=True)
    appt.start_time = datetime(2026, 9, 20, 18, 0)  # las 14:00 en La Paz
    db.session.commit()

    r = agregar(client, auth_headers, equipo['closer'], appt, '  Lo tiene que hablar con su pareja  ')

    assert r.status_code == 201, r.get_json()
    assert r.get_json()['objecion']['texto'] == 'Lo tiene que hablar con su pareja'
    [fila] = objeciones(appt)
    assert (fila.user_id, fila.description) == (equipo['closer'].id, 'Lo tiene que hablar con su pareja')
    assert [c.text for c in ClientComment.query.filter_by(client_id=appt.client_id)] == [
        'Objeción de la llamada del 20/09/2026 (no cerró): Lo tiene que hablar con su pareja']


def test_va_a_la_agenda_de_la_url_y_no_a_la_que_abrio_la_ficha(client, db, equipo, agenda,
                                                               auth_headers):
    vieja = agenda(30, closer_result='Show up', offer_presented=True)
    agenda(1, closer_result='Show up', offer_presented=True)

    agregar(client, auth_headers, equipo['closer'], vieja)

    assert [f.appointment_id for f in LeadEventLog.query.filter_by(action_type='objecion')] == [vieja.id]


def test_volver_a_agregarla_la_reemplaza(client, db, equipo, agenda, auth_headers):
    appt = agenda(10, closer_result='Show up', offer_presented=True)
    agregar(client, auth_headers, equipo['closer'], appt, 'Primera versión de la objeción')

    r = agregar(client, auth_headers, equipo['director'], appt, 'Quiere empezar el año que viene')

    assert r.status_code == 201
    assert objeciones_service.objeciones_por_agenda([appt.id])[appt.id] == r.get_json()['objecion']
    assert r.get_json()['objecion']['autor'] == 'direccion'
    notas = [c.text for c in ClientComment.query.order_by(ClientComment.id)]
    assert notas[-1].startswith('Objeción actualizada')


def test_una_objecion_ya_cargada_se_corrige_aunque_el_cliente_haya_comprado(client, db, equipo,
                                                                           agenda, auth_headers):
    """La renovación que no cerró de alguien que ya compró la deja el reporte de la llamada."""
    appt = agenda(10, closer_result='Show up', offer_presented=True)
    objeciones_service.registrar_objecion(appt, equipo['closer'], 'No quiere renovar todavía')
    db.session.commit()
    vender(db, 'RR - Completo')

    r = agregar(client, auth_headers, equipo['closer'], appt, 'No quiere renovar hasta marzo')

    assert r.status_code == 201
    assert len(objeciones(appt)) == 2


# --- Lo que no se puede ------------------------------------------------------------------------

@pytest.mark.parametrize('texto', [None, '', '   ', 'Es caro'])
def test_sin_texto_suficiente_no_se_guarda(client, db, equipo, agenda, auth_headers, texto):
    appt = agenda(10, closer_result='Show up', offer_presented=True)

    r = agregar(client, auth_headers, equipo['closer'], appt, texto)

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'texto'
    assert objeciones(appt) == [] and ClientComment.query.count() == 0


@pytest.mark.parametrize('columnas', [
    {'closer_result': 'No Show'},
    {'closer_result': 'Show up', 'offer_presented': False},
    {'closer_result': 'Cancelado'},
])
def test_una_llamada_que_no_se_presento_y_no_cerro_no_lleva_objecion(client, db, equipo, agenda,
                                                                     auth_headers, columnas):
    appt = agenda(10, **columnas)

    r = agregar(client, auth_headers, equipo['closer'], appt)

    assert r.status_code == 400
    assert objeciones(appt) == [] and ClientComment.query.count() == 0


def test_si_el_cliente_ya_compro_no_se_agrega(client, db, equipo, agenda, auth_headers):
    appt = agenda(10, closer_result='Show up', offer_presented=True)
    vender(db, 'RR - Parcial')

    r = agregar(client, auth_headers, equipo['closer'], appt)

    assert r.status_code == 400
    assert objeciones(appt) == []


def test_cualquier_closer_y_la_direccion_la_agregan(client, db, equipo, agenda, auth_headers):
    """Mismo permiso que reportar: el `relevo` no es el closer de la agenda y puede igual."""
    appt = agenda(10, closer_result='Show up', offer_presented=True)

    assert agregar(client, auth_headers, equipo['relevo'], appt).status_code == 201
    assert agregar(client, auth_headers, equipo['director'], appt).status_code == 201


@pytest.mark.parametrize('rol', ['setter', 'triage'])
def test_setter_y_triage_no_agregan_objeciones(client, db, equipo, agenda, auth_headers, rol):
    appt = agenda(10, closer_result='Show up', offer_presented=True)

    r = agregar(client, auth_headers, equipo[rol], appt)

    assert r.status_code == 403
    assert objeciones(appt) == []


def test_una_agenda_que_no_existe_da_404(client, db, equipo, auth_headers):
    r = client.post('/api/ficha/999999/objecion', json={'texto': 'Lo tiene que pensar bien'},
                    headers=auth_headers(equipo['closer']))

    assert r.status_code == 404
