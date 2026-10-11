"""El tablero de setters: el reporte diario sumado, sus vistas por canal y lo que pasó después.

Lo que se fija acá es lo que el dueño marcó en el video del 10/10/2026: los números de la
conversación salen del reporte (no de ManyChat, que daba 98% de respuesta y 100% de cualificación),
los reportes v1 suman sin inventar canales, cada pestaña de canal filtra solo lo que el reporte separa
por canal, el período es el pedido y lo que pasa después de la agenda sale del sistema con sus
porcentajes.
"""
from datetime import date, datetime

import pytest
from freezegun import freeze_time

from app.models import FinancialSale
from app.services import comercial_analitica as ca
from app.services import setter_analitica as sa
from tests.services.reportes_setter import SEPT, generada, v1, v2

HOY = '2026-10-10 15:00:00'


@pytest.fixture()
def elias(make_user):
    return make_user(role='setter', username='Elias')


@pytest.fixture()
def paula(make_user):
    return make_user(role='setter', username='Paula')


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


def bloque(setter=None):
    return ca.bloque_setters(*SEPT, setter_id=setter.id if setter else None)


# --- El reporte sumado ----------------------------------------------------------------------------

@freeze_time(HOY)
def test_suma_v1_y_v2_en_general_y_el_v1_va_aparte_en_lo_por_canal(db, elias):
    v2(db, elias, date(2026, 9, 1), ads=(10, 1, 0, 3, 5, 2), inb=(6, 0, 1, 1, 3, 1), embudo=(10, 7, 5))
    v1(db, elias, date(2026, 9, 2), entrantes=20, no_lead=4, respondieron=16, dolor=6, oferta=3,
       link=2, agenda=2)

    b = bloque(elias)

    assert (b['entrantes'], b['agendas']) == (36, 5)
    # Cualificados: v2 = (10-1-0) + (6-0-1) = 14; v1 = respondieron - no leads = 12.
    assert b['cualificados'] == 26
    assert (b['canales']['anuncios']['entrantes'], b['canales']['inbound']['entrantes']) == (10, 6)
    assert (b['sin_canal']['entrantes'], b['sin_canal']['agendas']) == (20, 2)
    assert (b['reportes'], b['reportes_v2']) == (2, 1)
    agendas = next(e for e in b['funnel'] if e['key'] == 'agendas')
    assert {p['key']: p['n'] for p in agendas['partes']} == {'anuncios': 2, 'inbound': 1, 'sin_canal': 2}


@freeze_time(HOY)
def test_las_tasas_de_general_salen_del_reporte(db, elias):
    v2(db, elias, date(2026, 9, 1), ads=(10, 1, 0, 3, 5, 2), inb=(6, 0, 1, 1, 3, 1),
       bnv=(12, 5, 4), embudo=(10, 7, 5), fu=(9, 5, 3, 3))

    b = bloque(elias)

    assert b['cualificacion'] == round(14 / 16 * 100, 1)
    assert (b['no_lead_pct'], b['inabribles_pct']) == (round(1 / 16 * 100, 1), round(1 / 16 * 100, 1))
    assert b['apertura'] == round(12 / 16 * 100, 1)
    # La conversión final: agendas reportadas sobre entrantes reportados, las dos del reporte.
    assert b['conversion'] == round(3 / 16 * 100, 1)
    # La del formulario, de cualificado a agenda, y la del último paso del embudo.
    assert b['conv_cualificados'] == round(3 / 14 * 100, 1)
    assert (b['link'], b['conv_link']) == (5, 60.0)
    assert b['bienvenidas']['respuesta'] == b['bienvenidas_respuesta'] == round(5 / 12 * 100, 1)
    assert b['bienvenidas']['apertura'] == 80.0
    assert b['followups_total'] == 20


@freeze_time(HOY)
def test_cada_canal_filtra_solo_lo_que_el_reporte_separa_por_canal(db, elias):
    v2(db, elias, date(2026, 9, 1), ads=(10, 1, 0, 3, 5, 2), inb=(6, 0, 1, 1, 3, 1), embudo=(10, 7, 5))
    v1(db, elias, date(2026, 9, 2), entrantes=20, no_lead=4, respondieron=16, agenda=2)

    canales = bloque(elias)['canales']

    ads, inb = canales['anuncios'], canales['inbound']
    # Lo del v1 no entra en ningún canal: no se reparte inventando.
    assert (ads['entrantes'], ads['cualificados'], ads['aperturas'], ads['agendas']) == (10, 9, 8, 2)
    assert (inb['entrantes'], inb['cualificados'], inb['aperturas'], inb['agendas']) == (6, 5, 4, 1)
    assert (ads['cualificacion'], ads['apertura'], ads['conversion']) == (90.0, 80.0, 20.0)
    assert ads['conv_cualificados'] == round(2 / 9 * 100, 1)
    # El link es un total del reporte, sin canal: en un canal no hay conversión desde el link.
    assert (ads['link'], ads['conv_link']) == (None, None)


