"""client_dedup_service: que senales cuentan para decidir que dos clientes son la misma persona.

La fusion de duplicados es la operacion de datos mas delicada del sistema (repunta citas, ventas y
pagos y BORRA filas). Estas funciones deciden que se considera una senal valida; los casos de abajo
incluyen los que ya costaron un bug real (31/ago/2026: alguien tipeo el email de OTRA persona y la
fusion mezclaba el historial de dos leads distintos).
"""
import pytest

from app.services import client_dedup_service as cds

# --- _normalize_name --------------------------------------------------------------------------

@pytest.mark.parametrize('nombre,esperado', [
    (None, ''), ('', ''), ('   ', ''),
    ('  Juan   Perez ', 'juan perez'),
    ('José Pérez', 'jose perez'),
    ('ÑANDÚ', 'nandu'),
])
def test_normalize_name(nombre, esperado):
    assert cds._normalize_name(nombre) == esperado


# --- _names_compatible ------------------------------------------------------------------------

@pytest.mark.parametrize('a,b', [
    ('Juan Perez', 'juan perez'),
    ('José Pérez', 'Jose Perez'),
    ('  Ana   Gomez ', 'ana gomez'),
])
def test_dos_nombres_iguales_tras_normalizar_son_compatibles(a, b):
    assert cds._names_compatible(a, b) is True


@pytest.mark.parametrize('generico', ['Cliente Nuevo', 'cliente nuevo', 'Sin Nombre', 'Desconocido', '', None])
def test_un_nombre_generico_es_compatible_con_cualquiera(generico):
    assert cds._names_compatible(generico, 'Juan Perez') is True
    assert cds._names_compatible('Juan Perez', generico) is True


@pytest.mark.parametrize('a,b', [
    ('Juan Perez', 'Maria Gomez'),
    ('Isai Jimenz', 'Facundo Macome'),  # el caso real: escribio el email de otra persona
    ('Juan', 'Juan Perez'),  # la coincidencia es exacta, no por parecido parcial
])
def test_nombres_distintos_no_son_compatibles(a, b):
    assert cds._names_compatible(a, b) is False


# --- _normalize_email -------------------------------------------------------------------------

@pytest.mark.parametrize('email,esperado', [
    ('  Foo@X.com ', 'foo@x.com'),
    ('FOO@X.COM', 'foo@x.com'),
    (None, None), ('', None), ('sin arroba', None),
])
def test_normalize_email(email, esperado):
    assert cds._normalize_email(email) == esperado


# --- _normalize_instagram ---------------------------------------------------------------------

@pytest.mark.parametrize('instagram,esperado', [
    ('@Foo_Bar', 'foo_bar'), ('foo', 'foo'), ('  @FOO  ', 'foo'), ('abc', 'abc'),
])
def test_normalize_instagram_usuarios_validos(instagram, esperado):
    assert cds._normalize_instagram(instagram) == esperado


@pytest.mark.parametrize('basura', [
    None, '', 'n/a', 'N/A', ' N/A ', 'none', 'NONE', '.', '-', 'no hay', 'no tiene', 'ninguno',
    'sin instagram', 'no aplica',
    'ab', '@ab',  # demasiado corto para ser un usuario real
])
def test_normalize_instagram_descarta_placeholders_y_usuarios_demasiado_cortos(basura):
    assert cds._normalize_instagram(basura) is None


# --- _normalize_phone -------------------------------------------------------------------------

@pytest.mark.parametrize('telefono,esperado', [
    ('12345678', '12345678'),
    ('+591 7123-4567', '71234567'),
    ('+58 412 555 1234', '25551234'),
])
def test_normalize_phone_se_queda_con_los_ultimos_8_digitos(telefono, esperado):
    assert cds._normalize_phone(telefono) == esperado


def test_el_mismo_telefono_escrito_de_dos_formas_da_la_misma_clave():
    assert cds._normalize_phone('+58 412 555 1234') == cds._normalize_phone('0412-5551234')


@pytest.mark.parametrize('basura', [None, '', 'n/a', 'N/A', 'sin instagram', '1234567', 'abc', '12-34'])
def test_normalize_phone_descarta_lo_que_no_es_un_telefono_completo(basura):
    assert cds._normalize_phone(basura) is None
