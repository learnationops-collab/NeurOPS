"""GET /api/comercial/cierres/no-cerradas: la lista que abre «No cerradas» en el panel Cierre.

Pedido del usuario (09/10/2026): el dato «debe mostrar un modal con el lead y la objeción
registrada», con una opción para ir a esas agendas en Revisar. Lo que se prueba:

  · que cierre: la lista tiene tantas filas como dice la tarjeta (`/resumen`) y son exactamente las
    filas de `/tabla` que Revisar muestra con el filtro «Cerró: No», para el mismo período y alcance;
  · el alcance: un closer ve solo sus agendas, pida las de quien pida; un setter no tiene panel
    Cierre;
  · la objeción: la última registrada en ESA agenda, con su autor, y una sola consulta para todas.
"""
import itertools
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time
from sqlalchemy import event

from app.models import Appointment, Client, FinancialSale, LeadEventLog

HOY = '2026-09-17 21:30:00'
NO_CERRADAS = '/api/comercial/cierres/no-cerradas'
RESUMEN = '/api/comercial/resumen'
TABLA = '/api/comercial/tabla'
SEPTIEMBRE = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30'}

_emails = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'marlon': make_user(role='closer', username='Marlon', email='marlon@thelearnation.com'),
        'nerina': make_user(role='closer', username='Nerina', email='nerina@thelearnation.com'),
        'setter': make_user(role='setter', username='Elias'),
        'triage': make_user(role='triage', username='tri'),
    }


def agenda(db, closer, *, closer_result='Show up', compra=None, dia=10, **campos):
    email = f'lead{next(_emails)}@test.local'
    cli = Client(full_name=f'Lead {email.split("@")[0]}', email=email)
    db.session.add(cli)
    db.session.commit()
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=datetime(2026, 9, dia, 15, 0),
                    result='Confirmado', closer_result=closer_result, origin='Setter',
                    created_at=datetime(2026, 9, dia) - timedelta(days=1), **campos)
    db.session.add(a)
    if compra:
        db.session.add(FinancialSale(mail_cliente=email, tipo_pago=compra, monto=500.0, metodo_pago='zelle',
                                     email_vendedor=closer.email, date=datetime(2026, 9, dia),
                                     estado='Completada', nombre_cliente=cli.full_name))
    db.session.commit()
    return a


def objecion(db, appt, autor, texto, *, cuando=datetime(2026, 9, 11, 12, 0), tipo='objecion'):
    db.session.add(LeadEventLog(appointment_id=appt.id, user_id=autor.id if autor else None,
                                action_type=tipo, description=texto, created_at=cuando))
    db.session.commit()


def _pedir(client, url, headers, **params):
    respuesta = client.get(url, headers=headers, query_string={**SEPTIEMBRE, **params})
    assert respuesta.status_code == 200, respuesta.get_json()
    return respuesta.get_json()


def _mes(db, equipo):
    """Septiembre: Marlon con 2 no cerradas, una venta, una seña y un no show; Nerina con una."""
    m = equipo['marlon']
    filas = {
        'presento': agenda(db, m),
        'seguimiento': agenda(db, m, seguimiento_tipo='tomada', dia=12),
        'venta': agenda(db, m, compra='AL - Completo'),
        'sena': agenda(db, m, compra='RR - Seña'),
        'no_show': agenda(db, m, closer_result='No Show'),
        'de_nerina': agenda(db, equipo['nerina']),
    }
    return filas


# --- Quién la pide ------------------------------------------------------------------------------

def test_sin_sesion_no_responde(client, equipo):
    assert client.get(NO_CERRADAS).status_code == 401


@pytest.mark.parametrize('quien', ['setter', 'triage'])
def test_un_setter_y_un_rol_ajeno_no_la_ven(client, equipo, auth_headers, quien):
    assert client.get(NO_CERRADAS, headers=auth_headers(equipo[quien])).status_code == 403


# --- Que cierre con la tarjeta y con Revisar ----------------------------------------------------

@freeze_time(HOY)
@pytest.mark.parametrize('quien,acotar', [('director', None), ('director', 'marlon'), ('marlon', None)])
def test_la_lista_tiene_las_filas_de_la_tarjeta_y_las_de_revisar(client, db, equipo, auth_headers,
                                                                 quien, acotar):
    _mes(db, equipo)
    headers = auth_headers(equipo[quien])
    extra = {'miembro_id': equipo[acotar].id} if acotar else {}

    lista = _pedir(client, NO_CERRADAS, headers, **extra)
    tarjeta = _pedir(client, RESUMEN, headers, **extra)['actual']['cierres']['no_cerradas']
    tabla = _pedir(client, TABLA, headers, tabla='agendas', **extra)['filas']
    # Lo que Revisar muestra con «Cerró: No»: las filas que asistieron con la marca puesta.
    en_revisar = [f['id'] for f in tabla if f['asistio'] and f['no_cerrada']]

    assert lista['total'] == len(lista['filas']) == tarjeta['num'] == len(en_revisar)
    assert [f['id'] for f in lista['filas']] == en_revisar


