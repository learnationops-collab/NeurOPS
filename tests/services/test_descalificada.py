"""«Descalificado» (23/10/2026): el botón del closer en la confirmación y lo que ve la dirección.

El closer ve al confirmar que el lead no calificaba y lo marca: es una cancelación por decisión suya,
con estado propio (`closer_result` 'Descalificado', estado `descalificada`) para medir cuántas agendas
descalifican los closers. Aparte, el formulario de Agendas 2.0 corta solo a quien elige una opción
que descalifica: ese lead nunca llega a ser una agenda (`SchedIntento`) y se cuenta por otro lado.
Lo que se prueba:

  · el estado se reconoce, con su nombre y su tooltip, en el libro, el vocabulario, las filas y la ficha;
  · va con las descartadas, en su propio grupo del panel Estados, y no suma a las realizadas;
  · el panel Estados trae las dos cuentas (por el closer y por el formulario);
  · en el tablero de setters cuenta como ocurrida (ya está resuelta) y se dice aparte.
"""
import itertools
from datetime import date, datetime, timedelta

import pytest
from freezegun import freeze_time

from app.agendas_v2.modelos import SchedIntento
from app.models import Appointment, Client
from app.services import descalificados_service, setter_analitica
from app.services.closer_agendas_service import AYUDA_ESTADO, ESTADOS, derivar_estado
from app.services.comercial_analitica import GRUPO_DE_ESTADO, bloque_closers, estados_de
from app.services.comercial_service import DESCARTADAS, POST_CALL, POST_CALL_A_CLOSER_RESULT, ComercialService
from app.services.estado_lead import resolver_estado

HOY = '2026-10-20 18:00:00'
DESDE = date(2026, 10, 1)
HASTA = date(2026, 10, 31)

_n = itertools.count(1)


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Elias', email='elias@thelearnation.com')


def cliente(db, nombre='Lead'):
    c = Client(full_name=nombre, email=f'desc{next(_n)}@test.local')
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, cuando=datetime(2026, 10, 25, 15, 0), closer_result='Pendiente', **campos):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result='Confirmado',
                    closer_result=closer_result, origin='Setter',
                    created_at=datetime(2026, 10, 10, 12, 0), **campos)
    db.session.add(a)
    db.session.commit()
    return a


def intento(db, estado='descalificada', creado=datetime(2026, 10, 12, 10, 0), email=None):
    fila = SchedIntento(evento_id='ev1', email=email or f'form{next(_n)}@test.local', estado=estado,
                        creado_en=creado)
    db.session.add(fila)
    db.session.commit()
    return fila


# --- El estado ------------------------------------------------------------------------------------

def test_derivar_estado_la_reconoce_aunque_la_llamada_sea_futura():
    ahora = datetime(2026, 10, 20, 18, 0)
    futura = Appointment(closer_result='Descalificado', start_time=ahora + timedelta(days=3))
    pasada = Appointment(closer_result=' descalificado ', start_time=ahora - timedelta(days=3))

    assert derivar_estado(futura, ahora) == derivar_estado(pasada, ahora) == 'descalificada'


def test_no_lead_es_lo_mismo_que_descalificado():
    """El dueño (23/10/2026): «cuenta a los que se marcaron como no lead como descalificados». El valor
    crudo no se migra: se lee con el nombre nuevo, sea del closer, del árbol de Resultado o de la hoja."""
    ahora = datetime(2026, 10, 20, 18, 0)

    for crudo in ('No Lead', 'no lead', ' NO LEAD '):
        assert derivar_estado(Appointment(closer_result=crudo, start_time=ahora - timedelta(days=2)),
                              ahora) == 'descalificada'
    assert 'no_lead' not in {e['key'] for e in ESTADOS}
    assert 'no_lead' not in {e['key'] for e in POST_CALL}
    assert 'no_lead' not in GRUPO_DE_ESTADO and 'no_lead' not in DESCARTADAS


def test_el_libro_del_closer_la_tiene_con_su_nombre_y_su_tooltip():
    por_key = {e['key']: e for e in ESTADOS}

    assert por_key['descalificada']['label'] == 'Descalificada'
    assert por_key['descalificada']['desc'] == AYUDA_ESTADO['descalificada']


def test_el_vocabulario_la_trae_no_editable_y_con_ayuda():
    """Solo se fija desde la confirmación de la ficha: no está en lo que el modal deja corregir."""
    por_key = {e['key']: e for e in POST_CALL}

    assert por_key['descalificada'] == {
        'key': 'descalificada', 'label': 'Descalificada', 'tone': 'error', 'editable': False,
        'ayuda': AYUDA_ESTADO['descalificada']}
    assert 'descalificada' not in POST_CALL_A_CLOSER_RESULT
    assert 'descalificada' in DESCARTADAS


@freeze_time(HOY)
def test_la_fila_va_con_las_descartadas_y_no_suma_a_las_realizadas(db, closer):
    descalificada = agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)

    fila = {f['id']: f for f in ComercialService.agendas(DESDE, HASTA)}[descalificada.id]

    assert fila['post_call']['key'] == 'descalificada'
    assert fila['post_call']['ayuda'] == AYUDA_ESTADO['descalificada']
    assert fila['descartada'] is True
    assert (fila['realizada'], fila['asistio']) == (False, False)
    totales = ComercialService.totales_agendas([fila])
    assert (totales['agendas'], totales['realizadas'], totales['asistieron']) == (1, 0, 0)


