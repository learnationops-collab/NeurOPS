"""GET /api/comercial/resumen: el close rate real que lee el tile de arriba y la tarjeta del panel Cierre.

Pedido del usuario (23/10/2026): el close rate por llamada deja afuera la seña de la llamada del mes
pasado que se paga este mes. Lo que se prueba, en el JSON que recibe el frontend:

  · `actual.close_rate_real` y `actual.cierres.reales` traen el cierre del período con su origen;
  · el director ve el equipo y un closer solo lo suyo, pida las de quien pida;
  · con un período para comparar, el tile recibe su delta en puntos.
"""
import itertools
from datetime import datetime

from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale

HOY = '2026-10-23 12:00:00'
RESUMEN = '/api/comercial/resumen'
OCTUBRE = {'period': 'custom', 'start_date': '2026-10-01', 'end_date': '2026-10-31'}

_emails = itertools.count(1)


def _equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'jean': make_user(role='closer', username='Jean Carlo', email='jc@thelearnation.com'),
        'nerina': make_user(role='closer', username='Nerina', email='nerina@thelearnation.com'),
    }


def _lead(db, closer, llamada, cobro, tipo='AL - Completo'):
    """Un lead con una llamada con show up y, si `cobro`, un pago de venta ese día."""
    email = f'lead{next(_emails)}@test.local'
    cli = Client(full_name=f'Lead {email.split("@")[0]}', email=email)
    db.session.add(cli)
    db.session.commit()
    db.session.add(Appointment(closer_id=closer.id, client_id=cli.id, start_time=llamada, result='Confirmado',
                               closer_result='Show up', created_at=datetime(2026, 8, 1)))
    if cobro:
        db.session.add(FinancialSale(mail_cliente=email, tipo_pago=tipo, monto=500.0, metodo_pago='zelle',
                                     email_vendedor=closer.email, date=cobro, estado='Completada',
                                     nombre_cliente=cli.full_name, client_id=cli.id))
    db.session.commit()


def _mes(db, equipo):
    """Jean Carlo: una llamada de octubre que cerró, una sin cerrar y una de septiembre que cerró en
    octubre. Nerina: una de octubre que cerró."""
    j, n = equipo['jean'], equipo['nerina']
    _lead(db, j, datetime(2026, 10, 5, 15), datetime(2026, 10, 6))
    _lead(db, j, datetime(2026, 10, 7, 15), None)
    _lead(db, j, datetime(2026, 9, 20, 15), datetime(2026, 10, 8))
    _lead(db, n, datetime(2026, 10, 9, 15), datetime(2026, 10, 9))


def _resumen(client, headers, **params):
    respuesta = client.get(RESUMEN, headers=headers, query_string={**OCTUBRE, **params})
    assert respuesta.status_code == 200, respuesta.get_json()
    return respuesta.get_json()


@freeze_time(HOY)
def test_el_resumen_trae_el_close_rate_real_con_su_origen(client, db, make_user, auth_headers):
    equipo = _equipo(make_user)
    _mes(db, equipo)

    actual = _resumen(client, auth_headers(equipo['director']), miembro_id=equipo['jean'].id)['actual']
    reales = actual['cierres']['reales']

    # Por llamada: la de septiembre no está entre las llamadas de octubre. Real: la cuenta, y suma a la base.
    assert actual['close_rate'] == 50.0
    assert (reales['cierres'], reales['del_periodo'], reales['anteriores'], reales['sin_llamada']) == (2, 1, 1, 0)
    assert (reales['asistieron'], reales['base'], reales['pct']) == (2, 3, 66.7)
    assert actual['close_rate_real'] == reales['pct']
    anterior = next(f for f in reales['filas'] if f['origen'] == 'anterior')
    assert anterior['llamada']['fecha'].startswith('2026-09-20T15:00')
    assert anterior['llamada']['closer'] == 'Jean Carlo'
    assert anterior['fecha'].startswith('2026-10-08')


@freeze_time(HOY)
def test_el_director_ve_el_equipo_y_un_closer_solo_lo_suyo(client, db, make_user, auth_headers):
    equipo = _equipo(make_user)
    _mes(db, equipo)

    del_equipo = _resumen(client, auth_headers(equipo['director']))['actual']['cierres']['reales']
    de_jean = _resumen(client, auth_headers(equipo['jean']))['actual']['cierres']['reales']
    de_jean_pidiendo_a_nerina = _resumen(client, auth_headers(equipo['jean']),
                                         miembro_id=equipo['nerina'].id)['actual']['cierres']['reales']

    assert del_equipo['cierres'] == 3
    assert de_jean['cierres'] == de_jean_pidiendo_a_nerina['cierres'] == 2


@freeze_time(HOY)
def test_con_un_periodo_para_comparar_el_tile_recibe_su_delta_en_puntos(client, db, make_user, auth_headers):
    equipo = _equipo(make_user)
    _mes(db, equipo)
    # Septiembre: una llamada de Jean Carlo que no cerró en septiembre (cerró en octubre) -> 0% real.
    headers = auth_headers(equipo['director'])

    respuesta = _resumen(client, headers, miembro_id=equipo['jean'].id, compare='custom',
                         compare_start='2026-09-01', compare_end='2026-09-30')

    assert respuesta['previo']['close_rate_real'] == 0.0
    assert respuesta['deltas']['close_rate_real'] == {'valor': 66.7, 'modo': 'pts'}
