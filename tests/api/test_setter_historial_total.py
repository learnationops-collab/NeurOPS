"""El "Total histórico" del Historial de agendas del setter cuenta personas, de siempre.

Antes decía "Total: N" con el largo de la lista: una fila por agenda (quien reagendó contaba dos o
tres veces) y la lista se corta en 500 filas, así que a Elias le decía 500 el 01/10/2026 sin ser
su total. Ahora es un número aparte (`/setter/agendas/total`), con la misma clave de persona que la
lista Por fecha, y la lista no cambia.
"""
from datetime import datetime

import pytest
from freezegun import freeze_time

from app.models.financial import FinancialAgenda

AHORA = '2026-10-01 15:00:00'


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias', timezone='America/Buenos_Aires')


def fila(db, ig=None, lead=None, estado='Pendiente', nombre='Elias', cuando=datetime(2026, 10, 1, 15, 0)):
    db.session.add(FinancialAgenda(nombre=nombre, instagram=ig, lead=lead, estado=estado,
                                   date=cuando, created_at=cuando))
    db.session.commit()


@pytest.fixture()
def historial(db, elias):
    # Ana reagendó dos veces: tres filas, una persona (el @ y las mayúsculas no la separan).
    fila(db, ig='ana', lead='Ana')
    fila(db, ig='@Ana', lead='Ana', estado='Reagendada')
    fila(db, ig='ana', lead='Ana', estado='Asistió')
    # Beto no dejó instagram: se lo reconoce por el nombre.
    fila(db, ig='N/A', lead='Beto')
    fila(db, ig=None, lead='beto ', estado='Cancelada')
    # Caro ya tuvo su llamada.
    fila(db, ig='caro', lead='Caro', estado='Asistió')
    # Lo de otra fuente no es suyo.
    fila(db, ig='dani', lead='Dani', nombre='Paula')


@freeze_time(AHORA)
def test_el_total_historico_cuenta_personas_y_la_lista_sigue_igual(client, elias, historial, auth_headers):
    cabeceras = auth_headers(elias)
    lista = client.get('/api/setter/agendas', headers=cabeceras).get_json()
    total = client.get('/api/setter/agendas/total', headers=cabeceras).get_json()

    assert len(lista) == 6
    assert total == {'personas': 3, 'agendas': 6}


@freeze_time(AHORA)
@pytest.mark.parametrize('estado, personas, filas', [('pending', 2, 2), ('completed', 3, 4)])
def test_el_total_sigue_al_filtro_de_estado_de_la_lista(client, elias, historial, auth_headers,
                                                       estado, personas, filas):
    cabeceras = auth_headers(elias)
    lista = client.get('/api/setter/agendas', headers=cabeceras, query_string={'status': estado}).get_json()
    total = client.get('/api/setter/agendas/total', headers=cabeceras,
                       query_string={'status': estado}).get_json()

    assert len(lista) == total['agendas'] == filas
    assert total['personas'] == personas


@freeze_time(AHORA)
def test_el_total_no_se_corta_en_las_500_filas_de_la_lista(client, db, elias, auth_headers):
    db.session.add_all([FinancialAgenda(nombre='Elias', instagram=f'lead{n}', lead=f'Lead {n}',
                                        date=datetime(2026, 9, 1), created_at=datetime(2026, 9, 1))
                        for n in range(505)])
    db.session.commit()

    total = client.get('/api/setter/agendas/total', headers=auth_headers(elias)).get_json()

    assert total == {'personas': 505, 'agendas': 505}


@freeze_time(AHORA)
def test_por_fecha_cuenta_a_cada_persona_una_vez_con_la_misma_clave(client, elias, historial, auth_headers):
    filas = client.get('/api/setter/deck/agendas', headers=auth_headers(elias),
                       query_string={'date_range': 'today'}).get_json()

    assert sorted(f['cliente'].strip().lower() for f in filas) == ['ana', 'beto', 'caro']
