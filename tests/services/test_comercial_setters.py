"""Los números del setter en el dashboard comercial: "Agendas generadas" y "Agendaron".

Definiciones que fijó el dueño el 01/10/2026, para que el setter vea en "Mis datos" un número del
que no tenga que dudar:

  1. Una agenda generada se cuenta por la fecha en que se CREÓ, no por la de la reunión.
  2. Una persona cuenta UNA vez por setter: si reagendó, queda su agenda más reciente.
  3. "Agendaron" (el embudo de leads) cuenta solo los leads que agendaron con ESE setter.

Todo lo de los closers queda como estaba: sus agendas se siguen contando por la reunión, una por
cita.
"""
import itertools
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale, ManychatLead
from app.services import comercial_analitica as ca
from app.services.comercial_service import ComercialService

HOY = '2026-10-01 12:00:00'
SEP = (date(2026, 9, 1), date(2026, 9, 30))
OCT = (date(2026, 10, 1), date(2026, 10, 31))
TABLA = '/api/comercial/tabla'

_n = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'marlon': make_user(role='closer', username='Marlon', email='marlon@thelearnation.com'),
        'elias': make_user(role='setter', username='Elias'),
        'paula': make_user(role='setter', username='Paula'),
    }


def cliente(db, nombre=None, ig=None):
    c = Client(full_name=nombre or f'Lead {next(_n)}', email=f'lead{next(_n)}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, creada, reunion, setter=None, closer_result='Pendiente'):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=reunion, created_at=creada,
                    result='Confirmado', closer_result=closer_result, origin='Setter',
                    setter_id=setter.id if setter else None)
    db.session.add(a)
    db.session.commit()
    return a


# --- 1. Por fecha de creación ---------------------------------------------------------------------

@freeze_time(HOY)
def test_una_agenda_generada_cuenta_en_el_mes_en_que_se_reservo(db, equipo):
    """Reservada el 28/09 para el 03/10: es trabajo de septiembre. Por la reunión le contaba a
    octubre, un mes en que el setter todavía no había hecho nada."""
    agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
           creada=datetime(2026, 9, 28, 14, 0), reunion=datetime(2026, 10, 3, 15, 0))
    # Y al revés: reservada en agosto para septiembre no es trabajo de septiembre.
    agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
           creada=datetime(2026, 8, 30, 9, 0), reunion=datetime(2026, 9, 2, 15, 0))

    elias = equipo['elias'].id
    assert ca.bloque_setters(*SEP, setter_id=elias, setter_nombre='Elias')['generadas'] == 1
    assert ca.bloque_setters(*OCT, setter_id=elias, setter_nombre='Elias')['generadas'] == 0
    assert ca.bloque_setters(*SEP)['generadas'] == 1


@freeze_time(HOY)
def test_la_serie_de_agendas_generadas_suma_por_el_dia_en_que_se_reservo(db, equipo):
    agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
           creada=datetime(2026, 9, 28, 14, 0), reunion=datetime(2026, 9, 30, 15, 0))

    datos = ca.variabilidad('setters', *SEP, miembro_id=equipo['elias'].id)
    serie = next(s for s in datos['series'] if s['key'] == 'agendas')
    por_dia = dict(zip(datos['dias'], serie['vals']))

    assert por_dia['2026-09-28'] == 1
    assert por_dia['2026-09-30'] == 0
    # El total de la serie es el número del tile.
    assert sum(serie['vals']) == ca.bloque_setters(*SEP, setter_id=equipo['elias'].id,
                                                    setter_nombre='Elias')['generadas']


@freeze_time(HOY)
def test_la_tabla_de_generadas_abre_por_creacion_y_el_toggle_sigue_andando(client, db, equipo,
                                                                         auth_headers):
    agenda(db, equipo['marlon'], cliente(db, 'Reservada en septiembre'), setter=equipo['elias'],
           creada=datetime(2026, 9, 28, 14, 0), reunion=datetime(2026, 10, 3, 15, 0))
    headers = auth_headers(equipo['director'])
    base = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30',
            'rol': 'setters', 'tabla': 'generadas'}

    sin_basis = client.get(TABLA, headers=headers, query_string=base).get_json()
    por_creacion = client.get(TABLA, headers=headers, query_string={**base, 'basis': 'creacion'}).get_json()
    por_reunion = client.get(TABLA, headers=headers, query_string={**base, 'basis': 'meet'}).get_json()

    assert [f['cliente'] for f in sin_basis['filas']] == ['Reservada en septiembre']
    assert por_creacion['filas'] == sin_basis['filas']
    assert por_reunion['filas'] == []


