"""/api/comercial: el dashboard comercial y "Mis datos" de closers y setters.

Lo que de verdad hay que probar acá es el ALCANCE, porque es lo único que separa "Mis datos" de
los datos de todo el equipo: el frontend esconde el selector de equipo, pero esconder un control
no protege nada. Un closer que pida los datos de otro closer tiene que recibir los suyos.

También que corregir un estado escriba en las MISMAS columnas que usa el mazo del closer y deje
su rastro en `lead_event_logs` con el valor anterior — sin eso, un error del director no se
podría revertir.
"""
import itertools
from datetime import date, datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import (
    Appointment, Client, CloserDailyReport, FinancialSale, LeadEventLog, ReporteDirector,
)

HOY = '2026-09-17 21:30:00'
CONTEXTO = '/api/comercial/contexto'
RESUMEN = '/api/comercial/resumen'
TABLA = '/api/comercial/tabla'
REPORTE_HOY = '/api/comercial/reporte/hoy'
REPORTE = '/api/comercial/reporte'
REPORTES = '/api/comercial/reportes'
CONSTANCIA = '/api/comercial/reporte/constancia'

_emails = itertools.count(1)


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='mario'),
        'admin': make_user(role='admin', username='root'),
        'closer_a': make_user(role='closer', username='Marlon', email='marlon@thelearnation.com'),
        'closer_b': make_user(role='closer', username='Nerina', email='nerina@thelearnation.com'),
        'setter': make_user(role='setter', username='Elias'),
        'triage': make_user(role='triage', username='tri'),
    }


def cliente(db, nombre='Cliente'):
    c = Client(full_name=nombre, email=f'cliente{next(_emails)}@test.local')
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, cuando=datetime(2026, 9, 10, 15, 0), closer_result='Pendiente',
           result='Confirmado', setter=None):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result=result,
                    closer_result=closer_result, origin='Setter',
                    setter_id=setter.id if setter else None, created_at=cuando - timedelta(days=1))
    db.session.add(a)
    db.session.commit()
    return a


# --- Quien entra ------------------------------------------------------------------------------

def test_sin_sesion_el_dashboard_no_responde(client, equipo):
    assert client.get(CONTEXTO).status_code == 401


def test_un_rol_ajeno_al_area_comercial_no_entra(client, equipo, auth_headers):
    assert client.get(CONTEXTO, headers=auth_headers(equipo['triage'])).status_code == 403


@pytest.mark.parametrize('quien', ['director', 'admin', 'closer_a', 'setter'])
def test_la_direccion_los_closers_y_los_setters_entran(client, equipo, auth_headers, quien):
    assert client.get(CONTEXTO, headers=auth_headers(equipo[quien])).status_code == 200


# --- Alcance ----------------------------------------------------------------------------------

def test_el_contexto_dice_que_puede_elegir_cada_rol(client, equipo, auth_headers):
    director = client.get(CONTEXTO, headers=auth_headers(equipo['director'])).get_json()
    closer = client.get(CONTEXTO, headers=auth_headers(equipo['closer_a'])).get_json()
    setter = client.get(CONTEXTO, headers=auth_headers(equipo['setter'])).get_json()

    assert (director['puede_elegir_equipo'], director['puede_reportar']) == (True, True)
    assert [m['nombre'] for m in director['miembros']] == ['Marlon', 'Nerina']

    # "Mis datos": ni selector de equipo, ni seccion de Reportar, y el rol fijo en el suyo.
    assert (closer['puede_elegir_equipo'], closer['puede_reportar']) == (False, False)
    assert (closer['rol'], closer['miembro_id']) == ('closers', equipo['closer_a'].id)
    assert (setter['rol'], setter['miembro_id']) == ('setters', equipo['setter'].id)