@freeze_time(HOY)
def test_son_las_que_asistieron_y_no_compraron_ni_dejaron_sena(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['director']))

    assert {f['id'] for f in lista['filas']} == {
        filas['presento'].id, filas['seguimiento'].id, filas['de_nerina'].id}
    # La más reciente primero, como en Revisar.
    assert lista['filas'][0]['id'] == filas['seguimiento'].id


@freeze_time(HOY)
def test_cada_fila_trae_lo_que_el_modal_muestra_y_lo_que_abre_la_ficha(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['director']), miembro_id=equipo['nerina'].id)

    [fila] = lista['filas']
    assert fila['id'] == filas['de_nerina'].id
    assert (fila['tipo'], fila['client_id']) == ('agenda', filas['de_nerina'].client_id)
    assert fila['cliente'].startswith('Lead ')
    assert fila['closer'] == 'Nerina'
    assert fila['fecha'].startswith('2026-09-10T15:00')
    assert fila['objecion'] is None


# --- Alcance ------------------------------------------------------------------------------------

@freeze_time(HOY)
def test_un_closer_ve_solo_las_suyas_aunque_pida_las_de_otro(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['marlon']), miembro_id=equipo['nerina'].id)

    ids = {f['id'] for f in lista['filas']}
    assert filas['de_nerina'].id not in ids
    assert ids == {filas['presento'].id, filas['seguimiento'].id}


@freeze_time(HOY)
def test_el_periodo_acota_la_lista(client, db, equipo, auth_headers):
    agenda(db, equipo['marlon'], dia=10)
    fuera = agenda(db, equipo['marlon'], dia=10)
    fuera.start_time = datetime(2026, 8, 20, 15, 0)
    db.session.commit()

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['director']))

    assert lista['total'] == 1
    assert lista['dates']['start'] == '2026-09-01'


# --- La objeción --------------------------------------------------------------------------------

@freeze_time(HOY)
def test_trae_la_ultima_objecion_de_esa_agenda_con_su_autor(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)
    presento = filas['presento']
    objecion(db, presento, equipo['marlon'], 'Lo tiene que hablar con la pareja',
             cuando=datetime(2026, 9, 10, 16, 0))
    objecion(db, presento, equipo['director'], 'No le alcanza hasta fin de mes',
             cuando=datetime(2026, 9, 11, 9, 0))
    # Un comentario no es una objeción, aunque sea más nuevo.
    objecion(db, presento, equipo['marlon'], 'Le mandé el link', cuando=datetime(2026, 9, 12),
             tipo='comment')

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['director']))
    por_id = {f['id']: f for f in lista['filas']}

    assert por_id[presento.id]['objecion'] == {
        'texto': 'No le alcanza hasta fin de mes', 'autor': 'mario', 'fecha': '2026-09-11T09:00:00'}
    assert por_id[filas['seguimiento'].id]['objecion'] is None


@freeze_time(HOY)
def test_la_objecion_de_otra_agenda_del_mismo_lead_no_se_mezcla(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)
    presento = filas['presento']
    vieja = Appointment(closer_id=equipo['marlon'].id, client_id=presento.client_id,
                        start_time=datetime(2026, 8, 1, 15, 0), result='Confirmado',
                        closer_result='Show up', created_at=datetime(2026, 7, 30))
    db.session.add(vieja)
    db.session.commit()
    objecion(db, vieja, equipo['marlon'], 'Objeción de la llamada de agosto')

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['director']))

    assert {f['id']: f['objecion'] for f in lista['filas']}[presento.id] is None


@freeze_time(HOY)
def test_una_objecion_sin_usuario_la_firma_el_sistema(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)
    objecion(db, filas['presento'], None, 'Precio')

    lista = _pedir(client, NO_CERRADAS, auth_headers(equipo['director']))

    assert {f['id']: f['objecion'] for f in lista['filas']}[filas['presento'].id]['autor'] == 'Sistema'


@freeze_time(HOY)
def test_las_objeciones_se_leen_en_una_sola_consulta(client, db, equipo, auth_headers):
    """Sin N+1: con una o con ocho agendas, una sola lectura de lead_event_logs."""
    def lecturas_de_objeciones():
        cuenta = []

        def contar(_conn, _cursor, sentencia, *_args):
            if 'lead_event_logs' in sentencia:
                cuenta.append(sentencia)

        event.listen(db.engine, 'before_cursor_execute', contar)
        try:
            _pedir(client, NO_CERRADAS, auth_headers(equipo['director']))
        finally:
            event.remove(db.engine, 'before_cursor_execute', contar)
        return len(cuenta)

    a = agenda(db, equipo['marlon'])
    objecion(db, a, equipo['marlon'], 'Precio')
    con_una = lecturas_de_objeciones()
    for _ in range(7):
        objecion(db, agenda(db, equipo['marlon']), equipo['marlon'], 'Tiempo')
    con_ocho = lecturas_de_objeciones()

    assert con_una == con_ocho == 1