@freeze_time(HOY)
def test_sin_reportes_las_tasas_son_none_y_no_cero(db, elias):
    b = bloque(elias)

    assert b['entrantes'] == 0
    assert all(b[k] is None for k in ('cualificacion', 'apertura', 'conversion', 'conv_cualificados',
                                      'bienvenidas_respuesta'))
    assert b['canales']['anuncios']['cualificacion'] is None


@freeze_time(HOY)
def test_solo_cuentan_los_reportes_y_las_agendas_del_periodo(db, elias, closer):
    v2(db, elias, date(2026, 9, 30), ads=(5, 0, 0, 0, 0, 1))
    v2(db, elias, date(2026, 10, 1), ads=(50, 0, 0, 0, 0, 9))
    generada(db, elias, closer, creada=datetime(2026, 9, 20, 15))
    # Creada en octubre para una reunión de septiembre: no es trabajo de septiembre.
    generada(db, elias, closer, creada=datetime(2026, 10, 2, 15), reunion=datetime(2026, 9, 29, 15))

    b = bloque(elias)

    assert (b['entrantes'], b['generadas']) == (5, 1)


# --- Los follow-ups y su respuesta ----------------------------------------------------------------

@freeze_time(HOY)
def test_sin_respondidos_en_el_reporte_la_respuesta_de_los_followups_es_none(db, elias):
    v2(db, elias, date(2026, 9, 1), fu=(9, 5, 3, 3))

    fu = bloque(elias)['followups']

    assert [(e['key'], e['hechos']) for e in fu['etapas']] == [('entrantes', 9), ('dolor', 5),
                                                               ('oferta', 3), ('link', 3)]
    assert all(e['respuesta'] is None for e in fu['etapas'])
    assert (fu['total'], fu['respondidos'], fu['respuesta']) == (20, None, None)


@freeze_time(HOY)
def test_con_respondidos_en_el_reporte_cada_etapa_trae_su_respuesta(db, elias, monkeypatch):
    v2(db, elias, date(2026, 9, 1), fu=(10, 5, 0, 4))
    # Lo que va a agregar `setter_reporte_v2.sumar` (contrato del 10/10/2026).
    sumar = sa.reporte_v2.sumar
    monkeypatch.setattr(sa.reporte_v2, 'sumar', lambda lecturas: {
        **sumar(lecturas), 'followups_respondidos': {'entrantes': 4, 'dolor': 5, 'oferta': 0, 'link': 1}})

    fu = bloque(elias)['followups']

    assert [e['respuesta'] for e in fu['etapas']] == [40.0, 100.0, None, 25.0]
    assert (fu['total'], fu['respondidos'], fu['respuesta']) == (19, 10, round(10 / 19 * 100, 1))


# --- Lo que pasó después de la agenda (el sistema) ------------------------------------------------

@freeze_time(HOY)
def test_despues_de_la_agenda_cuenta_cada_resultado_con_su_porcentaje(db, elias, closer):
    for resultado in ('Cancelado', 'Reagendado', 'No Show', 'Show up', 'Show up', 'Pendiente'):
        generada(db, elias, closer, closer_result=resultado)

    b = bloque(elias)

    assert b['generadas'] == 6
    assert (b['canceladas'], b['canceladas_pct']) == (1, round(1 / 6 * 100, 1))
    assert (b['reagendadas'], b['reagendadas_pct']) == (1, round(1 / 6 * 100, 1))
    # El show up y el no show se miden sobre las que tienen resultado, como en todo el tablero.
    assert (b['realizadas'], b['no_show'], b['no_show_pct']) == (3, 1, round(1 / 3 * 100, 1))
    assert (b['asistieron'], b['show_up']) == (2, round(2 / 3 * 100, 1))


@freeze_time(HOY)
def test_las_ventas_originadas_salen_de_las_agendas_que_asistieron(db, elias, closer):
    compro = generada(db, elias, closer, closer_result='Show up')
    generada(db, elias, closer, closer_result='Show up')
    db.session.add(FinancialSale(mail_cliente=compro.client.email, monto=990.0, tipo_pago='AL - Completo',
                                 metodo_pago='zelle', email_vendedor='marlon@thelearnation.com',
                                 date=datetime(2026, 9, 12), estado='Completada'))
    db.session.commit()

    b = bloque(elias)

    assert (b['ventas_originadas'], b['cierre']) == (1, 50.0)