@freeze_time(HOY)
def test_un_closer_solo_ve_sus_agendas_aunque_pida_las_de_otro(client, db, equipo, auth_headers):
    agenda(db, equipo['closer_a'], cliente(db, 'Suyo'))
    agenda(db, equipo['closer_b'], cliente(db, 'De Nerina'))

    respuesta = client.get(
        TABLA, headers=auth_headers(equipo['closer_a']),
        query_string={'tabla': 'agendas', 'period': 'mes', 'miembro_id': equipo['closer_b'].id})

    filas = respuesta.get_json()['filas']
    assert [f['cliente'] for f in filas] == ['Suyo']


@freeze_time(HOY)
def test_un_closer_no_puede_cambiarse_el_rol_a_setters(client, db, equipo, auth_headers):
    respuesta = client.get(RESUMEN, headers=auth_headers(equipo['closer_a']),
                           query_string={'rol': 'setters', 'period': 'mes'})

    assert respuesta.get_json()['rol'] == 'closers'


@freeze_time(HOY)
def test_el_director_ve_al_equipo_completo_y_puede_acotar_a_una_persona(client, db, equipo, auth_headers):
    agenda(db, equipo['closer_a'], cliente(db, 'De Marlon'))
    agenda(db, equipo['closer_b'], cliente(db, 'De Nerina'))
    headers = auth_headers(equipo['director'])

    todo = client.get(TABLA, headers=headers, query_string={'period': 'mes'}).get_json()
    solo_nerina = client.get(TABLA, headers=headers, query_string={
        'period': 'mes', 'miembro_id': equipo['closer_b'].id}).get_json()

    assert len(todo['filas']) == 2
    assert [f['cliente'] for f in solo_nerina['filas']] == ['De Nerina']


# --- Los numeros cierran con el filtro --------------------------------------------------------

@freeze_time(HOY)
def test_los_totales_se_calculan_sobre_las_filas_que_devuelve_la_misma_respuesta(client, db, equipo,
                                                                                  auth_headers):
    agenda(db, equipo['closer_a'], cliente(db, 'Asistio'), closer_result='Show up')
    agenda(db, equipo['closer_a'], cliente(db, 'No vino'), closer_result='No Show')
    agenda(db, equipo['closer_b'], cliente(db, 'De otra'), closer_result='Show up')

    datos = client.get(TABLA, headers=auth_headers(equipo['director']), query_string={
        'period': 'mes', 'miembro_id': equipo['closer_a'].id}).get_json()

    assert len(datos['filas']) == datos['totales']['agendas'] == 2
    assert datos['totales']['show_up'] == 50.0


@freeze_time(HOY)
def test_el_resumen_y_la_tabla_dan_el_mismo_show_up(client, db, equipo, auth_headers):
    agenda(db, equipo['closer_a'], cliente(db, 'Asistio'), closer_result='Show up')
    agenda(db, equipo['closer_a'], cliente(db, 'No vino'), closer_result='No Show')
    headers = auth_headers(equipo['director'])
    parametros = {'period': 'mes', 'compare': 'none'}

    resumen = client.get(RESUMEN, headers=headers, query_string=parametros).get_json()
    tabla = client.get(TABLA, headers=headers, query_string=parametros).get_json()

    assert resumen['actual']['show_up'] == tabla['totales']['show_up'] == 50.0


# --- Corregir el estado -----------------------------------------------------------------------

@freeze_time(HOY)
def test_corregir_el_post_call_escribe_en_closer_result_y_marca_la_agenda_reportada(
        client, db, equipo, auth_headers):
    a = agenda(db, equipo['closer_a'], cliente(db, 'Luciana'), closer_result='Pendiente')

    respuesta = client.patch(f'/api/comercial/agendas/{a.id}', headers=auth_headers(equipo['director']),
                             json={'campo': 'post_call', 'valor': 'no_show'})

    assert respuesta.status_code == 200
    assert (a.closer_result, a.closer_processed) == ('No Show', True)


@freeze_time(HOY)
def test_volver_a_pendiente_devuelve_la_agenda_al_mazo(client, db, equipo, auth_headers):
    a = agenda(db, equipo['closer_a'], cliente(db, 'Luciana'), closer_result='Show up')

    client.patch(f'/api/comercial/agendas/{a.id}', headers=auth_headers(equipo['director']),
                 json={'campo': 'post_call', 'valor': 'pendiente'})

    assert (a.closer_result, a.closer_processed) == ('Pendiente', False)


