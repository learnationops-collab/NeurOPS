"""Paridad de «Destino de las agendas» y «Por llamada» (ADR-W144): 1ª + 2ª + Momentum suman las cifras del
panel Cierre, y cada lista de `GET /api/comercial/llamadas/registros` mide lo que dice su cifra en `/resumen`."""
import itertools
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale

HOY = '2026-09-17 21:30:00'
RESUMEN = '/api/comercial/resumen'
REGISTROS = '/api/comercial/llamadas/registros'
SEPTIEMBRE = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30'}

_emails = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'marlon': make_user(role='closer', username='Marlon', email='marlon@thelearnation.com'),
        'triage': make_user(role='triage', username='tri'),
    }


def cliente(db):
    email = f'llamada{next(_emails)}@test.local'
    cli = Client(full_name=f'Lead {email.split("@")[0]}', email=email)
    db.session.add(cli)
    db.session.commit()
    return cli


def agenda(db, closer, *, cli=None, closer_result='Show up', compra=None, dia=10, **campos):
    cli = cli or cliente(db)
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=datetime(2026, 9, dia, 15, 0),
                    result='Confirmado', closer_result=closer_result, created_at=datetime(2026, 9, dia) - timedelta(days=1),
                    **{'origin': 'Setter', **campos})
    db.session.add(a)
    db.session.commit()
    if compra:
        # El pago va atado a la persona de la agenda: con persona, el cruce no mira el mail.
        db.session.add(FinancialSale(mail_cliente=cli.email, tipo_pago=compra, monto=500.0, metodo_pago='zelle',
                                     email_vendedor=closer.email, date=datetime(2026, 9, dia), client_id=cli.id,
                                     person_uuid=a.person_uuid, estado='Completada', nombre_cliente=cli.full_name))
        db.session.commit()
    return a


def _pedir(client, url, headers, **params):
    respuesta = client.get(url, headers=headers, query_string={**SEPTIEMBRE, **params})
    assert respuesta.status_code == 200, respuesta.get_json()
    return respuesta.get_json()


def _mes(db, equipo):
    m = equipo['marlon']
    dos_llamadas = cliente(db)
    return {
        'primera_sin_cierre': agenda(db, m, cli=dos_llamadas, dia=5),
        'segunda_con_venta': agenda(db, m, cli=dos_llamadas, dia=12, compra='AL - Completo'),
        'venta_en_primera': agenda(db, m, compra='AL - Completo'),
        'no_show': agenda(db, m, closer_result='No Show'),
        'cancelo': agenda(db, m, closer_result='Cancelado'),
        'reprogramo': agenda(db, m, closer_result='Reagendado'),
        'sin_reportar': agenda(db, m, closer_result='Pendiente'),
        'por_ocurrir': agenda(db, m, closer_result='Pendiente', dia=25),
        'descalificada': agenda(db, m, closer_result='Descalificado'),
        'momentum': agenda(db, m, origin='Momentum'),
        'de_triage': agenda(db, equipo['triage']),
    }


def _por_grupo(estados):
    cuenta = {}
    for e in estados:
        cuenta[e['grupo']] = cuenta.get(e['grupo'], 0) + e['n']
    return cuenta


@freeze_time(HOY)
def test_primera_segunda_y_momentum_suman_el_panel_cierre(client, db, equipo, auth_headers):
    _mes(db, equipo)
    actual = _pedir(client, RESUMEN, auth_headers(equipo['director']))['actual']
    por_llamada = actual['cierres_llamada']

    assert sum(g['asistieron'] for g in por_llamada.values()) == actual['asistieron']
    assert sum(g['ventas'] for g in por_llamada.values()) == actual['cerradas']
    # El lead con dos llamadas: la del día 5 es su primera y la del 12, donde compró, su segunda.
    assert por_llamada['segunda'] == {'asistieron': 1, 'ventas': 1, 'senas': 0, 'terceras': 0}
    assert por_llamada['momentum']['asistieron'] == 1
    assert por_llamada['primera']['ventas'] == 1


@freeze_time(HOY)
def test_cada_lista_tiene_tantas_filas_como_su_cifra(client, db, equipo, auth_headers):
    filas = _mes(db, equipo)
    cabeceras = auth_headers(equipo['director'])
    actual = _pedir(client, RESUMEN, cabeceras)['actual']

    def largo(que, **extra):
        return len(_pedir(client, REGISTROS, cabeceras, que=que, **extra)['filas'])

    grupos = _por_grupo(actual['estados'])
    assert set(grupos) >= {'show_up', 'no_show', 'canceladas', 'reprogramadas', 'sin_reporte', 'por_ocurrir',
                           'descalificadas'}
    for grupo, n in grupos.items():
        assert largo(grupo) == n, grupo
    for estado in actual['estados']:
        assert largo(estado['key']) == estado['n'], estado['key']
    assert largo('base') == actual['base_show_up']
    assert largo('asistieron') == actual['asistieron']
    assert largo('ventas') == actual['cerradas']
    assert largo('agendas') == actual['agendas']

    for llamada in ('primera', 'segunda'):
        parte = actual['estados_por_llamada'][llamada]
        assert largo('agendas', llamada=llamada) == parte['agendas']
        for grupo, n in _por_grupo(parte['estados']).items():
            assert largo(grupo, llamada=llamada) == n, (llamada, grupo)

    # La llamada de triage no es de closing: no está en ninguna lista del equipo.
    ids = {f['id'] for f in _pedir(client, REGISTROS, cabeceras, que='agendas')['filas']}
    assert str(filas['de_triage'].id) not in ids
    assert _pedir(client, REGISTROS, cabeceras, que='ventas', llamada='segunda')['filas'][0]['llamada'] == '2ª'


@freeze_time(HOY)
def test_una_cifra_o_una_llamada_que_no_existe_responde_400(client, db, equipo, auth_headers):
    cabeceras = auth_headers(equipo['director'])
    assert client.get(REGISTROS, headers=cabeceras, query_string={**SEPTIEMBRE, 'que': 'nada'}).status_code == 400
    assert client.get(REGISTROS, headers=cabeceras,
                      query_string={**SEPTIEMBRE, 'que': 'agendas', 'llamada': 'tercera'}).status_code == 400