@freeze_time(HOY)
def test_el_setter_ve_en_mis_datos_lo_mismo_que_la_direccion(client, db, equipo, auth_headers):
    agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
           creada=datetime(2026, 9, 28, 14, 0), reunion=datetime(2026, 10, 3, 15, 0))
    rango = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30',
             'compare': 'none'}

    suyo = client.get('/api/comercial/resumen', headers=auth_headers(equipo['elias']),
                      query_string=rango).get_json()
    tabla = client.get(TABLA, headers=auth_headers(equipo['elias']),
                       query_string={**rango, 'tabla': 'generadas'}).get_json()

    assert suyo['actual']['generadas'] == len(tabla['filas']) == 1


# --- 2. Una persona, una vez ----------------------------------------------------------------------

def _bloque(setter=None, nombre=None):
    return ca.bloque_setters(*SEP, setter_id=setter.id if setter else None, setter_nombre=nombre)


@freeze_time(HOY)
def test_un_lead_que_reagenda_cuenta_una_vez_con_su_agenda_mas_reciente(db, equipo):
    lead = cliente(db, 'Reagendo')
    agenda(db, equipo['marlon'], lead, setter=equipo['elias'], closer_result='Reagendado',
           creada=datetime(2026, 9, 3, 10, 0), reunion=datetime(2026, 9, 5, 15, 0))
    vigente = agenda(db, equipo['marlon'], lead, setter=equipo['elias'], closer_result='Show up',
                     creada=datetime(2026, 9, 5, 16, 0), reunion=datetime(2026, 9, 9, 15, 0))

    filas = ComercialService.generadas(*SEP, setter_id=equipo['elias'].id)
    bloque = _bloque(equipo['elias'], 'Elias')

    assert [f['id'] for f in filas] == [vigente.id]
    assert bloque['generadas'] == 1
    # El show up sale de la fila que quedó: la llamada de verdad fue la segunda y asistió.
    assert bloque['show_up'] == 100.0


@freeze_time(HOY)
def test_la_mas_reciente_es_la_de_la_ultima_reunion_aunque_se_haya_creado_antes(db, equipo):
    """La sincronización crea a veces de una vez agendas de reuniones ya pasadas (en producción, dos
    del mismo lead en el mismo minuto para el 24/08 y el 27/08): el resultado vigente es el de la
    última llamada, no el de la última fila que se escribió."""
    lead = cliente(db, 'Sincronizado')
    ultima_llamada = agenda(db, equipo['marlon'], lead, setter=equipo['elias'], closer_result='No Show',
                            creada=datetime(2026, 9, 7, 17, 52), reunion=datetime(2026, 9, 12, 16, 0))
    agenda(db, equipo['marlon'], lead, setter=equipo['elias'], closer_result='Show up',
           creada=datetime(2026, 9, 7, 17, 53), reunion=datetime(2026, 9, 9, 16, 0))

    assert [f['id'] for f in ComercialService.generadas(*SEP, setter_id=equipo['elias'].id)] == [
        ultima_llamada.id]


@freeze_time(HOY)
def test_una_venta_originada_no_se_cuenta_dos_veces_por_las_agendas_del_mismo_lead(db, equipo):
    lead = cliente(db, 'Compro')
    for creada, reunion in [(datetime(2026, 9, 2, 10, 0), datetime(2026, 9, 4, 15, 0)),
                            (datetime(2026, 9, 5, 10, 0), datetime(2026, 9, 8, 15, 0))]:
        agenda(db, equipo['marlon'], lead, setter=equipo['elias'], closer_result='Show up',
               creada=creada, reunion=reunion)
    db.session.add(FinancialSale(mail_cliente=lead.email, monto=990.0, tipo_pago='AL - Completo',
                                 metodo_pago='zelle', email_vendedor='marlon@thelearnation.com',
                                 date=datetime(2026, 9, 8), estado='Completada'))
    db.session.commit()

    assert _bloque(equipo['elias'], 'Elias')['ventas_originadas'] == 1