@freeze_time(HOY)
def test_cada_correccion_deja_el_valor_anterior_en_la_auditoria(client, db, equipo, auth_headers):
    a = agenda(db, equipo['closer_a'], cliente(db, 'Luciana'), closer_result='Show up')

    client.patch(f'/api/comercial/agendas/{a.id}', headers=auth_headers(equipo['director']),
                 json={'campo': 'post_call', 'valor': 'no_show'})

    evento = LeadEventLog.query.filter_by(appointment_id=a.id, action_type='status_changed').first()
    assert evento is not None
    assert "'Show up'" in evento.description and "'No Show'" in evento.description


@freeze_time(HOY)
def test_un_closer_no_puede_corregir_la_agenda_de_otro(client, db, equipo, auth_headers):
    ajena = agenda(db, equipo['closer_b'], cliente(db, 'De Nerina'))

    respuesta = client.patch(f'/api/comercial/agendas/{ajena.id}',
                             headers=auth_headers(equipo['closer_a']),
                             json={'campo': 'post_call', 'valor': 'no_show'})

    assert respuesta.status_code == 403
    assert ajena.closer_result == 'Pendiente'


@freeze_time(HOY)
def test_un_closer_si_puede_corregir_la_suya(client, db, equipo, auth_headers):
    propia = agenda(db, equipo['closer_a'], cliente(db, 'Suyo'))

    respuesta = client.patch(f'/api/comercial/agendas/{propia.id}',
                             headers=auth_headers(equipo['closer_a']),
                             json={'campo': 'pre_call', 'valor': 'cancelo'})

    assert respuesta.status_code == 200
    assert propia.result == 'Cancelado'


@freeze_time(HOY)
def test_un_setter_puede_corregir_la_agenda_que_genero(client, db, equipo, auth_headers):
    generada = agenda(db, equipo['closer_a'], cliente(db, 'Suyo'), setter=equipo['setter'])

    respuesta = client.patch(f'/api/comercial/agendas/{generada.id}',
                             headers=auth_headers(equipo['setter']),
                             json={'campo': 'pre_call', 'valor': 'confirmada'})

    assert respuesta.status_code == 200


@freeze_time(HOY)
@pytest.mark.parametrize('cuerpo', [
    {'campo': 'post_call', 'valor': 'venta'},       # derivado del cruce con la venta, no editable
    {'campo': 'post_call', 'valor': 'seguimiento'},  # lo escribe el flujo de seguimientos
    {'campo': 'closer_id', 'valor': 3},              # cambiar de duenio no es "corregir un estado"
    {'campo': 'pre_call', 'valor': 'cualquier_cosa'},
])
def test_no_se_admite_cualquier_campo_ni_cualquier_valor(client, db, equipo, auth_headers, cuerpo):
    a = agenda(db, equipo['closer_a'], cliente(db, 'Luciana'))

    respuesta = client.patch(f'/api/comercial/agendas/{a.id}',
                             headers=auth_headers(equipo['director']), json=cuerpo)

    assert respuesta.status_code == 400
    assert (a.closer_result, a.result) == ('Pendiente', 'Confirmado')


def test_corregir_una_agenda_que_no_existe_da_404(client, db, equipo, auth_headers):
    respuesta = client.patch('/api/comercial/agendas/99999', headers=auth_headers(equipo['director']),
                             json={'campo': 'post_call', 'valor': 'no_show'})

    assert respuesta.status_code == 404


# --- Reportar ---------------------------------------------------------------------------------

@pytest.mark.parametrize('quien', ['closer_a', 'setter'])
def test_reportar_es_solo_de_la_direccion(client, db, equipo, auth_headers, quien):
    headers = auth_headers(equipo[quien])

    assert client.get(REPORTE_HOY, headers=headers).status_code == 403
    assert client.post(REPORTE, headers=headers, json={}).status_code == 403
    assert client.get(REPORTES, headers=headers).status_code == 403
    assert client.get(CONSTANCIA, headers=headers).status_code == 403


