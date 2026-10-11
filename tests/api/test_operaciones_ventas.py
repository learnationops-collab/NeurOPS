"""Revisar › Ventas para quien opera (10/10/2026): la tabla vieja de Ventas de Operaciones se retiró y
Revisar la reemplaza. Lo que ella sabía y Revisar no —las ventas no completadas, su estado y si tienen
agenda— llega con `operar=1`, solo para admin y operador.

Lo que no se negocia, y por eso se prueba contra el endpoint:

  · la dirección y los closers reciben EXACTAMENTE lo de antes, manden lo que manden;
  · las filas completadas de quien opera son las mismas de la dirección (mismas señas, mismas fuentes)
    y los totales siguen contando solo las completadas: ningún número del tablero se mueve;
  · `tiene_agenda` es el criterio de la tabla vieja (`sin_atribucion`), calculado en lote.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time
from sqlalchemy import event

from app.models import FinancialAgenda, FinancialSale

HOY = '2026-09-25 12:00:00'
TABLA = '/api/comercial/tabla'
SEPTIEMBRE = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30', 'tabla': 'ventas'}
NUEVAS = ('estado', 'completada', 'tiene_agenda')

MARLON = 'marlon@thelearnation.com'
NERINA = 'nerina@thelearnation.com'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'admin': make_user(role='admin', username='root'),
        'operador': make_user(role='operator', username='lucia'),
        'marlon': make_user(role='closer', username='Marlon', email=MARLON),
        'nerina': make_user(role='closer', username='Nerina', email=NERINA),
    }


def _agenda(db, nombre, ig, dia=datetime(2026, 8, 20)):
    db.session.add(FinancialAgenda(nombre=nombre, instagram=ig, date=dia, created_at=dia))


def _venta(db, ig, tipo, monto, vendedor, dia, estado='Completada', mail=None):
    v = FinancialSale(instagram=ig, mail_cliente=mail, nombre_cliente=ig.title(), tipo_pago=tipo,
                      monto=monto, metodo_pago='zelle', email_vendedor=vendedor, estado=estado,
                      date=datetime(2026, 9, dia, 15))
    db.session.add(v)
    return v


@pytest.fixture()
def ventas(db, equipo):
    """Completadas de los tres sabores (vacío, «Completada», «Confirmada») y no completadas de cada
    estado, con y sin agenda, de los dos closers."""
    _agenda(db, 'workshop', 'ana')
    _agenda(db, 'Elias', 'caro')
    _agenda(db, 'vsl', 'eva')
    v = {
        'ana': _venta(db, 'ana', 'RR - Completo', 2000.0, MARLON, 3),
        'beto': _venta(db, 'beto', 'RR - Parcial', 800.0, NERINA, 5, estado=''),          # sin agenda
        'caro_sena': _venta(db, 'caro', 'RR - Seña', 200.0, NERINA, 6, estado='Confirmada'),
        'caro': _venta(db, 'caro', 'RR - Completo', 1800.0, NERINA, 20),
        # No completadas: no son cash.
        'ana_reemb': _venta(db, 'ana', 'RR - Parcial', 999.0, MARLON, 8, estado='Reembolsada'),
        'dani_pend': _venta(db, 'dani', 'AL - Completo', 1500.0, MARLON, 12, estado='Pendiente'),   # sin agenda
        'eva_canc': _venta(db, 'eva', 'RR - Completo', 700.0, NERINA, 15, estado='Cancelada'),
        'fede_raro': _venta(db, 'fede', 'RR - Cuota', 300.0, NERINA, 18, estado='En disputa'),    # sin agenda
    }
    db.session.commit()
    return v


def _tabla(client, headers, **extra):
    r = client.get(TABLA, headers=headers, query_string={**SEPTIEMBRE, **extra})
    assert r.status_code == 200, r.get_json()
    return r.get_json()


def _sin_lo_nuevo(fila):
    return {k: v for k, v in fila.items() if k not in NUEVAS}


# --- Quién recibe qué --------------------------------------------------------------------------

@freeze_time(HOY)
@pytest.mark.parametrize('quien', ['director', 'marlon', 'nerina'])
def test_la_direccion_y_los_closers_reciben_exactamente_lo_de_antes(client, equipo, ventas, auth_headers, quien):
    headers = auth_headers(equipo[quien])

    sin_pedir = _tabla(client, headers)
    pidiendo = _tabla(client, headers, operar='1')

    assert pidiendo == sin_pedir
    assert all(fila['id'] not in {ventas[k].id for k in ('ana_reemb', 'dani_pend', 'eva_canc', 'fede_raro')}
               for fila in pidiendo['filas'])
    assert all(not set(NUEVAS) & set(fila) for fila in pidiendo['filas'])


@freeze_time(HOY)
@pytest.mark.parametrize('quien', ['operador', 'admin'])
def test_quien_opera_recibe_tambien_las_no_completadas_con_su_estado(client, equipo, ventas, auth_headers, quien):
    datos = _tabla(client, auth_headers(equipo[quien]), operar='1')

    por_id = {f['id']: f for f in datos['filas']}
    # El id de cada fila es el de la `FinancialSale`: es lo que mandan las acciones de la fila.
    assert set(por_id) == {v.id for v in ventas.values()}
    estados = {k: por_id[v.id]['estado']['label'] for k, v in ventas.items()}
    assert estados == {
        'ana': 'Completada', 'beto': 'Completada', 'caro_sena': 'Completada', 'caro': 'Completada',
        'ana_reemb': 'Reembolsada', 'dani_pend': 'Pendiente', 'eva_canc': 'Cancelada',
        # Un estado escrito a mano que no está en el vocabulario se muestra como vino.
        'fede_raro': 'En disputa',
    }
    assert por_id[ventas['fede_raro'].id]['estado']['tone'] == 'warning'
    assert {k for k, v in ventas.items() if not por_id[v.id]['completada']} == {
        'ana_reemb', 'dani_pend', 'eva_canc', 'fede_raro'}
    # En el orden de la tabla: de la venta más nueva a la más vieja.
    assert [f['fecha'] for f in datos['filas']] == sorted((f['fecha'] for f in datos['filas']), reverse=True)


@freeze_time(HOY)
def test_sin_pedirlo_quien_opera_ve_lo_mismo_que_la_direccion(client, equipo, ventas, auth_headers):
    operador = _tabla(client, auth_headers(equipo['operador']))
    director = _tabla(client, auth_headers(equipo['director']))

    assert operador == director


# --- Los números no se mueven ------------------------------------------------------------------

@freeze_time(HOY)
@pytest.mark.parametrize('quien', ['operador', 'admin'])
def test_las_completadas_y_los_totales_de_quien_opera_son_los_de_la_direccion(client, equipo, ventas,
                                                                              auth_headers, quien):
    director = _tabla(client, auth_headers(equipo['director']))
    operando = _tabla(client, auth_headers(equipo[quien]), operar='1')

    completadas = [_sin_lo_nuevo(f) for f in operando['filas'] if f['completada']]
    # Fila por fila: el mismo estado de seña, la misma fuente, el mismo cliente, en el mismo orden.
    assert completadas == director['filas']
    assert operando['totales'] == director['totales']
    assert director['totales'] == {'filas': 4, 'ventas': 3, 'cash': 4800.0, 'cash_neto': 4800.0,
                                   'ticket': round(4600.0 / 3, 2)}


@freeze_time(HOY)
def test_quien_opera_acotado_a_un_closer_ve_solo_lo_de_ese_closer(client, equipo, ventas, auth_headers):
    headers = auth_headers(equipo['operador'])
    marlon = _tabla(client, headers, operar='1', miembro_id=equipo['marlon'].id)
    director = _tabla(client, auth_headers(equipo['director']), miembro_id=equipo['marlon'].id)

    assert {f['id'] for f in marlon['filas']} == {ventas[k].id for k in ('ana', 'ana_reemb', 'dani_pend')}
    assert marlon['totales'] == director['totales']


# --- Si tiene agenda ---------------------------------------------------------------------------

@freeze_time(HOY)
def test_tiene_agenda_es_el_criterio_de_la_tabla_vieja(client, equipo, ventas, auth_headers):
    headers = auth_headers(equipo['operador'])
    datos = _tabla(client, headers, operar='1')
    vieja = client.get('/api/public/financial-sales', headers=headers, query_string={
        'start_date': '2026-09-01', 'end_date': '2026-09-30', 'sin_atribucion': 'true', 'page': 1,
        'limit': 100}).get_json()

    sin_agenda = {f['id'] for f in datos['filas'] if not f['tiene_agenda']}
    assert sin_agenda == {v['id'] for v in vieja['data']}
    assert sin_agenda == {ventas[k].id for k in ('beto', 'dani_pend', 'fede_raro')}


@freeze_time(HOY)
def test_una_venta_que_se_cruza_por_correo_tiene_agenda(client, db, equipo, ventas, auth_headers):
    # La agenda tiene el correo y la venta el Instagram, y otra venta del mismo lead une los dos.
    db.session.add(FinancialAgenda(nombre='workshop', mail='gina@x.com', date=datetime(2026, 9, 1)))
    _venta(db, 'gina', 'RR - Seña', 100.0, MARLON, 10, mail='gina@x.com')
    sola = _venta(db, 'gina', 'RR - Completo', 1000.0, MARLON, 21, estado='Pendiente')
    db.session.commit()

    datos = _tabla(client, auth_headers(equipo['operador']), operar='1')

    assert next(f for f in datos['filas'] if f['id'] == sola.id)['tiene_agenda'] is True


def _consultas(app, hacer):
    """Cuántas consultas SQL corre `hacer()`."""
    from app import db

    contador = []
    escuchar = lambda *a, **k: contador.append(1)  # noqa: E731
    # Las dos mediciones arrancan con la sesión vacía: si no, la primera encuentra al usuario del token
    # ya cargado y la segunda lo vuelve a leer, una consulta que no tiene nada que ver con las filas.
    db.session.expire_all()
    event.listen(db.engine, 'before_cursor_execute', escuchar)
    try:
        hacer()
    finally:
        event.remove(db.engine, 'before_cursor_execute', escuchar)
    return len(contador)


@freeze_time(HOY)
def test_el_estado_y_la_agenda_se_resuelven_en_lote(app, client, db, equipo, ventas, auth_headers):
    headers = auth_headers(equipo['operador'])
    antes = _consultas(app, lambda: _tabla(client, headers, operar='1'))

    for n in range(12):
        _venta(db, f'nuevo{n}', 'RR - Completo', 100.0, NERINA, 22, estado='Reembolsada' if n % 2 else '')
        _agenda(db, 'workshop', f'nuevo{n}')
    db.session.commit()
    despues = _consultas(app, lambda: _tabla(client, headers, operar='1'))

    assert despues == antes