@freeze_time(HOY)
def test_la_agenda_de_la_venta_gana_aunque_haya_otra_mas_nueva_sin_resultado(db, equipo):
    """En producción: un lead de Elias compró en la llamada del 07/09 y tenía otra agenda del 15/09
    que nadie reportó. Quedarse con la más reciente le borraba la venta originada."""
    lead = cliente(db, 'Compro y quedo otra')
    compra = agenda(db, equipo['marlon'], lead, setter=equipo['elias'], closer_result='Show up',
                    creada=datetime(2026, 9, 3, 10, 0), reunion=datetime(2026, 9, 7, 15, 0))
    agenda(db, equipo['marlon'], lead, setter=equipo['elias'],
           creada=datetime(2026, 9, 10, 10, 0), reunion=datetime(2026, 9, 15, 15, 0))
    db.session.add(FinancialSale(mail_cliente=lead.email, monto=990.0, tipo_pago='AL - Completo',
                                 metodo_pago='zelle', email_vendedor='marlon@thelearnation.com',
                                 date=datetime(2026, 9, 7), estado='Completada'))
    db.session.commit()

    assert [f['id'] for f in ComercialService.generadas(*SEP, setter_id=equipo['elias'].id)] == [compra.id]
    assert _bloque(equipo['elias'], 'Elias')['ventas_originadas'] == 1


@freeze_time(HOY)
def test_un_lead_de_dos_setters_cuenta_para_los_dos_y_el_equipo_es_la_suma(db, equipo):
    compartido = cliente(db, 'De los dos')
    agenda(db, equipo['marlon'], compartido, setter=equipo['elias'],
           creada=datetime(2026, 9, 3, 10, 0), reunion=datetime(2026, 9, 5, 15, 0))
    agenda(db, equipo['marlon'], compartido, setter=equipo['paula'],
           creada=datetime(2026, 9, 6, 10, 0), reunion=datetime(2026, 9, 8, 15, 0))
    # Y uno que Elias reagendó: una sola persona para él.
    reagendo = cliente(db, 'Reagendo')
    for dia in (10, 14):
        agenda(db, equipo['marlon'], reagendo, setter=equipo['elias'],
               creada=datetime(2026, 9, dia, 10, 0), reunion=datetime(2026, 9, dia + 2, 15, 0))

    elias = _bloque(equipo['elias'], 'Elias')['generadas']
    paula = _bloque(equipo['paula'], 'Paula')['generadas']

    assert (elias, paula) == (2, 1)
    assert _bloque()['generadas'] == elias + paula == 3
    # Y la tabla del equipo conserva su orden: la reunión más nueva arriba.
    reuniones = [f['fecha'] for f in ComercialService.generadas(*SEP)]
    assert reuniones == sorted(reuniones, reverse=True) and len(reuniones) == 3


@freeze_time(HOY)
def test_la_tabla_de_generadas_devuelve_las_filas_depuradas(client, db, equipo, auth_headers):
    """La lista es el número: si la tabla trajera las dos agendas del que reagendó, el setter
    contaría 2 filas debajo de un 1."""
    lead = cliente(db, 'Reagendo')
    for dia in (3, 6):
        agenda(db, equipo['marlon'], lead, setter=equipo['elias'],
               creada=datetime(2026, 9, dia, 10, 0), reunion=datetime(2026, 9, dia + 2, 15, 0))
    rango = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30',
             'compare': 'none'}

    for quien, extra in [('elias', {}), ('director', {'rol': 'setters'}),
                         ('director', {'rol': 'setters', 'miembro_id': equipo['elias'].id})]:
        headers = auth_headers(equipo[quien])
        resumen = client.get('/api/comercial/resumen', headers=headers,
                             query_string={**rango, **extra}).get_json()
        tabla = client.get(TABLA, headers=headers,
                           query_string={**rango, **extra, 'tabla': 'generadas'}).get_json()
        assert resumen['actual']['generadas'] == len(tabla['filas']) == tabla['totales']['agendas'] == 1


# --- 3. Agendaron: con ESE setter -----------------------------------------------------------------

def lead(db, ig, setter='Elias', cuando=datetime(2026, 9, 10, 12, 0)):
    l = ManychatLead(manychat_id=f'mc-{next(_n)}', name=f'Lead {ig}', ig=ig, setter=setter,
                     created_at=cuando)
    db.session.add(l)
    db.session.commit()
    return l


