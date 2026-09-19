"""fuente_service: a que embudo pertenece una agenda segun el texto libre de su fuente.

Antes se decidia con `'workshop' in fuente`, asi que 'workshop landing' (la grabacion) tambien
matcheaba y sus agendas se sumaban a las del workshop en vivo. Como la fuente la escribe n8n / el
formulario, conviven mayusculas, guiones y hasta typos ('worshop_landing'): se decide por palabras.
"""
import pytest

from app.services import fuente_service as fs

LANDING = [
    'workshop landing', 'Workshop Landing', 'workshop_landing', 'workshop-landing', 'WORKSHOP.LANDING',
    'Landing Workshop',  # en cualquier orden
    'workshop replay', 'workshop grabación', 'workshop grabacion',
    'worshop_landing',  # typo real que entro por el webhook el 05/09/2026
    'wokshop landing',
]
VIVO = ['workshop', 'Workshop', 'WORKSHOP', 'workshop manychat', 'Worshop', 'workshp', 'wokshop', 'workshop live']
NI_LANDING_NI_VIVO = [None, '', '   ', 'vsl', 'setting', 'Elias', 'landing', 'replay', 'No identificado']


# --- normalizar -------------------------------------------------------------------------------

@pytest.mark.parametrize('crudo,esperado', [
    (None, ''), ('', ''), ('   ', ''), (0, ''),
    ('Workshop', 'workshop'),
    ('  Workshop   Landing  ', 'workshop landing'),
    ('workshop_landing', 'workshop landing'),
    ('workshop-landing', 'workshop landing'),
    ('workshop.landing', 'workshop landing'),
    ('workshop/landing', 'workshop landing'),
    ('workshop|landing', 'workshop landing'),
    ('workshop -- landing', 'workshop landing'),
    ('WORKSHOP_LANDING', 'workshop landing'),
    ('Grabación', 'grabacion'),
    ('Iñaki', 'inaki'),
    (123, '123'),
])
def test_normalizar(crudo, esperado):
    assert fs.normalizar(crudo) == esperado


# --- es_sin_dueno -----------------------------------------------------------------------------

@pytest.mark.parametrize('texto', [
    'setting', 'Setting', 'Desconocido', 'DESCONOCIDO', 'No identificado', 'No_Identificado',
    'sin asignar', 'Sin Identificar', '', None, '   ',
])
def test_es_sin_dueno_true_cuando_la_fuente_no_identifica_a_nadie(texto):
    assert fs.es_sin_dueno(texto) is True


@pytest.mark.parametrize('texto', ['workshop', 'workshop landing', 'vsl', 'Elias', 'Paula', 'Ivan'])
def test_es_sin_dueno_false_cuando_la_fuente_si_identifica_algo(texto):
    assert fs.es_sin_dueno(texto) is False


# --- es_vsl -----------------------------------------------------------------------------------

@pytest.mark.parametrize('textos', [('VSL',), ('vsl',), ('  Vsl ',), ('workshop', 'VSL'), (None, 'vsl')])
def test_es_vsl_true(textos):
    assert fs.es_vsl(*textos) is True


@pytest.mark.parametrize('textos', [('vsl landing',), ('workshop',), (None, ''), ()])
def test_es_vsl_false(textos):
    assert fs.es_vsl(*textos) is False


# --- es_workshop_landing / es_workshop_vivo ---------------------------------------------------

@pytest.mark.parametrize('texto', LANDING)
def test_la_grabacion_es_landing_y_no_es_vivo(texto):
    assert fs.es_workshop_landing(texto) is True
    assert fs.es_workshop_vivo(texto) is False


@pytest.mark.parametrize('texto', VIVO)
def test_el_workshop_en_vivo_es_vivo_y_no_es_landing(texto):
    assert fs.es_workshop_vivo(texto) is True
    assert fs.es_workshop_landing(texto) is False


@pytest.mark.parametrize('texto', NI_LANDING_NI_VIVO)
def test_lo_que_no_habla_de_workshop_no_es_ninguno(texto):
    assert fs.es_workshop_landing(texto) is False
    assert fs.es_workshop_vivo(texto) is False


