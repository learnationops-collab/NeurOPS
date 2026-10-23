"""sales_consistency_service: helpers que deciden si una venta pertenece a un cliente.

`get_client_payment_state` trae ventas candidatas con un filtro SQL amplio (basta UNA senal) y luego
decide en Python con un criterio mas estricto: al menos 2 de 3 senales (email/instagram/telefono), o
una sola corroborada por el nombre. Caso real que motivo la regla (2/sep/2026): un email compartido
entre tres personas sin ningun parecido de nombre hacia creer que un cliente ya habia pagado todo.
"""
from types import SimpleNamespace

import pytest

from app.services.sales_consistency_service import SalesConsistencyService as S


def cliente(email=None, instagram=None, phone=None):
    return SimpleNamespace(email=email, instagram=instagram, phone=phone)


def venta(mail=None, instagram=None, telefono=None):
    return SimpleNamespace(mail_cliente=mail, instagram=instagram, telefono=telefono)


# --- _normalize_name --------------------------------------------------------------------------

@pytest.mark.parametrize('nombre,esperado', [
    (None, ''), ('', ''),
    ('  José   PÉREZ ', 'jose perez'),
    ('Kervin Calderón', 'kervin calderon'),
])
def test_normalize_name(nombre, esperado):
    assert S._normalize_name(nombre) == esperado


# --- _names_corroborate -----------------------------------------------------------------------

@pytest.mark.parametrize('a,b', [
    ('Juan Perez', 'JUAN PEREZ'),
    ('José Pérez', 'Jose Perez'),
    ('Jonathan Aparicio', 'Jonatan Aparicio'),  # comparten el apellido
    ('María José', 'Jose Maria'),  # mismo par de nombres en otro orden
    ('Kervin', 'Kervyn'),  # sin token en comun pero casi iguales (ratio 0.83)
])
def test_nombres_parecidos_se_corroboran(a, b):
    assert S._names_corroborate(a, b) is True


@pytest.mark.parametrize('a,b', [
    ('Kervin Calderón', 'Emilia Collantes'),  # el caso real: tres personas, un email compartido
    ('Kervin Calderón', 'Juan Camilo Sanchez Ramirez'),
    ('Emilia Collantes', 'Juan Camilo Sanchez Ramirez'),
    ('Ana', 'Beatriz'),
])
def test_nombres_sin_parecido_no_se_corroboran(a, b):
    assert S._names_corroborate(a, b) is False


@pytest.mark.parametrize('a,b', [('', 'Juan'), ('Juan', ''), (None, None), (None, 'Juan')])
def test_sin_un_nombre_no_hay_corroboracion(a, b):
    assert S._names_corroborate(a, b) is False


# --- _signal_match_count ----------------------------------------------------------------------



















