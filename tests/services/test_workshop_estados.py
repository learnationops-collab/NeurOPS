"""A que columna del desglose del taller va cada estado de una cita (`_bucket_estado`).

El desglose manda al show up de citas y al close rate del embudo. Los estados de la confirmacion
previa a la llamada ('por_confirmar', 'confirmado', 'conversando') caian en "Otros" y los de una cita
a la que la persona SI asistio ('Cerrada', 'Follow Up', '2TH Call') tambien, asi que el close rate
podia dar mas de 100% y el show up salia mas bajo de lo real (23/10/2026).
"""
import pytest

from app.services.workshop_metrics_service import _bucket_estado


@pytest.mark.parametrize('estado', ['Show Up', 'Show up', 'Asistió', 'Cerrada', 'Follow Up', '2TH Call', 'Completado'])
def test_las_citas_a_las_que_asistio_son_show_up(estado):
    assert _bucket_estado(estado) == 'Show Up'


@pytest.mark.parametrize('estado', ['Pendiente', 'por_confirmar', 'Confirmado', 'conversando', 'Contactado', '', None])
def test_las_que_todavia_no_ocurrieron_son_pendientes(estado):
    assert _bucket_estado(estado) == 'Pendiente'


@pytest.mark.parametrize('estado,columna', [
    ('No Show', 'No Show'), ('Inasistencia', 'No Show'),
    ('Cancelada', 'Cancelada'), ('Cancelado', 'Cancelada'),
    ('Reagendada', 'Reagendada'), ('Reagendado', 'Reagendada'),
])
def test_no_show_cancelada_y_reagendada(estado, columna):
    assert _bucket_estado(estado) == columna


@pytest.mark.parametrize('estado', ['Lead Perdido', 'No Lead', 'Archivada sin reporte'])
def test_los_descartes_siguen_en_otros(estado):
    assert _bucket_estado(estado) == 'Otros'


# --- Show up de citas: asistieron / citas con resultado ------------------------------------------

from datetime import datetime, timedelta  # noqa: E402
from types import SimpleNamespace  # noqa: E402

from app.services.workshop_estados import desglose_de_personas  # noqa: E402

AHORA = datetime(2026, 10, 24, 12, 0)


def cita(estado, dias=-3):
    return SimpleNamespace(estado=estado, date=AHORA + timedelta(days=dias))


def desglosar(*personas):
    # Cada persona es una lista de citas; el estado real es el de la hoja
    return desglose_de_personas([list(p) for p in personas], lambda a: a.estado, AHORA)


def test_el_show_up_se_divide_por_las_citas_con_resultado():
    r = desglosar([cita('Show Up')], [cita('Show Up')], [cita('No Show')],
                  [cita('Pendiente')], [cita('Lead Perdido')], [cita('Cancelada')])

    assert r['show_up'] == 2
    assert r['reportadas'] == 3
    assert r['desglose']['Pendiente'] == 1


def test_sin_reportar_es_la_llamada_vencida_sin_resultado_o_archivada():
    r = desglosar([cita('Pendiente', dias=-2)], [cita('Archivada sin reporte')],
                  [cita('Pendiente', dias=+2)], [cita('Confirmado', dias=-1)])

    assert r['sin_reportar'] == 3  # la futura todavia no ocurrio


def test_quien_asistio_a_una_cita_cuenta_aunque_la_ultima_este_pendiente():
    r = desglosar([cita('Show Up', dias=-5), cita('Pendiente', dias=-1)])

    assert (r['show_up'], r['reportadas'], r['sin_reportar']) == (1, 1, 0)