def test_landing_pide_las_dos_palabras():
    # 'landing' solo (o 'replay' solo) no alcanza: tiene que mencionar el workshop.
    assert fs.es_workshop_landing('landing') is False
    assert fs.es_workshop_landing('replay') is False
    assert fs.es_workshop_landing('workshop') is False


def test_con_varios_textos_alcanza_con_que_uno_sea_landing():
    assert fs.es_workshop_landing('setting', 'workshop landing') is True
    assert fs.es_workshop_landing(None, '') is False


def test_si_algun_texto_es_de_la_grabacion_el_conjunto_no_es_vivo():
    # La grabacion se excluye siempre del vivo, aunque otro de los textos diga 'workshop'.
    assert fs.es_workshop_vivo('workshop', 'workshop landing') is False
    assert fs.es_workshop_vivo('setting', 'workshop') is True


@pytest.mark.parametrize('texto', ['workshop', 'worshop', 'workshp', 'wokshop', 'workshop landing'])
def test_menciona_workshop_reconoce_los_typos_conocidos(texto):
    assert fs.menciona_workshop(fs.normalizar(texto)) is True


def test_menciona_workshop_false_si_no_lo_nombra():
    assert fs.menciona_workshop('vsl') is False
    assert fs.menciona_workshop('') is False


# --- clasificar -------------------------------------------------------------------------------

@pytest.mark.parametrize('textos,esperado', [
    (('workshop landing',), 'workshop_landing'),
    (('Workshop',), 'workshop'),
    (('vsl',), 'otro'),
    ((None,), 'otro'),
    ((), 'otro'),
    (('setting', 'Workshop Landing'), 'workshop_landing'),
    (('Elias', 'workshop'), 'workshop'),
    (('workshop', 'workshop landing'), 'workshop_landing'),  # la grabacion gana
])
def test_clasificar(textos, esperado):
    assert fs.clasificar(*textos) == esperado


# --- fuente_canonica --------------------------------------------------------------------------

@pytest.mark.parametrize('crudo,esperado', [
    *[(t, 'workshop_landing') for t in LANDING],
    *[(t, 'workshop') for t in VIVO],
    ('VSL', 'vsl'), ('vsl', 'vsl'), ('  Vsl ', 'vsl'),
])
def test_fuente_canonica(crudo, esperado):
    assert fs.fuente_canonica(crudo) == esperado


@pytest.mark.parametrize('crudo', [
    None, '', '   ', 'No identificado', 'setting', 'Desconocido', 'Sin asignar', 'otra cosa', 'landing',
    'Elias', 'Paula', 'Ivan',  # un setter no es un embudo: se resuelve aparte (resolver_setter)
])
def test_fuente_canonica_es_none_si_no_identifica_un_embudo(crudo):
    assert fs.fuente_canonica(crudo) is None


# --- coherencia de las constantes -------------------------------------------------------------

@pytest.mark.parametrize('valor', [fs.FUENTE_WORKSHOP_VIVO, fs.FUENTE_WORKSHOP_LANDING, fs.FUENTE_VSL])
def test_cada_embudo_canonico_se_reconoce_a_si_mismo(valor):
    assert fs.fuente_canonica(valor) == valor


@pytest.mark.parametrize('valor', [fs.FUENTE_SETTING, fs.FUENTE_DESCONOCIDA])
def test_setting_y_desconocido_son_fuentes_sin_dueno(valor):
    assert fs.es_sin_dueno(valor) is True


def test_el_catalogo_oficial_no_repite_valores_e_incluye_a_los_setters():
    assert len(fs.FUENTES_CANONICAS) == len(set(fs.FUENTES_CANONICAS))
    assert set(fs.SETTERS) <= set(fs.FUENTES_CANONICAS)


def test_ningun_setter_activo_es_una_fuente_sin_dueno():
    assert not any(fs.es_sin_dueno(setter) for setter in fs.SETTERS)
