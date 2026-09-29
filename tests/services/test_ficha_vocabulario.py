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
                           'motivos_cancelacion', 'motivos_baja', 'pre_call', 'post_call',
                           'tipos_pago', 'medios_pago', 'medios_pago_venta', 'tipos_pago_venta',
                           'programas', 'canales_seguimiento', 'tipos_seguimiento', 'fuentes',
                           'closers'}


def test_los_tipos_de_pago_de_una_venta_se_leen_como_los_escribe_el_wizard(db):
    """La clave es la palabra canonica de `parse_tipo_pago` y la etiqueta, como se escribe detras
    del programa: un pago corregido desde la ficha tiene que leerse con el mismo tipo que tenia."""
    from app.services.sheets_service import SheetsService

    tipos = voc.vocabulario()['tipos_pago_venta']

    assert [t['clave'] for t in tipos] == ['completo', 'parcial', 'seña', 'cuota', 'renovacion',
                                           'upsell']
    for t in tipos:
        assert SheetsService.parse_tipo_pago(f"RR - {t['label']}") == ('RR', t['clave'])


def test_los_medios_de_una_venta_cubren_los_que_escriben_el_wizard_y_registrar_pago(db):
    """Corregir es arreglar lo que ya esta en la base: con un medio que no se puede elegir, el
    pago no se corrige sin cambiarle tambien el medio."""
    medios = {m['clave'] for m in voc.vocabulario()['medios_pago_venta']}

    wizard = {'Stripe', 'PayPal', 'Transferencia Bancaria', 'Binance / USDT', 'Hotmart', 'Otro'}
    assert wizard | {m['clave'] for m in voc.MEDIOS_PAGO} <= medios


def test_los_tipos_de_seguimiento_son_los_grupos_de_la_pestana_del_closer(db):
    """El tipo que se elige en la ficha ES el grupo en el que el closer ve el seguimiento: con
    otra lista, la ficha lo llamaria de una forma y la pestaña Seguimientos de otra."""
    from app.services.closer_followup_service import TIPOS_SEGUIMIENTO

    tipos = voc.vocabulario()['tipos_seguimiento']

    assert [t['clave'] for t in tipos] == ['no_tomada', 'tomada', 'cerrada']
    assert all(t['label'] == TIPOS_SEGUIMIENTO[t['clave']]['label'] for t in tipos)
    assert all(t['desc'] for t in tipos)


def test_las_fuentes_son_el_catalogo_del_tablero_de_agendas(db):
    """Dos catalogos de fuentes se desincronizan, y el embudo del workshop clasifica por este
    texto: contaria distinto segun desde donde se corrigio la agenda."""
    from app.services.fuente_service import FUENTES_CANONICAS

    claves = [o['clave'] for g in voc.fuentes_disponibles() for o in g['opciones']]

    assert sorted(claves) == sorted(FUENTES_CANONICAS)


def test_los_programas_salen_del_mismo_mapa_que_traduce_el_tipo_de_pago(db):
    """Dos listas de programas se desincronizan: el desplegable ofreceria un codigo que la
    lectura no sabe traducir y la ficha mostraria el codigo crudo."""
    from app.services.closer_followup_service import PROGRAM_CODE_NAMES

    programas = voc.vocabulario()['programas']

    assert {p['clave'] for p in programas} == set(PROGRAM_CODE_NAMES)
    assert all(p['label'] == PROGRAM_CODE_NAMES[p['clave']] for p in programas)


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
