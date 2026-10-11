"""«Archivada sin reporte» (10/10/2026): el estado propio de las agendas que archiva el barrido.

Hasta ese día el barrido de mantenimiento (`CloserService.archive_stale_backlog`) las dejaba como
'Lead Perdido', el mismo valor con el que un closer descarta un lead, y el dueño no entendía qué
quería decir el estado. Lo que se prueba:

  · el barrido escribe el estado nuevo, terminal y con su firma;
  · se trata igual que «Lead perdido» en todo lo demás: descartada (fuera de «Vigentes»), mismo
    grupo de Analizar, no bloquea el horario, y ningún número de closers ni de setters cambia;
  · los dos estados llevan su tooltip (`ayuda`) en el vocabulario, en las filas y en la ficha.
"""
import itertools
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client, FinancialSale
from app.services import comercial_analitica as ca
from app.services.closer_agendas_service import (
    ARCHIVADA_SIN_REPORTE, AYUDA_ESTADO, NOTA_ARCHIVADA, derivar_estado)
from app.services.closer_service import CloserService
from app.services.comercial_service import DESCARTADAS, POST_CALL, ComercialService
from app.services.estado_lead import resolver_estado

HOY = '2026-09-17 21:30:00'
DESDE = datetime(2026, 9, 1).date()
HASTA = datetime(2026, 9, 30).date()

_n = itertools.count(1)


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias')


def cliente(db, nombre='Cliente', email=None):
    c = Client(full_name=nombre, email=email or f'archivada{next(_n)}@test.local')
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, cuando=datetime(2026, 9, 10, 15, 0), closer_result='Pendiente',
           result='Confirmado', **campos):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result=result,
                    closer_result=closer_result, origin='Setter', created_at=cuando - timedelta(days=1),
                    **campos)
    db.session.add(a)
    db.session.commit()
    return a


# --- El barrido -----------------------------------------------------------------------------------

@freeze_time(HOY)
def test_el_barrido_archiva_sin_reporte_y_no_como_lead_perdido(db, marlon):
    vieja = agenda(db, marlon, cliente(db, 'Vieja'), cuando=datetime(2026, 8, 1, 15, 0),
                   result='Pendiente', closer_notes='Le escribí dos veces')
    reciente = agenda(db, marlon, cliente(db, 'Reciente'), cuando=datetime(2026, 9, 1, 15, 0),
                      result='Pendiente')
    descartada = agenda(db, marlon, cliente(db, 'Descartada'), cuando=datetime(2026, 8, 1, 16, 0),
                        closer_result='Lead Perdido', closer_processed=True)

    resultado = CloserService.archive_stale_backlog(days=30)

    assert resultado['count'] == 1
    assert vieja.closer_result == ARCHIVADA_SIN_REPORTE == 'Archivada sin reporte'
    assert vieja.closer_processed is True and vieja.seguimiento_realizado is True
    # La firma va DESPUÉS de lo que ya tenía la nota: es lo que la migración y el script de
    # corrección reconocen.
    assert vieja.closer_notes.startswith('Le escribí dos veces\n' + NOTA_ARCHIVADA)
    assert reciente.closer_result == 'Pendiente'
    assert descartada.closer_result == 'Lead Perdido'


@freeze_time(HOY)
def test_una_archivada_ya_no_bloquea_el_horario_ni_vuelve_a_archivarse(db, marlon):
    a = agenda(db, marlon, cliente(db, 'Vieja'), cuando=datetime(2026, 8, 1, 15, 0), result='Pendiente')
    CloserService.archive_stale_backlog(days=30)

    assert CloserService.archive_stale_backlog(days=30)['count'] == 0
    # Mismo criterio que el conflicto de horario de `BookingService`: lo procesado no bloquea.
    assert a.closer_processed is True


def test_derivar_estado_la_reconoce_aunque_la_llamada_sea_futura():
    ahora = datetime(2026, 9, 17, 21, 30)
    pasada = Appointment(closer_result='Archivada sin reporte', start_time=ahora - timedelta(days=40))
    futura = Appointment(closer_result='archivada sin reporte ', start_time=ahora + timedelta(days=1))

    assert derivar_estado(pasada, ahora) == derivar_estado(futura, ahora) == 'archivada_sin_reporte'
    assert derivar_estado(Appointment(closer_result='Lead Perdido', start_time=ahora), ahora) == 'lead_perdido'


# --- Las listas -----------------------------------------------------------------------------------