@pytest.fixture()
def leads_de_elias(db, equipo, make_user):
    """Cuatro leads de Elias que reservaron, cada uno por una vía distinta."""
    marlon = equipo['marlon']
    reunion = {'creada': datetime(2026, 9, 11, 10, 0), 'reunion': datetime(2026, 9, 13, 15, 0)}
    vias = {
        'con_elias': equipo['elias'],
        'con_paula': equipo['paula'],
        'en_un_taller': None,          # las agendas de taller, VSL o landing no tienen setter
        'a_mano_por_un_closer': marlon,  # el closer que agenda a mano queda como setter_id
    }
    leads = {}
    for via, quien in vias.items():
        leads[via] = lead(db, f'@{via}')
        agenda(db, marlon, cliente(db, ig=via.upper()), setter=quien, **reunion)
    leads['sin_cita'] = lead(db, '@sin_cita')
    return leads


@freeze_time(HOY)
def test_agendo_cuenta_solo_las_citas_que_genero_ese_setter(db, equipo, leads_de_elias):
    filas = ComercialService.leads(*SEP, setter_nombre='Elias', setter_id=equipo['elias'].id)
    estado = {f['id']: f['estado']['key'] for f in filas}
    ids = {via: l.id for via, l in leads_de_elias.items()}

    assert [f['id'] for f in filas if f['agendo']] == [ids['con_elias']]
    # Los que reservaron por otro lado no le cuentan, pero tampoco se disfrazan de "sin respuesta".
    assert {via: estado[i] for via, i in ids.items() if via != 'con_elias'} == {
        'con_paula': 'agendo_otra_via', 'en_un_taller': 'agendo_otra_via',
        'a_mano_por_un_closer': 'agendo_otra_via', 'sin_cita': 'sin_respuesta'}

    bloque = ca.bloque_setters(*SEP, setter_id=equipo['elias'].id, setter_nombre='Elias')
    assert bloque['agendas'] == 1
    assert next(p['n'] for p in bloque['funnel'] if p['paso'] == 'Agendaron') == 1
    assert bloque['conversion'] == 20.0  # 1 de 5 entrantes


@freeze_time(HOY)
def test_con_el_equipo_agendo_es_una_cita_de_cualquier_setter(db, equipo, leads_de_elias):
    agendaron = {f['cliente'] for f in ComercialService.leads(*SEP) if f['agendo']}

    # El de Paula sí: es trabajo del equipo de setting. El taller y el closer, no.
    assert agendaron == {'Lead @con_elias', 'Lead @con_paula'}
    assert ca.bloque_setters(*SEP)['agendas'] == 2


@freeze_time(HOY)
def test_el_nombre_de_manychat_se_cruza_con_el_usuario_del_setter(db, equipo):
    """ManyChat escribe el nombre a mano ('elías'), las citas guardan el id del usuario 'Elias'."""
    lead(db, 'Suyo.IG', setter='elías')
    agenda(db, equipo['marlon'], cliente(db, ig='@suyo.ig'), setter=equipo['elias'],
           creada=datetime(2026, 9, 11, 10, 0), reunion=datetime(2026, 9, 13, 15, 0))

    # Sin el id, sale del nombre; con el instagram normalizado igual que siempre (@, mayúsculas).
    solo_nombre = ComercialService.leads(*SEP, setter_nombre='Elias')
    assert [f['agendo'] for f in solo_nombre] == [True]
    assert ComercialService._setter_id_de('ELÍAS') == equipo['elias'].id


@freeze_time(HOY)
def test_la_lista_de_leads_del_setter_cierra_con_agendaron(client, db, equipo, leads_de_elias,
                                                           auth_headers):
    rango = {'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30',
             'compare': 'none'}
    for quien, extra in [('elias', {}),
                         ('director', {'rol': 'setters', 'miembro_id': equipo['elias'].id})]:
        headers = auth_headers(equipo[quien])
        resumen = client.get('/api/comercial/resumen', headers=headers,
                             query_string={**rango, **extra}).get_json()
        tabla = client.get(TABLA, headers=headers,
                           query_string={**rango, **extra, 'tabla': 'leads'}).get_json()
        # El drill-down de "Agendaron" filtra por la etiqueta "Agendó": tiene que dar el número.
        agendo = [f for f in tabla['filas'] if f['estado']['label'] == 'Agendó']
        assert resumen['actual']['agendas'] == tabla['totales']['agendas'] == len(agendo) == 1


# --- El marcador de cualificación no es una agenda ------------------------------------------------

