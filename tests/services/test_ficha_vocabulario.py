"""Los vocabularios de la ficha, servidos por el backend en vez de hardcodeados en el JS.

Lo que estos tests cuidan: que las claves que YA estan en la base (`confirmation_stage`,
`confirmation_contact_status`, `confirmation_pain_points`) sigan siendo exactamente las mismas —si
el servidor empezara a mandar otras, los leads guardados dejarian de coincidir con su propia lista
y la ficha mostraria el desplegable vacio— y que una opcion creada a mano desde la UI vuelva en la
lectura siguiente para todo el equipo.
"""
import pytest

from app.models import FichaOpcion
from app.services import ficha_vocabulario as voc


def claves(grupos):
    return [o['clave'] for g in grupos for o in g['opciones']]


# --- Compatibilidad con lo que ya hay en la base ----------------------------------------------

def test_las_etapas_de_confirmacion_son_las_de_la_columna():
    assert [e['clave'] for e in voc.ETAPAS_CONFIRMACION] == \
        ['por_contactar', 'contactado', 'horario', 'videoask', 'testimonio']


def test_los_tres_valores_historicos_de_como_viene_siguen_estando(db):
    assert {'pendiente', 'espera_respuesta', 'no_contesta'} <= set(claves(voc.grupos_de('como_viene')))


def test_los_ocho_dolores_que_ya_se_guardan_siguen_estando(db):
    historicos = {'procrastinacion', 'ansiedad', 'estres', 'sin_metodo', 'miedo_fracasar',
                  'desorganizacion', 'se_distrae', 'intentos_previos'}
    assert historicos <= set(claves(voc.grupos_de('dolores')))


def test_ninguna_clave_de_como_viene_pasa_del_largo_de_la_columna(db):
    """`confirmation_contact_status` es String(20): una clave mas larga se truncaria en la base."""
    for clave in claves(voc.grupos_de('como_viene')):
        assert len(clave) <= 20, clave


# --- Grupos y tonos ---------------------------------------------------------------------------

def test_cada_grupo_trae_su_tono_del_design_system(db):
    tonos = {'success', 'warning', 'error', 'info', 'idle'}
    for grupo in voc.GRUPOS_ABIERTOS:
        for g in voc.grupos_de(grupo):
            assert g['tono'] in tonos, (grupo, g['titulo'])


def test_todo_grupo_abierto_termina_en_otros_aunque_este_vacio(db):
    """"Otros" es el boton "+ Agregar": sin el no habria donde crear la primera opcion."""
    for grupo in voc.GRUPOS_ABIERTOS:
        grupos = voc.grupos_de(grupo)
        assert grupos[-1]['titulo'] == voc.TITULO_OTROS
        assert grupos[-1]['opciones'] == []


# --- Opciones creadas a mano ------------------------------------------------------------------

def test_una_opcion_nueva_vuelve_en_la_lectura_siguiente(db, make_user):
    usuario = make_user(role='closer')

    creada = voc.agregar_opcion('como_viene', 'Viajó al exterior', usuario)

    assert creada == {'clave': 'viajo_al_exterior', 'label': 'Viajó al exterior'}
    otros = voc.grupos_de('como_viene')[-1]
    assert otros['opciones'] == [creada]


def test_agregar_dos_veces_la_misma_opcion_no_la_duplica(db):
    voc.agregar_opcion('dolores', 'Sin apoyo familiar')
    voc.agregar_opcion('dolores', 'sin  apoyo   familiar')

    assert FichaOpcion.query.filter_by(grupo='dolores').count() == 1


def test_una_opcion_que_ya_existe_de_fabrica_no_se_duplica_en_otros(db):
    devuelta = voc.agregar_opcion('dolores', 'Ansiedad')

    assert devuelta == {'clave': 'ansiedad', 'label': 'Ansiedad'}
    assert FichaOpcion.query.count() == 0


def test_un_grupo_que_no_es_abierto_no_acepta_opciones(db):
    assert voc.agregar_opcion('etapas_confirmacion', 'Etapa inventada') is None
    assert FichaOpcion.query.count() == 0


def test_una_etiqueta_sin_letras_no_crea_nada(db):
    assert voc.agregar_opcion('dolores', '   ***   ') is None
    assert FichaOpcion.query.count() == 0


def test_las_opciones_de_un_grupo_no_se_filtran_a_otro(db):
    voc.agregar_opcion('motivos_baja', 'Se recibió')

    assert claves(voc.grupos_de('motivos_descarte')).count('se_recibio') == 0
    assert 'se_recibio' in claves(voc.grupos_de('motivos_baja'))


# --- Traduccion de slug a etiqueta ------------------------------------------------------------

def test_un_slug_guardado_se_traduce_a_su_etiqueta(db):
    assert voc.etiqueta_de('como_viene', 'espera_respuesta') == 'A la espera de respuesta'
    assert voc.etiqueta_de('dolores', 'miedo_fracasar') == 'Miedo a fracasar'


def test_un_slug_historico_que_ya_no_esta_en_ninguna_lista_se_sigue_viendo(db):
    """Devolver el slug crudo es a proposito: desaparecer seria perder el dato."""
    assert voc.etiqueta_de('dolores', 'algo_viejo') == 'algo_viejo'
    assert voc.etiqueta_de('dolores', None) is None


# --- El bloque completo -----------------------------------------------------------------------

def test_el_vocabulario_trae_todas_las_claves_del_contrato(db):
    bloque = voc.vocabulario()

    assert set(bloque) == {'etapas_confirmacion', 'como_viene', 'dolores', 'motivos_descarte',
                           'motivos_baja', 'pre_call', 'post_call', 'tipos_pago', 'medios_pago',
                           'canales_seguimiento', 'closers'}


def test_los_estados_de_pre_y_post_call_se_reusan_del_dashboard_comercial(db):
    from app.services.comercial_service import POST_CALL, PRE_CALL

    bloque = voc.vocabulario()

    assert bloque['pre_call'] == PRE_CALL
    assert bloque['post_call'] == POST_CALL


def test_los_closers_traen_su_carga_del_dia_como_pista(db, make_user):
    from datetime import date, datetime, time

    from app.models import Appointment, Client

    ocupado = make_user(role='closer', username='ocupado', email='ocupado@x.com')
    libre = make_user(role='closer', username='libre', email='libre@x.com')
    cliente = Client(full_name='Ana')
    db.session.add(cliente)
    db.session.commit()
    hoy = datetime.combine(date.today(), time(15, 0))
    db.session.add_all([Appointment(closer_id=ocupado.id, client_id=cliente.id, start_time=hoy),
                        Appointment(closer_id=ocupado.id, client_id=cliente.id, start_time=hoy)])
    db.session.commit()

    pistas = {c['nombre']: c['pista'] for c in voc.closers_disponibles()}

    assert pistas == {'ocupado': '2 llamadas hoy', 'libre': 'Libre'}


@pytest.mark.parametrize('etiqueta,esperado', [
    ('Dudas con la plata', 'dudas_con_la_plata'),
    ('Perdió el interés', 'perdio_el_interes'),
    ('  Ya  rindió  ', 'ya_rindio'),
])
def test_el_slug_saca_acentos_y_espacios(etiqueta, esperado):
    assert voc.slug(etiqueta) == esperado
