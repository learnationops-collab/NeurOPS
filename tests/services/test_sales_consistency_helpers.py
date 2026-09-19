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

def test_cuenta_las_tres_senales_cuando_coinciden():
    c = cliente(email='ana@x.com', instagram='@Ana_G', phone='+591 71234567')
    v = venta(mail='ANA@x.com', instagram='ana_g', telefono='71234567')

    assert S._signal_match_count(c, v) == 3


def test_sin_ninguna_senal_en_comun_cuenta_cero():
    c = cliente(email='ana@x.com', instagram='ana_g', phone='71234567')
    v = venta(mail='otra@x.com', instagram='otra_g', telefono='99999999')

    assert S._signal_match_count(c, v) == 0


def test_el_email_compara_sin_importar_mayusculas_ni_espacios():
    assert S._signal_match_count(cliente(email='ana@x.com'), venta(mail='  ANA@X.com ')) == 1


def test_un_email_sin_arroba_no_cuenta():
    assert S._signal_match_count(cliente(email='sin-arroba'), venta(mail='sin-arroba')) == 0


def test_el_instagram_compara_sin_importar_arroba_ni_mayusculas():
    assert S._signal_match_count(cliente(instagram='@Ana_G'), venta(instagram=' ana_g ')) == 1


@pytest.mark.parametrize('placeholder', ['n/a', 'N/A', ''])
def test_un_instagram_placeholder_del_cliente_no_cuenta(placeholder):
    assert S._signal_match_count(cliente(instagram=placeholder), venta(instagram=placeholder)) == 0


def test_el_telefono_compara_los_ultimos_8_digitos():
    assert S._signal_match_count(cliente(phone='+58 71234567'), venta(telefono='0058-71234567')) == 1


def test_un_telefono_de_menos_de_8_caracteres_no_cuenta():
    assert S._signal_match_count(cliente(phone='1234567'), venta(telefono='1234567')) == 0


def test_si_la_venta_no_tiene_datos_no_cuenta_nada():
    c = cliente(email='ana@x.com', instagram='ana_g', phone='71234567')

    assert S._signal_match_count(c, venta()) == 0


def test_dos_senales_son_dos():
    c = cliente(email='ana@x.com', instagram='ana_g', phone='71234567')
    v = venta(mail='ana@x.com', instagram='ana_g', telefono='99999999')

    assert S._signal_match_count(c, v) == 2