@freeze_time(HOY)
def test_cualificar_un_lead_en_el_mazo_no_es_generar_una_agenda_ni_agendar(db, equipo):
    """`/setter/deck/confirm-qualified` deja un Appointment con result 'Cualificado' y la hora del
    clic como reunión, sin reserva detrás. No es trabajo de agenda: es haberlo cualificado."""
    lead(db, '@cualificado')
    marcador = agenda(db, equipo['marlon'], cliente(db, ig='cualificado'), setter=equipo['elias'],
                      creada=datetime(2026, 9, 11, 10, 0), reunion=datetime(2026, 9, 11, 10, 0))
    marcador.result = 'Cualificado'
    # Una agenda real con `result` vacío sí cuenta: el filtro no se lleva puestos los NULL.
    agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
           creada=datetime(2026, 9, 12, 10, 0), reunion=datetime(2026, 9, 14, 15, 0)).result = None
    db.session.commit()

    elias = equipo['elias'].id
    bloque = ca.bloque_setters(*SEP, setter_id=elias, setter_nombre='Elias')
    assert (bloque['generadas'], bloque['agendas']) == (1, 0)
    assert ComercialService.leads(*SEP, setter_id=elias, setter_nombre='Elias')[0]['estado']['key'] \
        == 'sin_respuesta'
    # El closer al que quedó asignado lo sigue viendo como siempre: esto es solo del setter.
    assert len(ComercialService.agendas(*SEP, closer_id=equipo['marlon'].id)) == 2


# --- El reporte del día de la dirección -----------------------------------------------------------

@freeze_time(HOY)
def test_el_reporte_del_dia_cuenta_las_agendas_que_el_setter_genero_hoy(client, db, equipo,
                                                                        auth_headers):
    """Mismo número que "Agendas generadas" con el período "Hoy", no las reuniones de hoy."""
    for hora in (9, 10):  # dos reservadas hoy, para pasado mañana
        agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
               creada=datetime(2026, 10, 1, hora, 0), reunion=datetime(2026, 10, 3, 15, 0))
    # Y una que se reúne hoy pero se reservó el 28/09: no es trabajo de hoy.
    agenda(db, equipo['marlon'], cliente(db), setter=equipo['elias'],
           creada=datetime(2026, 9, 28, 9, 0), reunion=datetime(2026, 10, 1, 15, 0))

    datos = client.get('/api/comercial/reporte/hoy', headers=auth_headers(equipo['director'])).get_json()
    elias = next(p for p in datos['personas'] if p['nombre'] == 'Elias')
    hoy = client.get('/api/comercial/resumen', headers=auth_headers(equipo['elias']),
                     query_string={'period': 'hoy', 'compare': 'none'}).get_json()

    assert elias['resumen'].endswith('· 2 agendas')
    assert hoy['actual']['generadas'] == 2


# --- Los closers no cambian -----------------------------------------------------------------------

@freeze_time(HOY)
def test_el_closer_sigue_viendo_cada_cita_del_lead_que_reagendo(db, equipo):
    lead = cliente(db, 'Reagendo')
    for dia in (3, 6):
        agenda(db, equipo['marlon'], lead, setter=equipo['elias'],
               creada=datetime(2026, 9, dia, 10, 0), reunion=datetime(2026, 9, dia + 2, 15, 0))

    marlon = equipo['marlon'].id
    assert len(ComercialService.agendas(*SEP, closer_id=marlon)) == 2
    assert ca.bloque_closers(*SEP, closer_id=marlon, closer_nombre='Marlon')['agendas'] == 2



@freeze_time(HOY)
def test_las_agendas_del_closer_se_siguen_contando_por_la_reunion(client, db, equipo, auth_headers):
    agenda(db, equipo['marlon'], cliente(db, 'Reunion en septiembre'), setter=equipo['elias'],
           creada=datetime(2026, 8, 30, 9, 0), reunion=datetime(2026, 9, 2, 15, 0))
    agenda(db, equipo['marlon'], cliente(db, 'Reunion en octubre'), setter=equipo['elias'],
           creada=datetime(2026, 9, 28, 14, 0), reunion=datetime(2026, 10, 3, 15, 0))

    marlon = equipo['marlon'].id
    assert ca.bloque_closers(*SEP, closer_id=marlon, closer_nombre='Marlon')['agendas'] == 1
    assert [f['cliente'] for f in ComercialService.agendas(*SEP, closer_id=marlon)] == [
        'Reunion en septiembre']

    tabla = client.get(TABLA, headers=auth_headers(equipo['director']), query_string={
        'period': 'custom', 'start_date': '2026-09-01', 'end_date': '2026-09-30',
        'rol': 'closers', 'tabla': 'agendas'}).get_json()
    assert [f['cliente'] for f in tabla['filas']] == ['Reunion en septiembre']
