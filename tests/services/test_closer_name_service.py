"""closer_name_service (parte pura): nombre canonico del closer de una venta.

`FinancialSale.email_vendedor` es texto libre y la misma persona aparece de varias formas:
'jeancarlo@thelearnation.com', 'jeancarlo', 'Jean Carlo', 'jeancarlo@gmail.com'. Antes cada variante
sin listar caia en `.title()` y el MISMO closer se partia en dos opciones del filtro, perdiendo
ventas en silencio. Aca la resolucion se prueba con un indice de usuarios simulado; la lectura real
de usuarios y alias desde la base se prueba con base de datos en la etapa de servicios.
"""
import pytest

from app.services import closer_name_service as cns


@pytest.fixture()
def con_indice(monkeypatch):
    """con_indice({clave: nombre}) reemplaza el indice de usuarios/alias que sale de la base."""
    def _fijar(indice):
        monkeypatch.setattr(cns, '_indice', lambda: indice)

    return _fijar


# --- _claves_de -------------------------------------------------------------------------------

def test_claves_de_un_correo_incluye_la_parte_local():
    assert cns._claves_de('jeancarlo@thelearnation.com') == {
        'jeancarlo@thelearnation com', 'jeancarlo@thelearnationcom', 'jeancarlo',
    }


def test_claves_de_un_nombre_con_espacios_incluye_la_version_sin_espacios():
    assert cns._claves_de('Jean Carlo') == {'jean carlo', 'jeancarlo'}


@pytest.mark.parametrize('vacio', [None, '', '   '])
def test_claves_de_un_vacio_no_tiene_claves(vacio):
    assert cns._claves_de(vacio) == set()


def test_todas_las_formas_de_escribir_al_mismo_closer_comparten_una_clave():
    variantes = ['jeancarlo@thelearnation.com', 'jeancarlo@gmail.com', 'jeancarlo', 'Jean Carlo', 'JEANCARLO']

    comunes = set.intersection(*(cns._claves_de(v) for v in variantes))

    assert comunes == {'jeancarlo'}


# --- Diccionario historico --------------------------------------------------------------------

@pytest.mark.parametrize('clave,nombre', [
    ('jeancarlo', 'Jean Carlo'), ('jean carlo', 'Jean Carlo'),
    ('marlon', 'Marlon'), ('marlongarcia27948', 'Marlon'),
    ('inaki', 'Iñaki'), ('iñaki'.replace('ñ', 'n'), 'Iñaki'),
    ('belen', 'Belén'), ('mircari', 'Mercari'), ('mercari', 'Mercari'),
])
def test_el_indice_historico_reconoce_a_la_gente_sin_usuario(clave, nombre):
    assert cns._indice_historico()[clave] == nombre


def test_ninguna_clave_del_historico_apunta_a_dos_closers_distintos():
    duenos = {}
    for nombre, valores in cns.MAPEO_HISTORICO.items():
        for texto in [nombre, *valores]:
            for clave in cns._claves_de(texto):
                duenos.setdefault(clave, set()).add(nombre)

    ambiguas = {clave: nombres for clave, nombres in duenos.items() if len(nombres) > 1}

    assert ambiguas == {}


# --- resolver_nombre_closer -------------------------------------------------------------------

@pytest.mark.parametrize('vacio', [None, '', '   ', '\n'])
def test_sin_dato_es_sin_closer(con_indice, vacio):
    con_indice({})

    assert cns.resolver_nombre_closer(vacio) == cns.SIN_CLOSER == 'Sin Closer'


@pytest.mark.parametrize('escrito', [
    'jeancarlo@thelearnation.com', 'jeancarlo@gmail.com', 'jeancarlo', 'Jean Carlo', 'JEANCARLO', '  jeancarlo  ',
])
def test_todas_las_variantes_de_un_closer_se_unifican(con_indice, escrito):
    con_indice({'jeancarlo': 'Jean Carlo'})

    assert cns.resolver_nombre_closer(escrito) == 'Jean Carlo'


def test_un_usuario_del_sistema_manda_sobre_el_diccionario_historico(con_indice):
    con_indice({'rafael': 'Rafa (usuario actual)'})

    assert cns.resolver_nombre_closer('rafael') == 'Rafa (usuario actual)'


def test_sin_usuario_se_usa_el_diccionario_historico_por_coincidencia_exacta(con_indice):
    con_indice({})

    assert cns.resolver_nombre_closer('jeancarlo@thelearnation.com') == 'Jean Carlo'


def test_un_correo_con_nombre_y_apellido_cae_al_historico_por_substring(con_indice):
    # 'rafael.perez@...' no coincide exacto con 'rafael' pero es la misma persona.
    con_indice({})

    assert cns.resolver_nombre_closer('rafael.perez@empresa.com') == 'Rafael'


@pytest.mark.parametrize('escrito,esperado', [
    ('pedro.gomez@x.com', 'Pedro Gomez'),
    ('pedro', 'Pedro'),
    ('juan perez', 'Juan Perez'),
    ('PEDRO GOMEZ', 'Pedro Gomez'),
    # caso real (sep/2026): un correo que no estaba en el diccionario a mano
    ('mario.buhler.br@gmail.com', 'Mario Buhler Br'),
])
def test_si_no_lo_reconoce_lo_presenta_lo_mejor_posible(con_indice, escrito, esperado):
    con_indice({})

    assert cns.resolver_nombre_closer(escrito) == esperado


def test_un_valor_que_no_es_texto_no_rompe(con_indice):
    con_indice({})

    assert cns.resolver_nombre_closer(123) == '123'