@freeze_time(HOY)
def test_el_embudo_va_de_los_entrantes_a_las_ventas_con_cada_conversion(db, elias, closer):
    v2(db, elias, date(2026, 9, 10), ads=(20, 4, 0, 0, 0, 4), embudo=(10, 8, 5))
    generada(db, elias, closer, creada=datetime(2026, 9, 10, 15), closer_result='Show up')
    generada(db, elias, closer, creada=datetime(2026, 9, 11, 15), closer_result='No Show')

    etapas = bloque(elias)['funnel']

    assert [e['key'] for e in etapas] == ['entrantes', 'cualificados', 'dolor', 'oferta', 'link',
                                          'agendas', 'generadas', 'asistieron', 'ventas']
    assert [e['n'] for e in etapas] == [20, 16, 10, 8, 5, 4, 2, 1, 0]
    assert [e['fuente'] for e in etapas] == ['reporte'] * 6 + ['sistema'] * 3
    assert etapas[0]['tasa'] is None
    assert (etapas[1]['tasa'], etapas[5]['tasa'], etapas[7]['tasa']) == (80.0, 80.0, 50.0)
    # El paso del reporte al sistema no es una conversión: se marca como cruce.
    assert [e.get('cruce', False) for e in etapas].index(True) == 6


# --- Constancia y wins ----------------------------------------------------------------------------

@freeze_time(HOY)
def test_cuenta_los_dias_reportados_contra_los_habiles(db, elias):
    v2(db, elias, date(2026, 9, 1))           # martes
    v2(db, elias, date(2026, 9, 5))           # sábado
    v2(db, elias, date(2026, 9, 7), no_laborable=True)

    dias = bloque(elias)['dias']

    assert (dias['habiles'], dias['periodo']) == (22, 30)
    assert (dias['reportados'], dias['en_fin_de_semana'], dias['no_laborables']) == (2, 1, 1)
    estados = {d['fecha']: d['estado'] for d in dias['detalle']}
    assert (estados['2026-09-01'], estados['2026-09-02'], estados['2026-09-06'],
            estados['2026-09-07']) == ('reportado', 'falta', 'finde', 'no_laborable')


@freeze_time(HOY)
def test_los_wins_son_los_ultimos_con_texto_tambien_los_del_v1(db, elias):
    v1(db, elias, date(2026, 9, 1), win='Agendé a una fría')
    v1(db, elias, date(2026, 9, 2), win='-')
    v2(db, elias, date(2026, 9, 3), win='Volvió un lead de agosto')
    v2(db, elias, date(2026, 9, 4), win='ninguno')

    assert bloque(elias)['wins'] == [{'fecha': '2026-09-03', 'texto': 'Volvió un lead de agosto'},
                                     {'fecha': '2026-09-01', 'texto': 'Agendé a una fría'}]


# --- El alcance -----------------------------------------------------------------------------------

@freeze_time(HOY)
def test_un_setter_sin_nada_ve_ceros_y_no_lo_del_equipo(db, elias, paula, closer):
    v2(db, paula, date(2026, 9, 3), ads=(40, 0, 0, 0, 0, 5), win='De Paula')
    generada(db, paula, closer, creada=datetime(2026, 9, 3, 15))

    b = bloque(elias)

    assert (b['entrantes'], b['generadas'], b['wins'], b['dias']['reportados']) == (0, 0, [], 0)


@freeze_time(HOY)
def test_el_equipo_suma_los_reportes_y_las_agendas_de_todos_los_setters(db, elias, paula, closer):
    v2(db, elias, date(2026, 9, 3), ads=(30, 0, 0, 0, 0, 3))
    v2(db, paula, date(2026, 9, 3), inb=(10, 0, 0, 0, 0, 2))
    generada(db, elias, closer)
    generada(db, paula, closer)

    b = bloque()

    assert (b['entrantes'], b['agendas'], b['generadas']) == (40, 5, 2)
    assert (b['canales']['anuncios']['entrantes'], b['canales']['inbound']['entrantes']) == (30, 10)


def test_lecturas_por_setter_con_una_lista_vacia_no_trae_a_todos(db, elias):
    v2(db, elias, date(2026, 9, 3), ads=(4, 0, 0, 0, 0, 0))

    assert sa.lecturas_por_setter(*SEPT, setter_ids=[]) == {}
    assert list(sa.lecturas_por_setter(*SEPT)) == [elias.id]


def test_los_reportes_de_alguien_que_no_es_setter_no_cuentan(db, elias, closer):
    v2(db, closer, date(2026, 9, 3), ads=(99, 0, 0, 0, 0, 9))

    assert sa.lecturas_por_setter(*SEPT) == {}