@freeze_time(HOY)
def test_el_paso_uno_trae_una_fila_por_persona_con_su_estado_de_reporte(client, db, equipo, auth_headers):
    agenda(db, equipo['closer_a'], cliente(db, 'De hoy'), cuando=datetime(2026, 9, 17, 10, 0),
           closer_result='Show up')

    datos = client.get(REPORTE_HOY, headers=auth_headers(equipo['director'])).get_json()

    por_nombre = {p['nombre']: p for p in datos['personas']}
    assert set(por_nombre) == {'Marlon', 'Nerina', 'Elias'}
    # Nadie cargó su reporte diario todavía.
    assert por_nombre['Marlon']['estado']['key'] == 'sin_reportar'
    assert por_nombre['Marlon']['actividad'][0]['cliente'] == 'De hoy'
    assert datos['closers']['agendas'] == 1


@freeze_time(HOY)
def test_la_constancia_separa_el_dia_sin_cargar_del_dia_sin_actividad(client, db, equipo, auth_headers):
    marlon = equipo['closer_a']
    # Dos días con llamadas: uno con su reporte diario cargado y otro sin él. El resto del rango,
    # sin una sola llamada agendada.
    agenda(db, marlon, cliente(db, 'Del 15'), cuando=datetime(2026, 9, 15, 15, 0), closer_result='Show up')
    agenda(db, marlon, cliente(db, 'Del 16'), cuando=datetime(2026, 9, 16, 15, 0), closer_result='Show up')
    db.session.add(CloserDailyReport(closer_id=marlon.id, date=date(2026, 9, 15)))
    db.session.commit()

    datos = client.get(CONSTANCIA, headers=auth_headers(equipo['director']),
                       query_string={'dias': 14}).get_json()

    fila = next(p for p in datos['personas'] if p['nombre'] == 'Marlon')
    por_fecha = {c['fecha']: c['estado'] for c in fila['celdas']}
    assert len(fila['celdas']) == len(datos['dias']) == 14
    assert datos['desde'] == '2026-09-04' and datos['hasta'] == '2026-09-17'
    assert por_fecha['2026-09-15'] == 'completo'
    assert por_fecha['2026-09-16'] == 'sin_cargar'
    assert por_fecha['2026-09-10'] == 'sin_actividad'
    # La tasa sale sobre los días que tenía algo que cargar, no sobre los 14 del rango.
    assert (fila['reportados'], fila['esperados'], fila['tasa']) == (1, 2, 50)


@freeze_time(HOY)
def test_reportar_con_llamadas_sin_resultado_queda_incompleto(client, db, equipo, auth_headers):
    marlon = equipo['closer_a']
    agenda(db, marlon, cliente(db, 'Sin resultado'), cuando=datetime(2026, 9, 16, 15, 0),
           closer_result='Pendiente')
    db.session.add(CloserDailyReport(closer_id=marlon.id, date=date(2026, 9, 16)))
    db.session.commit()

    datos = client.get(CONSTANCIA, headers=auth_headers(equipo['director'])).get_json()

    fila = next(p for p in datos['personas'] if p['nombre'] == 'Marlon')
    por_fecha = {c['fecha']: c['estado'] for c in fila['celdas']}
    assert por_fecha['2026-09-16'] == 'incompleto'
    # Cargó el día, así que cuenta como reportado igual: incompleto no es lo mismo que no cargar.
    assert (fila['reportados'], fila['esperados'], fila['sin_cargar']) == (1, 1, 0)


@freeze_time(HOY)
def test_sin_dias_que_cargar_la_tasa_de_constancia_es_nula_y_no_cero(client, db, equipo, auth_headers):
    datos = client.get(CONSTANCIA, headers=auth_headers(equipo['director'])).get_json()

    fila = next(p for p in datos['personas'] if p['nombre'] == 'Nerina')
    assert fila['esperados'] == 0
    # Un 0% sobre cero días de trabajo sería una afirmación falsa, no un dato.
    assert fila['tasa'] is None