@freeze_time(HOY)
def test_va_con_las_descartadas_y_cada_una_con_su_nombre_y_su_tooltip(db, marlon):
    archivada = agenda(db, marlon, cliente(db, 'Archivada'), closer_result='Archivada sin reporte',
                       closer_processed=True)
    perdida = agenda(db, marlon, cliente(db, 'Perdida'), closer_result='Lead Perdido',
                     closer_processed=True)

    por_id = {f['id']: f for f in ComercialService.agendas(DESDE, HASTA)}

    assert por_id[archivada.id]['post_call'] == {
        'key': 'archivada_sin_reporte', 'label': 'Archivada sin reporte', 'tone': 'idle',
        'ayuda': 'Nadie la reportó en 30 días; el sistema la archivó.'}
    assert por_id[perdida.id]['post_call']['ayuda'] == 'El closer lo descartó.'
    for fila in por_id.values():
        assert fila['descartada'] is True
        assert (fila['realizada'], fila['asistio']) == (False, False)
    assert 'archivada_sin_reporte' in DESCARTADAS


def test_el_vocabulario_la_trae_no_editable_y_con_ayuda():
    """No se fija a mano: la escribe solo el barrido (no está en `POST_CALL_A_CLOSER_RESULT`)."""
    from app.services.comercial_service import POST_CALL_A_CLOSER_RESULT

    por_key = {e['key']: e for e in POST_CALL}

    assert por_key['archivada_sin_reporte']['editable'] is False
    assert 'archivada_sin_reporte' not in POST_CALL_A_CLOSER_RESULT
    assert {k for k, e in por_key.items() if e.get('ayuda')} == set(AYUDA_ESTADO)
    assert all(len(texto.split()) <= 15 for texto in AYUDA_ESTADO.values())


# --- Los números no cambian -----------------------------------------------------------------------

def _escenario(db, marlon, elias):
    """Un mes con de todo, y dos agendas que el barrido había dejado como 'Lead Perdido'."""
    compro = cliente(db, 'Compro', email='compro@test.local')
    agenda(db, marlon, compro, closer_result='Show up', setter_id=elias.id)
    db.session.add(FinancialSale(mail_cliente='compro@test.local', monto=990.0, tipo_pago='AL - Completo',
                                 metodo_pago='zelle', email_vendedor='marlon@thelearnation.com',
                                 date=datetime(2026, 9, 10), estado='Completada'))
    agenda(db, marlon, cliente(db, 'No vino'), closer_result='No Show', setter_id=elias.id)
    agenda(db, marlon, cliente(db, 'Canceló'), closer_result='Cancelado')
    agenda(db, marlon, cliente(db, 'Sin reporte'), cuando=datetime(2026, 9, 12, 15, 0))
    agenda(db, marlon, cliente(db, 'Descartado'), closer_result='Lead Perdido', closer_processed=True)
    barridas = [
        agenda(db, marlon, cliente(db, f'Barrida {i}'), closer_result='Lead Perdido', closer_processed=True,
               setter_id=elias.id if i == 0 else None, cuando=datetime(2026, 9, 2 + i, 15, 0),
               closer_notes=f'{NOTA_ARCHIVADA}: sin confirmar ni procesar tras 30+ días desde su fecha.')
        for i in range(2)]
    db.session.commit()
    return barridas


def _numeros(elias):
    """Todo lo que muestran Analizar (closers y setters), Variabilidad, Comparativas y Mis datos,
    con el panel Estados reducido a lo que suma: sus grupos y sus cuentas."""
    from app.services.setter_mis_datos import sistema_de

    closers = ca.resumen('closers', DESDE, HASTA)
    setters = ca.resumen('setters', DESDE, HASTA, miembro_id=elias.id)
    estados = closers['actual'].pop('estados')
    grupos = {}
    for e in estados:
        grupos[e['grupo']] = grupos.get(e['grupo'], 0) + e['n']
    return {
        'closers': closers, 'setters': setters, 'grupos': grupos,
        'variabilidad': [ca.variabilidad('closers', DESDE, HASTA), ca.variabilidad('setters', DESDE, HASTA)],
        'comparativas': [ca.comparativas('closers', DESDE, HASTA), ca.comparativas('setters', DESDE, HASTA)],
        'mis_datos': sistema_de(DESDE, HASTA, setter_id=elias.id, setter_nombre='Elias'),
    }


@freeze_time(HOY)
def test_ningun_numero_de_closers_ni_de_setters_cambia_por_el_nombre(db, marlon, elias):
    barridas = _escenario(db, marlon, elias)
    antes = _numeros(elias)

    for a in barridas:
        a.closer_result = ARCHIVADA_SIN_REPORTE
    db.session.commit()
    despues = _numeros(elias)

    assert despues == antes
    # Lo único que cambia es cómo se llaman: el panel muestra los dos estados por separado.
    estados = {e['key']: e for e in ca.bloque_closers(DESDE, HASTA)['estados']}
    assert (estados['lead_perdido']['n'], estados['archivada_sin_reporte']['n']) == (1, 2)
    assert estados['archivada_sin_reporte']['grupo'] == estados['lead_perdido']['grupo'] == 'sin_resultado'
    assert estados['archivada_sin_reporte']['ayuda'] == AYUDA_ESTADO['archivada_sin_reporte']


