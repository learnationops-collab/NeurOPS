"""Formularios editables de Hiring: las preguntas base, la validación del editor,
la semilla perezosa y el resumen de cada formulario."""
import copy

import pytest

from app.models import AssistantApplication, HiringForm
from app.models.assistant_application import CAMPOS_FORMULARIO
from app.services import hiring_forms as hf


def base():
    return copy.deepcopy(hf.PREGUNTAS_BASE)


def pregunta(lista, pid):
    return next(p for p in lista if p['id'] == pid)


# --- PREGUNTAS_BASE ------------------------------------------------------------------------------

def test_las_preguntas_base_son_las_35_columnas_del_formulario_mas_la_intro():
    ids = [p['id'] for p in hf.PREGUNTAS_BASE if p['tipo'] != 'intro']
    esperado = ['ciudad' if c == 'provincia' else c for c in CAMPOS_FORMULARIO]
    assert ids == esperado
    assert hf.PREGUNTAS_BASE[0]['id'] == 'listo' and hf.PREGUNTAS_BASE[0]['tipo'] == 'intro'


def test_todas_prendidas_y_marcadas_como_base():
    assert all(p['on'] is True and p['base'] is True for p in hf.PREGUNTAS_BASE)


def test_las_marcas_de_las_opciones_se_conservan():
    p = {q['id']: q for q in hf.PREGUNTAS_BASE}
    assert [o.get('ko', False) for o in p['equipo']['o']] == [False, True, True]
    assert p['confirma']['o'][0]['correcta'] is True
    assert [o['pts'] for o in p['ia_avanzado']['o']] == [6, 5, 4, 2, 0]
    assert p['video_verificado']['o'][1]['bloquea'] is True
    assert p['meta_presupuesto']['si'] == {'id': 'meta', 'eq': 'Gestioné cuentas publicitarias de forma habitual'}
    assert p['idioma2']['tBrasil'] == '¿Qué nivel de español tenés?'
    assert p['automatizacion_ejemplo']['req'] is False


def test_las_preguntas_base_pasan_su_propia_validacion():
    hf.validar_preguntas(base())


# --- Validación ----------------------------------------------------------------------------------

def _error(lista):
    with pytest.raises(hf.PreguntasInvalidas) as exc:
        hf.validar_preguntas(lista)
    return str(exc.value)


def test_se_puede_apagar_una_base_y_sumar_una_nueva():
    lista = base()
    pregunta(lista, 'notion')['on'] = False
    lista.append({'id': 'linkedin', 'tipo': 'link', 't': 'Tu LinkedIn', 'on': True, 'base': False, 'xyz': 1})
    hf.validar_preguntas(lista)


def test_no_se_puede_borrar_una_base():
    lista = [p for p in base() if p['id'] != 'notion']
    assert 'notion' in _error(lista)


def test_nombre_queda_prendida_y_obligatoria():
    lista = base()
    pregunta(lista, 'nombre')['on'] = False
    assert 'nombre' in _error(lista)
    lista = base()
    pregunta(lista, 'nombre')['req'] = False
    assert 'nombre' in _error(lista)


@pytest.mark.parametrize('cambio, fragmento', [
    ({'id': 'Mayuscula'}, 'id'),
    ({'id': 'x'}, 'id'),
    ({'id': 'pais'}, 'repetido'),
    ({'tipo': 'slider'}, 'tipo'),
    ({'t': 'x' * 301}, 'enunciado'),
    ({'h': 'x' * 601}, 'ayuda'),
    ({'tipo': 'radio', 'o': []}, 'opciones'),
    ({'tipo': 'check', 'o': [{'t': 'x'}] * 21}, 'opciones'),
    ({'tipo': 'radio', 'o': [{'t': 'x' * 241}]}, 'opción'),
    ({'base': True}, 'base'),
    ({'si': 'meta'}, 'condición'),
])
def test_errores_de_una_pregunta_nueva(cambio, fragmento):
    nueva = {'id': 'nueva', 'tipo': 'texto', 't': 'Nueva', 'on': True, 'base': False, **cambio}
    assert fragmento in _error(base() + [nueva])


def test_lista_vacia_o_que_no_es_lista():
    assert 'lista' in _error([])
    assert 'lista' in _error({'id': 'x'})


def test_tope_de_tamano():
    nueva = {'id': 'enorme', 'tipo': 'texto', 't': 'x', 'on': True, 'base': False, 'relleno': 'x' * 210_000}
    assert '200 KB' in _error(base() + [nueva])


# --- Semilla perezosa ----------------------------------------------------------------------------

def test_semilla_crea_el_activo_y_le_asigna_las_postulaciones(db):
    vieja = AssistantApplication(nombre='Vieja')
    db.session.add(vieja)
    db.session.commit()

    form = hf.asegurar_semilla()

    assert form is not None and form.activo and form.nombre == hf.NOMBRE_BASE
    assert form.preguntas == hf.PREGUNTAS_BASE
    assert db.session.get(AssistantApplication, vieja.id).form_id == form.id
    # Segunda vez: ya hay formulario, no hace nada.
    assert hf.asegurar_semilla() is None
    assert HiringForm.query.count() == 1


def test_resumen_cuenta_activas_excluyentes_y_respuestas_completas(db):
    form = hf.asegurar_semilla()
    preguntas = base()
    pregunta(preguntas, 'empleo')['on'] = False  # una excluyente apagada
    pregunta(preguntas, 'notion')['on'] = False
    form.preguntas = preguntas
    db.session.add_all([
        AssistantApplication(nombre='A', completo=True, form_id=form.id),
        AssistantApplication(nombre='B', completo=False, form_id=form.id),
    ])
    db.session.commit()

    assert hf.resumen(form) == {"activas": 33, "total": 35, "excluyentes": 3, "respuestas": 1}


def test_preguntas_publicas_saca_las_apagadas_y_las_claves_del_editor():
    form = HiringForm(nombre='x', preguntas=base())
    pregunta(form.preguntas, 'notion')['on'] = False

    publicas = hf.preguntas_publicas(form)

    assert 'notion' not in [p['id'] for p in publicas]
    assert len(publicas) == 35
    assert not any('on' in p or 'base' in p for p in publicas)
