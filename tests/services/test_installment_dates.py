"""_add_months: vencimiento de cada cuota = el mismo dia N meses despues, recortado a fin de mes.

Existe una copia en installment_service (cronograma de cuotas) y otra en academy_access_service
(vencimiento del acceso a la Academia). Los mismos casos corren contra las dos, y contra
`relativedelta` de dateutil como referencia independiente, para que no se separen.
"""
from datetime import date, timedelta

import pytest
from dateutil.relativedelta import relativedelta

from app.services.academy_access_service import _add_months as add_months_academia
from app.services.installment_service import _add_months as add_months_cuotas

IMPLEMENTACIONES = [
    pytest.param(add_months_cuotas, id='installment_service'),
    pytest.param(add_months_academia, id='academy_access_service'),
]


@pytest.mark.parametrize('add_months', IMPLEMENTACIONES)
@pytest.mark.parametrize('origen,meses,esperado', [
    (date(2026, 1, 15), 1, date(2026, 2, 15)),
    (date(2026, 1, 15), 0, date(2026, 1, 15)),
    (date(2026, 12, 15), 1, date(2027, 1, 15)),  # cruza de anio
    (date(2026, 9, 19), 12, date(2027, 9, 19)),
    (date(2026, 1, 31), 25, date(2028, 2, 29)),  # varios anios y ademas cae en bisiesto
    # recorte a fin de mes
    (date(2027, 1, 31), 1, date(2027, 2, 28)),
    (date(2028, 1, 31), 1, date(2028, 2, 29)),  # 2028 es bisiesto
    (date(2028, 2, 29), 12, date(2029, 2, 28)),
    (date(2026, 3, 31), 1, date(2026, 4, 30)),
    (date(2026, 5, 31), 1, date(2026, 6, 30)),
    (date(2026, 8, 31), 1, date(2026, 9, 30)),
    (date(2026, 10, 31), 1, date(2026, 11, 30)),
    # reglas del calendario gregoriano para los siglos
    (date(2100, 1, 31), 1, date(2100, 2, 28)),  # 2100 NO es bisiesto
    (date(2000, 1, 31), 1, date(2000, 2, 29)),  # 2000 SI lo es
])
def test_add_months(add_months, origen, meses, esperado):
    assert add_months(origen, meses) == esperado


@pytest.mark.parametrize('add_months', IMPLEMENTACIONES)
def test_devuelve_un_date_y_no_un_datetime(add_months):
    assert type(add_months(date(2026, 9, 19), 1)) is date


@pytest.mark.parametrize('add_months', IMPLEMENTACIONES)
def test_las_cuotas_de_un_dia_31_no_derivan_hacia_el_28(add_months):
    # Cada vencimiento se calcula desde la fecha base, no desde el anterior ya recortado.
    base = date(2027, 1, 31)

    vencimientos = [add_months(base, n) for n in range(1, 5)]

    assert vencimientos == [date(2027, 2, 28), date(2027, 3, 31), date(2027, 4, 30), date(2027, 5, 31)]


@pytest.mark.parametrize('add_months', IMPLEMENTACIONES)
def test_coincide_con_relativedelta_todos_los_dias_de_tres_anios(add_months):
    fallas = []
    dia = date(2027, 1, 1)
    while dia < date(2030, 1, 1):
        for meses in (0, 1, 2, 3, 6, 11, 12, 13, 24, 25, 36):
            esperado = dia + relativedelta(months=meses)
            if add_months(dia, meses) != esperado:
                fallas.append((dia, meses, add_months(dia, meses), esperado))
        dia += timedelta(days=1)

    assert fallas == []