# --- El panel Estados -----------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_panel_estados_la_pone_en_su_propio_grupo(db, closer):
    agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)
    agenda(db, closer, cliente(db), closer_result='Lead Perdido', closer_processed=True)

    estados = {e['key']: e for e in estados_de(ComercialService.agendas(DESDE, HASTA))}

    assert GRUPO_DE_ESTADO['descalificada'] == 'descalificadas'
    assert estados['descalificada']['grupo'] == 'descalificadas'
    assert estados['descalificada']['n'] == 1
    assert estados['descalificada']['filtro'] == 'Descalificada'
    assert estados['descalificada']['ayuda'] == AYUDA_ESTADO['descalificada']
    # No se mezcla con «Descartadas»: es lo que la dirección quiere contar aparte.
    assert estados['lead_perdido']['grupo'] == 'descartadas'
    # Su propio color en la dona: el rojo ya es el del no show.
    assert estados['descalificada']['tone'] == 'cat-6'


@freeze_time(HOY)
def test_el_bloque_de_closers_cuenta_las_del_closer_y_las_del_formulario(db, closer):
    agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)
    agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)
    agenda(db, closer, cliente(db))
    intento(db)
    intento(db)
    intento(db)

    bloque = bloque_closers(DESDE, HASTA)

    assert bloque['descalificadas'] == {'closer': 2, 'formulario': 3}
    # Las del closer son agendas: siguen en el total del período.
    assert bloque['agendas'] == 3


@freeze_time(HOY)
def test_los_no_lead_cuentan_como_descalificadas_del_closer(db, closer):
    """Los marcados «No Lead» antes del botón nuevo se suman a los descalificados, en la misma barra."""
    agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)
    agenda(db, closer, cliente(db), closer_result='No Lead', closer_processed=True)
    agenda(db, closer, cliente(db), closer_result='No Lead', closer_processed=True)

    bloque = bloque_closers(DESDE, HASTA)
    estados = {e['key']: e for e in bloque['estados']}

    assert bloque['descalificadas']['closer'] == 3
    assert estados['descalificada']['n'] == 3 and 'no_lead' not in estados
    assert all(f['descartada'] for f in ComercialService.agendas(DESDE, HASTA))


@freeze_time(HOY)
def test_con_un_closer_elegido_el_formulario_no_se_mezcla(db, closer, make_user):
    otro = make_user(role='closer', username='Otro', email='otro@thelearnation.com')
    agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)
    agenda(db, otro, cliente(db), closer_result='Descalificado', closer_processed=True)
    intento(db)

    bloque = bloque_closers(DESDE, HASTA, closer_id=closer.id)

    # Esos leads no llegaron a tener closer: acotar a uno y mostrar el total del equipo mentiría.
    assert bloque['descalificadas'] == {'closer': 1, 'formulario': None}


# --- Las del formulario ---------------------------------------------------------------------------

def test_por_formulario_cuenta_solo_las_descalificadas_del_periodo(db):
    intento(db)
    intento(db, creado=datetime(2026, 10, 31, 23, 59))
    intento(db, estado='incompleta')
    intento(db, creado=datetime(2026, 9, 30, 23, 59))
    intento(db, creado=datetime(2026, 11, 1, 0, 1))

    assert descalificados_service.por_formulario(DESDE, HASTA) == 2


def test_un_lead_descalificado_por_el_formulario_no_es_una_agenda(db, closer):
    """Nunca llega a tener closer: el panel de agendas no lo ve, por eso se cuenta aparte."""
    intento(db)

    assert ComercialService.agendas(DESDE, HASTA) == []
    assert descalificados_service.por_formulario(DESDE, HASTA) == 1


# --- La ficha -------------------------------------------------------------------------------------

def test_la_ficha_la_trata_como_un_descarte_con_su_propio_nombre():
    descalificada = resolver_estado(estado_agenda='descalificada')
    perdida = resolver_estado(estado_agenda='lead_perdido')

    assert (descalificada['clave'], descalificada['etiqueta']) == ('descalificada', 'Descalificada')
    assert perdida['clave'] == 'descartado'
    # Abre donde abre un descartado, con las mismas pestañas.
    assert descalificada['pestana_por_defecto'] == perdida['pestana_por_defecto'] == 'hist'
    assert descalificada['pestanas'] == perdida['pestanas']


def test_el_historial_de_la_ficha_lleva_el_chip_con_su_tooltip(db, closer):
    from app.services.ficha_lead_secciones import historial

    cli = cliente(db)
    agenda(db, closer, cli, cuando=datetime(2026, 10, 12, 15, 0), closer_result='Descalificado',
           closer_processed=True)

    filas = historial(Appointment.query.filter_by(client_id=cli.id).all(), datetime(2026, 10, 20, 18, 0))['agendas']

    assert filas[0]['chip'] == {'label': 'Descalificada', 'tone': 'error', 'ayuda': AYUDA_ESTADO['descalificada']}
    assert filas[0]['post_call'] == 'descalificada'


# --- El tablero de setters ------------------------------------------------------------------------

@freeze_time(HOY)
def test_para_el_setter_cuenta_como_ocurrida_aunque_la_llamada_sea_futura(db, closer):
    """El closer ya la resolvió en la confirmación: no es «por venir» ni «sin reporte»."""
    agenda(db, closer, cliente(db), closer_result='Descalificado', closer_processed=True)
    agenda(db, closer, cliente(db))

    despues = setter_analitica.despues_de(ComercialService.agendas(DESDE, HASTA))

    assert despues['descalificadas'] == 1
    assert despues['ocurridas'] == 1
    assert despues['por_venir'] == 1
    assert despues['sin_reporte'] == 0
