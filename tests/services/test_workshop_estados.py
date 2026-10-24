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
