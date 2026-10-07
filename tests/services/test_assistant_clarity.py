"""Rúbrica de Clarity del puesto de Asistente, con el formulario nuevo de 35 preguntas.

Se prueba con filas sin guardar: el score es una función pura de las respuestas.
"""
import pytest

from app.models import AssistantApplication
from app.services import assistant_clarity as ac

COMPLETA = dict(
    nombre='Ana', pais='Argentina', provincia='Salta',
    experiencia='Más de 5 años', digital='Sí, más de 3 años', remoto='Más de 3 años',
    dinero='Era responsable del control financiero', pm='Sí, con más de 5 personas',
    idioma2='Avanzado o nativo', ingles='Avanzado o nativo',
    sheets='Experta/o, se lo podría enseñar a otra persona',
    ia_nivel='Experta/o, se lo podría enseñar a otra persona',
    ia_avanzado='Construí herramientas o automatizaciones con IA que después funcionan solas: un dashboard, un script, un flujo conectado con otras aplicaciones',
    meta='Gestioné cuentas publicitarias de forma habitual',
    notion='Creo bases de datos relacionadas y sistemas completos',
    wa_tools='Sí, armé flujos automáticos y campañas',
    automatizacion_ejemplo='Un flujo en Make que pasa cada venta de Stripe a una hoja y avisa por WhatsApp.',
    aporte='Manejé la liquidación de comisiones de 14 closers durante 2 años y armé un tablero en Sheets que redujo los errores a cero.',
    pendientes='Tengo un sistema propio (tablero o lista priorizada) y lo actualizo todos los días',
    retraso='Le escribo ahora para saber cuánto falta y qué necesita; si no llega, reasigno una parte. '
            'Para que no se repita acordamos entregas parciales a media mañana y un checklist de deadlines. ' * 2,
    video='https://loom.com/share/x', video_verificado='Sí, lo verifiqué', cv='https://drive.google.com/cv',
    remuneracion='350', completo=True,
)


def fila(**campos):
    return AssistantApplication(**{**COMPLETA, **campos})


def vacia():
    return AssistantApplication(nombre='Sin respuestas')


# --- La rúbrica ------------------------------------------------------------------------------

def test_los_pesos_de_fabrica_suman_100_y_cada_criterio_tiene_regla():
    assert sum(ac.DEFAULT_WEIGHTS.values()) == 100
    assert set(ac.DEFAULT_WEIGHTS) == set(ac._REGLAS)
    assert all(c['detalle'] for c in ac.CLARITY_CRITERIA)


def test_una_postulacion_ideal_puntua_cerca_del_techo_y_una_vacia_en_cero():
    assert ac.score_de(fila()) >= 90
    assert ac.score_de(vacia()) == 0


def test_cada_criterio_queda_entre_0_y_1():
    for a in (fila(), vacia(), fila(aporte='x' * 500, retraso='y' * 1200)):
        assert all(0 <= v <= 1 for v in ac.compute_criteria_values(a).values())


# --- IA: «lo más avanzado» es de opción múltiple, cuenta la más alta --------------------------

@pytest.mark.parametrize('respuesta, esperado', [
    ('Casi no la uso', 0),
    ('La uso para redactar, resumir, corregir textos y hacer consultas puntuales', 2),
    ('Uso asistentes que ya existen con prompts propios, con contexto y ejemplos, y los voy corrigiendo hasta que sale lo que quiero', 4),
    ('Creé mis propios GPTs o asistentes personalizados para tareas que repito', 5),
    ('Construí herramientas o automatizaciones con IA que después funcionan solas: un dashboard, un script', 6),
    (None, 0),
])
def test_techo_de_ia_con_las_opciones_del_formulario_nuevo(respuesta, esperado):
    assert ac._techo_ia(respuesta) == esperado


def test_con_varias_opciones_marcadas_cuenta_la_mas_avanzada():
    marcadas = ' | '.join([
        'La uso para redactar, resumir, corregir textos y hacer consultas puntuales',
        'Creé mis propios GPTs o asistentes personalizados para tareas que repito',
    ])

    assert ac._techo_ia(marcadas) == 5


def test_las_opciones_del_formulario_viejo_siguen_puntuando():
    assert ac._techo_ia('Construí algo funcional con IA: una herramienta, un dashboard') == 6
    assert ac._techo_ia('Armé agentes o flujos donde la IA se conecta con otras aplicaciones') == 6
    assert ac._techo_ia('Creé mis propios GPTs o asistentes personalizados') == 5


def test_lo_que_hizo_pesa_mas_que_lo_que_declara():
    declara_mucho_hizo_poco = fila(ia_nivel='Experta/o, se lo podría enseñar a otra persona',
                                   ia_avanzado='Casi no la uso')
    declara_poco_hizo_mucho = fila(ia_nivel='Básico, me defiendo con lo esencial')

    assert ac._valor_ia(declara_poco_hizo_mucho) > ac._valor_ia(declara_mucho_hizo_poco)


