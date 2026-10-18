"""Las ventas del setter sin palabra clave, por cliente (pedido de Kerwin, 17/10/2026).

«Esas ventas deben aparecer en los setters para que ellos decidan: esta viene de esta palabra clave
[...] agrupado por cliente, y todas deberían asociarse a la misma palabra clave.»

Lo que se fija acá:

  1. Qué ventas: las de la fuente del setter (la regla de «Ingresos por fuente»), agrupadas por
     cliente; pendiente si algún pago no tiene palabra clave para Marketing.
  2. Asignar la palabra clave a un cliente deja TODOS sus pagos atribuidos para Marketing (con su
     propio cálculo) y el grupo pasa a completadas.
  3. Quién puede: solo el setter de esas ventas; sin Instagram no hay atribución posible.
"""
import itertools
from datetime import date, datetime

import pytest

from app.models import Ad, Client, FinancialSale, LeadAnswer, ManychatLead
from app.services import anuncios_service

URL = '/api/setter/palabras-clave/ventas'
_n = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
    }


@pytest.fixture()
def guia(db):
    ad = Ad(name='GUIA PERU', keyword='GUIA PERU', status='active')
    db.session.add(ad)
    db.session.commit()
    return ad


def cliente(db, nombre, ig):
    c = Client(full_name=nombre, email=f'v{next(_n)}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    return c


def pago(db, cli, monto, cuando, setter='Elias', tipo='AL - Cuota', ig=None):
    v = FinancialSale(client_id=cli.id, instagram=ig if ig is not None else cli.instagram, tipo_pago=tipo,
                      monto=monto, estado='Completada', date=cuando, setter=setter,
                      nombre_cliente=cli.full_name)
    db.session.add(v)
    db.session.commit()
    return v


def cobrado_de_marketing(clave):
    r = anuncios_service.tablero(date(2026, 9, 1), date(2026, 10, 31))
    return next((f['cobrado'] for f in r['filas'] if f['clave'] == clave), 0)


def test_las_ventas_del_setter_sin_palabra_clave_van_por_cliente(client, db, equipo, guia, auth_headers):
    ana = cliente(db, 'Ana Torres', 'ana.torres')
    pago(db, ana, 300, datetime(2026, 9, 20), tipo='AL - Seña')
    pago(db, ana, 700, datetime(2026, 10, 2), tipo='AL - Parcial')
    beto = cliente(db, 'Beto Ruiz', 'beto.ruiz')
    pago(db, beto, 500, datetime(2026, 10, 5), setter='Paula')  # de otro setter
    # Una con palabra clave: llegó por ManyChat antes de pagar.
    caro = cliente(db, 'Caro Paz', 'caro.paz')
    lead = ManychatLead(manychat_id='mc-caro', name='Caro Paz', ig='caro.paz')
    db.session.add(lead)
    db.session.commit()
    db.session.add(LeadAnswer(lead_id=lead.id, keyword='GUIA PERU', created_at=datetime(2026, 9, 1)))
    db.session.commit()
    pago(db, caro, 250, datetime(2026, 9, 25))

    datos = client.get(URL, headers=auth_headers(equipo['elias'])).get_json()

    assert [g['cliente'] for g in datos['pendientes']] == ['Ana Torres']
    ana_g = datos['pendientes'][0]
    assert (ana_g['total'], len(ana_g['pagos']), ana_g['instagram']) == (1000.0, 2, 'ana.torres')
    assert [g['cliente'] for g in datos['completadas']] == ['Caro Paz']
    assert datos['completadas'][0]['palabras'] == ['GUIA PERU']
    assert datos['resumen'] == {'clientes': 1, 'monto': 1000.0}


def test_asignar_atribuye_todos_los_pagos_del_cliente_para_marketing(client, db, equipo, guia, auth_headers):
    ana = cliente(db, 'Ana Torres', 'ana.torres')
    pago(db, ana, 300, datetime(2026, 9, 20), tipo='AL - Seña')
    pago(db, ana, 700, datetime(2026, 10, 2), tipo='AL - Parcial', ig='Ana Torres')  # mal escrito en la venta
    assert cobrado_de_marketing('GUIA PERU') == 0

    r = client.post(URL, json={'grupo': f'c{ana.id}', 'ad_id': guia.id}, headers=auth_headers(equipo['elias']))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['pagos'] == 2
    assert cobrado_de_marketing('GUIA PERU') == 1000.0
    datos = client.get(URL, headers=auth_headers(equipo['elias'])).get_json()
    assert datos['pendientes'] == []
    assert datos['completadas'][0]['palabras'] == ['GUIA PERU']


def test_una_palabra_clave_escrita_crea_su_anuncio(client, db, equipo, auth_headers):
    ana = cliente(db, 'Ana Torres', 'ana.torres')
    pago(db, ana, 300, datetime(2026, 9, 20))

    r = client.post(URL, json={'grupo': f'c{ana.id}', 'palabra_clave': 'Aplicar'}, headers=auth_headers(equipo['elias']))

    assert r.status_code == 200, r.get_json()
    assert cobrado_de_marketing('APLICAR') == 300.0


def test_solo_el_setter_de_esas_ventas_y_con_instagram(client, db, equipo, guia, auth_headers):
    ana = cliente(db, 'Ana Torres', 'ana.torres')
    pago(db, ana, 300, datetime(2026, 9, 20))
    sin_ig = cliente(db, 'Sin Instagram', None)
    pago(db, sin_ig, 100, datetime(2026, 9, 21), ig='')

    otro = client.post(URL, json={'grupo': f'c{ana.id}', 'ad_id': guia.id}, headers=auth_headers(equipo['paula']))
    assert otro.status_code == 403
    falta = client.post(URL, json={'grupo': f'c{sin_ig.id}', 'ad_id': guia.id}, headers=auth_headers(equipo['elias']))
    assert falta.status_code == 400 and 'Instagram' in falta.get_json()['error']
    con_ig = client.post(URL, json={'grupo': f'c{sin_ig.id}', 'ad_id': guia.id, 'instagram': '@sin.ig'},
                         headers=auth_headers(equipo['elias']))
    assert con_ig.status_code == 200
    assert db.session.get(Client, sin_ig.id).instagram == 'sin.ig'
    assert client.post(URL, json={'grupo': 'x1', 'ad_id': guia.id}, headers=auth_headers(equipo['elias'])).status_code == 400
