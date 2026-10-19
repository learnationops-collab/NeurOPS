"""Herramientas de Learnito: texto corto sobre los datos del closer, con topes de filas."""
from types import SimpleNamespace

import pytest

from app.services import copiloto_herramientas as h

CLOSER = SimpleNamespace(id=7, timezone='America/Argentina/Buenos_Aires')


def _cliente(nombre, deuda, cuota=None, programa='AL'):
    return {'lead_name': nombre, 'deuda': deuda, 'proxima_cuota': cuota, 'programa_code': programa}


def _cuota(monto, vence, vencida=False, sin_plan=False):
    return {'monto': monto, 'fecha_vencimiento': vence, 'vencida': vencida, 'sin_plan': sin_plan}


CARTERA = [
    _cliente('Nadia Benítez', 1200, _cuota(400, '2026-11-15')),
    _cliente('Martín Pérez', 800, _cuota(800, None, sin_plan=True)),
    _cliente('Sofía Ruiz', 350, _cuota(350, '2026-10-01', vencida=True)),
    _cliente('Lucas Gómez', 0),
]


@pytest.fixture()
def cartera(monkeypatch):
    monkeypatch.setattr(h, '_cartera', lambda user: CARTERA)


def test_deuda_de_busca_sin_tildes_ni_mayusculas(cartera):
    assert h.deuda_de(CLOSER, 'nadia benitez') == 'Nadia Benítez (AL): debe US$1.200; próxima cuota US$400 el 15/11.'


def test_deuda_de_marca_vencida_sin_plan_y_al_dia(cartera):
    assert h.deuda_de(CLOSER, 'sofía').endswith('el 01/10 (VENCIDA).')
    assert h.deuda_de(CLOSER, 'martin') == 'Martín Pérez (AL): debe US$800, sin plan de cuotas.'
    assert h.deuda_de(CLOSER, 'lucas') == 'Lucas Gómez (AL): al día.'
    assert 'No hay ningún cliente' in h.deuda_de(CLOSER, 'zzz')


def test_los_que_mas_deben_ordena_y_respeta_la_cantidad(cartera):
    texto = h.los_que_mas_deben(CLOSER, 2)
    lineas = texto.split('\n')
    assert lineas[0] == '3 clientes te deben US$2.350 en total. Los que más:'
    assert [line.split(' (')[0] for line in lineas[1:]] == ['Nadia Benítez', 'Martín Pérez']


def test_mis_agendas_en_hora_del_closer_y_con_tope(monkeypatch):
    items = [{'start_time': f'2026-10-19T{13 + i % 10:02d}:00:00', 'lead_name': f'Alumno {i}',
              'estado_label': 'Confirmada', 'venta': i == 0} for i in range(17)]
    from app.services.closer_agendas_service import CloserAgendasService
    monkeypatch.setattr(CloserAgendasService, 'get_ledger',
                        staticmethod(lambda *a, **k: {'items': items, 'rango': {'start': '2026-10-19'}}))

    lineas = h.mis_agendas(CLOSER, '2026-10-19').split('\n')

    assert lineas[0] == '17 agendas el 19/10 (hora del closer):'
    assert lineas[1] == '10:00 Alumno 0 · Confirmada · con venta'
    assert lineas[-1] == '… y 2 más.'


def test_errores_vuelven_como_texto_de_error(cartera):
    assert h.ejecutar('mis_agendas', {'fecha': 'mañana'}, CLOSER) == ('La fecha tiene que ser AAAA-MM-DD.', True)
    assert h.ejecutar('deuda_de', {'nombre': 'a'}, CLOSER)[1] is True
    assert h.ejecutar('deuda_de', {'otro': 'x'}, CLOSER)[1] is True
    assert h.ejecutar('no_existe', {}, CLOSER) == ('No existe la herramienta no_existe.', True)