@freeze_time(HOY)
def test_guardar_el_reporte_lo_deja_en_el_historial(client, db, equipo, auth_headers):
    headers = auth_headers(equipo['director'])
    cuerpo = {
        'grupal': {'closers': 'Revisamos el guion de confirmación', 'setters': 'Openings nuevos'},
        'individual': [{'miembro_id': equipo['closer_a'].id, 'trabajo': True, 'texto': 'Objeciones de precio'},
                       {'miembro_id': equipo['closer_b'].id, 'trabajo': False}],
        'listas': {'victorias': ['Cerró Luciana'], 'mejoras': [], 'proximos': ['Seguimiento de Tomás']},
    }

    assert client.post(REPORTE, headers=headers, json=cuerpo).status_code == 200

    historial = client.get(REPORTES, headers=headers).get_json()['reportes']
    assert len(historial) == 1
    assert historial[0]['fecha'] == '2026-09-17'
    assert historial[0]['grupal']['closers'] == 'Revisamos el guion de confirmación'
    por_id = {p['miembro_id']: p for p in historial[0]['individual']}
    # "No hizo falta" también se guarda: es distinto de no haber respondido.
    assert por_id[equipo['closer_b'].id]['trabajo'] is False


@freeze_time(HOY)
def test_guardar_dos_veces_el_mismo_dia_actualiza_en_vez_de_duplicar(client, db, equipo, auth_headers):
    headers = auth_headers(equipo['director'])
    client.post(REPORTE, headers=headers, json={'grupal': {'closers': 'primera versión'}})
    client.post(REPORTE, headers=headers, json={'grupal': {'closers': 'corregido'}})

    assert ReporteDirector.query.count() == 1
    assert ReporteDirector.query.first().grupal_closers == 'corregido'


@freeze_time(HOY)
def test_el_registro_por_persona_se_reemplaza_entero_al_reguardar(client, db, equipo, auth_headers):
    headers = auth_headers(equipo['director'])
    client.post(REPORTE, headers=headers, json={'individual': [
        {'miembro_id': equipo['closer_a'].id, 'trabajo': True, 'texto': 'primera'},
        {'miembro_id': equipo['closer_b'].id, 'trabajo': True, 'texto': 'otra'}]})
    client.post(REPORTE, headers=headers, json={'individual': [
        {'miembro_id': equipo['closer_a'].id, 'trabajo': True, 'texto': 'corregida'}]})

    individual = client.get(REPORTES, headers=headers).get_json()['reportes'][0]['individual']

    assert [(p['nombre'], p['texto']) for p in individual] == [('Marlon', 'corregida')]


@freeze_time(HOY)
def test_el_registro_de_una_persona_lista_solo_sus_dias(client, db, equipo, auth_headers):
    headers = auth_headers(equipo['director'])
    client.post(REPORTE, headers=headers, json={'individual': [
        {'miembro_id': equipo['closer_a'].id, 'trabajo': True, 'texto': 'objeciones'},
        {'miembro_id': equipo['closer_b'].id, 'trabajo': False}]})

    registro = client.get(REPORTES, headers=headers,
                          query_string={'miembro_id': equipo['closer_a'].id}).get_json()

    assert registro['total'] == registro['trabajados'] == 1
    assert registro['dias'][0]['texto'] == 'objeciones'


@freeze_time(HOY)
def test_no_se_guardan_respuestas_de_gente_que_no_es_del_equipo(client, db, equipo, auth_headers):
    headers = auth_headers(equipo['director'])

    client.post(REPORTE, headers=headers, json={'individual': [
        {'miembro_id': equipo['triage'].id, 'trabajo': True, 'texto': 'no corresponde'},
        {'miembro_id': 99999, 'trabajo': True, 'texto': 'tampoco'}]})

    assert client.get(REPORTES, headers=headers).get_json()['reportes'][0]['individual'] == []