# --- La ficha -------------------------------------------------------------------------------------

def test_la_ficha_la_trata_como_un_descarte_con_su_propio_nombre():
    archivada = resolver_estado(estado_agenda='archivada_sin_reporte')
    perdida = resolver_estado(estado_agenda='lead_perdido')

    assert (archivada['clave'], archivada['etiqueta']) == ('archivada_sin_reporte', 'Archivada sin reporte')
    assert perdida['clave'] == 'descartado'
    # Abre donde abre un descartado, con las mismas pestañas.
    assert archivada['pestana_por_defecto'] == perdida['pestana_por_defecto'] == 'hist'
    assert archivada['pestanas'] == perdida['pestanas']


def test_el_historial_de_la_ficha_lleva_el_tooltip_en_el_chip(db, marlon):
    from app.services.ficha_lead_secciones import historial

    cli = cliente(db, 'Ficha')
    ahora = datetime(2026, 9, 17, 21, 30)
    agenda(db, marlon, cli, closer_result='Archivada sin reporte', closer_processed=True)
    agenda(db, marlon, cli, cuando=datetime(2026, 9, 11, 15, 0), closer_result='Lead Perdido',
           closer_processed=True)
    agenda(db, marlon, cli, cuando=datetime(2026, 9, 12, 15, 0), closer_result='No Show')

    filas = historial(Appointment.query.filter_by(client_id=cli.id).all(), ahora)['agendas']
    chips = {f['chip']['label']: f['chip'] for f in filas}

    assert chips['Archivada sin reporte']['ayuda'] == AYUDA_ESTADO['archivada_sin_reporte']
    assert chips['Lead perdido']['ayuda'] == AYUDA_ESTADO['lead_perdido']
    assert 'ayuda' not in chips['No show']
    assert {f['post_call'] for f in filas} >= {'archivada_sin_reporte', 'lead_perdido'}


# --- Una venta sobre una archivada ----------------------------------------------------------------

@freeze_time(HOY)
def test_una_venta_registrada_sobre_la_archivada_la_da_por_asistida(db, marlon):
    """Nadie la reportó: si el lead compró en esa llamada, asistió. Un 'Lead Perdido' no se pisa,
    porque ése lo decidió un closer."""
    archivada = agenda(db, marlon, cliente(db, 'Archivada'), closer_result='Archivada sin reporte',
                       closer_processed=True)
    perdida = agenda(db, marlon, cliente(db, 'Perdida'), closer_result='Lead Perdido',
                     closer_processed=True)

    cambio = CloserService.mark_sale_appointment_as_show_up(archivada.client_id, appointment_id=archivada.id)
    nada = CloserService.mark_sale_appointment_as_show_up(perdida.client_id, appointment_id=perdida.id)

    assert cambio['closer_result_antes'] == 'Archivada sin reporte'
    assert archivada.closer_result == 'Show up'
    assert nada is None and perdida.closer_result == 'Lead Perdido'


# --- El espejo del tablero ------------------------------------------------------------------------

def test_el_estado_va_y_vuelve_por_el_espejo_del_tablero_sin_perderse(db, marlon):
    """Cuando alguien toca una archivada, su estado se copia a `FinancialAgenda.estado`; y el sync
    del tablero hacia la cita tiene que leerlo como lo que es, no como un estado desconocido."""
    from app.models import FinancialAgenda
    from app.services.booking_service import BookingService

    cli = cliente(db, 'Archivada', email='archivada.espejo@test.local')
    a = agenda(db, marlon, cli, cuando=datetime(2026, 8, 1, 15, 0), closer_result='Archivada sin reporte',
               closer_processed=True)
    db.session.add(FinancialAgenda(nombre='Setter', lead='Archivada', closer='Marlon', mail=cli.email,
                                   instagram='N/A', whatsapp='N/A', estado='Pendiente',
                                   date=a.start_time, fecha_meet=a.start_time.isoformat()))
    db.session.commit()

    espejo = BookingService.sync_appointment_to_financial_agenda(a)
    db.session.commit()
    BookingService.sync_financial_agenda_to_appointment(espejo)

    assert espejo.estado == 'Archivada sin reporte'
    assert (a.closer_result, a.closer_processed) == ('Archivada sin reporte', True)


def test_el_prefill_del_reporte_diario_la_cuenta_donde_contaba_lead_perdido():
    from app.api.public.closer import ATENDIDAS_EN_PREFILL

    assert {'lead perdido', 'archivada sin reporte'} <= set(ATENDIDAS_EN_PREFILL)