# --- Caso del atraso --------------------------------------------------------------------------

def test_el_atraso_pide_accion_inmediata_y_prevencion():
    solo_ahora = fila(retraso='Le escribo y le pregunto cuánto falta, y si hace falta reasigno una parte del trabajo.')
    solo_futuro = fila(retraso='Haría un checklist y un proceso con entregas parciales para que no se repita en adelante.')
    ambas = fila(retraso='Le escribo y le pregunto cuánto falta. Y para que no se repita armo entregas parciales y un checklist.')

    assert ac._valor_retraso(ambas) > ac._valor_retraso(solo_ahora)
    assert ac._valor_retraso(ambas) > ac._valor_retraso(solo_futuro)
    assert ac._valor_retraso(fila(retraso='No sé.')) < ac._valor_retraso(solo_ahora)
    assert ac._valor_retraso(fila(retraso=None)) == 0


def test_los_pendientes_ordenados_valen_mas_que_los_improvisados():
    sistema = fila(pendientes='Tengo un sistema propio (tablero o lista priorizada) y lo actualizo todos los días')
    nada = fila(pendientes='Voy resolviendo lo que va apareciendo')

    assert ac._valor_criterio(sistema) > ac._valor_criterio(nada)


# --- Aporte -----------------------------------------------------------------------------------

def test_un_aporte_concreto_vale_mas_que_cualidades_genericas():
    concreto = fila(aporte='Armé un tablero en Sheets que redujo los errores de liquidación a cero en 6 meses.')
    generico = fila(aporte='Soy muy responsable, proactiva y comprometida, con buena actitud y mucho compromiso con el equipo.')

    assert ac._valor_aporte(concreto) > ac._valor_aporte(generico)
    assert ac._valor_aporte(generico) <= 0.4
    assert ac._valor_aporte(fila(aporte=None)) == 0


# --- Idiomas y pretensión ---------------------------------------------------------------------

def test_idiomas_avanzado_o_nativo_es_el_techo():
    assert ac._valor_idiomas(fila()) == 1
    assert ac._valor_idiomas(fila(ingles='No lo hablo', idioma2='No lo hablo')) == 0
    assert ac._valor_idiomas(fila(ingles='Intermedio', idioma2='Básico')) == pytest.approx(2 / 3 * 0.6 + 1 / 3 * 0.4)


@pytest.mark.parametrize('pide, esperado', [
    ('200', 1.0), ('400', 1.0), ('420', 0.7), ('500', 0.4), ('550', 0.2), ('900', 0.0), ('', 0.0), (None, 0.0), ('abc', 0.0),
])
def test_la_pretension_baja_por_encima_del_rango(pide, esperado):
    assert ac._valor_pretension(fila(remuneracion=pide)) == esperado


# --- Herramientas -----------------------------------------------------------------------------

def test_sheets_pesa_el_doble_en_herramientas():
    solo_sheets = fila(notion=None, meta=None, wa_tools=None, automatizacion_ejemplo=None)

    assert ac._valor_herramientas(solo_sheets) == pytest.approx(2 / 6)


def test_la_automatizacion_contada_suma_y_la_opcional_vacia_no_resta_otra_cosa():
    sin = fila(automatizacion_ejemplo=None)
    con = fila()

    assert ac._valor_herramientas(con) > ac._valor_herramientas(sin)


# --- Formulario viejo -------------------------------------------------------------------------

def test_una_completa_sin_aporte_guardado_no_pierde_puntos_por_eso():
    # Formulario viejo, o contestada antes de que el backend guardara `aporte`: no hay dato.
    completa_sin_dato = fila(aporte=None, completo=True)
    # Todavía no llegó a esa pregunta: cuenta en cero, como cualquier otra sin contestar.
    incompleta = fila(aporte=None, completo=False)

    assert not ac.aplica(completa_sin_dato, 'aporte')
    assert ac.aplica(incompleta, 'aporte') and ac.aplica(fila(), 'aporte')
    assert ac.score_de(completa_sin_dato) > ac.score_de(incompleta)


def test_los_demas_criterios_siempre_aplican():
    assert all(ac.aplica(vacia(), c) for c in ac.DEFAULT_WEIGHTS if c != 'aporte')


# --- Pesos ------------------------------------------------------------------------------------

def test_un_peso_de_un_criterio_que_ya_no_existe_no_distorsiona_el_score():
    pesos = {**ac.DEFAULT_WEIGHTS, 'escritura': 50}

    assert ac.score_de(fila(), pesos) == ac.score_de(fila())


def test_con_todos_los_pesos_en_cero_el_score_es_cero():
    assert ac.score_de(fila(), {c: 0 for c in ac.DEFAULT_WEIGHTS}) == 0
