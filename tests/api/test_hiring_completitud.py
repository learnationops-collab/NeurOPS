"""`completitud`: % de preguntas del formulario REAL que contestó la postulación.

El nombre siempre está contestado (la fila no existe sin él), así que una
postulación recién nacida ya trae 1 de 33.
"""
import pytest

from app.models import AssistantApplication
from app.models.assistant_application import CAMPOS_FORMULARIO, META_CON_PRESUPUESTO, OPCIONALES


def _fila(db, completo=False, **campos):
    campos.setdefault('nombre', 'Ana Pérez')
    fila = AssistantApplication(completo=completo, **campos)
    db.session.add(fila)
    db.session.commit()
    return fila


def _pct(contestadas, esperadas=33):
    return round(100 * contestadas / esperadas)


def test_recien_nacida_tiene_solo_el_nombre(db):
    assert AssistantApplication(nombre='Ana').completitud() == _pct(1)


def test_completo_es_siempre_100(db):
    assert _fila(db, completo=True).completitud() == 100
    assert _fila(db, completo=True, pais='Argentina').to_dict(include_respuestas=False)['completitud'] == 100


def test_la_opcional_y_la_condicional_que_no_aplica_no_penalizan(db):
    # Contestó las 33 siempre obligatorias y nada más: no le falta nada.
    base = {c: 'x' for c in CAMPOS_FORMULARIO if c not in OPCIONALES and c != 'meta_presupuesto'}
    fila = AssistantApplication(**base)
    assert len(fila.preguntas_esperadas()) == 33
    # Todo contestado pero sin `completo`: tope 99, llegar a 100 es terminar.
    assert fila.completitud() == 99


def test_contestar_la_opcional_no_suma(db):
    sin = AssistantApplication(nombre='Ana', pais='Argentina')
    con = AssistantApplication(nombre='Ana', pais='Argentina', automatizacion_ejemplo='Un zap')
    assert con.completitud() == sin.completitud() == _pct(2)


def test_meta_presupuesto_solo_cuenta_si_gestiono_cuentas(db):
    gestiono = AssistantApplication(nombre='Ana', meta=META_CON_PRESUPUESTO)
    assert 'meta_presupuesto' in gestiono.preguntas_esperadas()
    assert len(gestiono.preguntas_esperadas()) == 34
    assert gestiono.completitud() == _pct(2, 34)

    otra = AssistantApplication(nombre='Ana', meta='Nunca entré')
    assert 'meta_presupuesto' not in otra.preguntas_esperadas()
    assert otra.completitud() == _pct(2)


def test_cuenta_ia_avanzado_y_aporte(db):
    fila = AssistantApplication(nombre='Ana', aporte='Algo', ia_avanzado='A | B')
    assert fila.completitud() == _pct(3)


def test_vacios_no_cuentan(db):
    fila = AssistantApplication(nombre='Ana', pais='', edad=None, equipo='Sí, las tres cosas')
    assert fila.completitud() == _pct(2)


def test_viene_en_to_dict_con_y_sin_respuestas(db):
    fila = _fila(db, pais='Argentina')
    assert fila.to_dict(include_respuestas=True)['completitud'] == _pct(2)
    assert fila.to_dict(include_respuestas=False)['completitud'] == _pct(2)


# --- Con formulario editable -----------------------------------------------------------------

def _form_editable(db, apagar=(), extra=None, cambios=None):
    import copy

    from app.models import HiringForm
    from app.services.hiring_forms import PREGUNTAS_BASE

    preguntas = copy.deepcopy(PREGUNTAS_BASE)
    for p in preguntas:
        if p['id'] in apagar:
            p['on'] = False
        p.update((cambios or {}).get(p['id'], {}))
    form = HiringForm(nombre='F', activo=True, preguntas=preguntas + (extra or []))
    db.session.add(form)
    db.session.commit()
    return form


def test_con_el_formulario_base_da_lo_mismo_que_sin_formulario(db):
    form = _form_editable(db)
    for campos in ({}, {'pais': 'Argentina', 'provincia': 'Salta'}, {'meta': META_CON_PRESUPUESTO},
                   {'meta': META_CON_PRESUPUESTO, 'meta_presupuesto': '1000 USD'},
                   {c: 'x' for c in CAMPOS_FORMULARIO if c != 'nombre'}):
        sin = AssistantApplication(nombre='Ana', **campos)
        con = _fila(db, form_id=form.id, **campos)
        assert con.preguntas_esperadas() == sin.preguntas_esperadas()
        assert con.completitud() == sin.completitud()


def test_una_pregunta_apagada_no_se_espera(db):
    form = _form_editable(db, apagar=('notion', 'ciudad'))
    fila = _fila(db, form_id=form.id, pais='Argentina')

    esperadas = fila.preguntas_esperadas()
    assert 'notion' not in esperadas and 'provincia' not in esperadas
    assert len(esperadas) == 31
    assert fila.completitud() == _pct(2, 31)


def test_la_ciudad_cuenta_como_provincia(db):
    form = _form_editable(db)
    fila = _fila(db, form_id=form.id, provincia='Salta')
    assert 'provincia' in fila.preguntas_esperadas()
    assert fila.completitud() == _pct(2)


def test_una_pregunta_nueva_obligatoria_se_espera_y_se_lee_de_respuestas_extra(db):
    nueva = {'id': 'linkedin', 'tipo': 'link', 't': 'LinkedIn', 'on': True, 'base': False}
    opcional = {'id': 'hobby', 'tipo': 'texto', 't': 'Hobby', 'req': False, 'on': True, 'base': False}
    form = _form_editable(db, extra=[nueva, opcional])

    sin_responder = _fila(db, form_id=form.id)
    assert 'linkedin' in sin_responder.preguntas_esperadas()
    assert 'hobby' not in sin_responder.preguntas_esperadas()
    assert sin_responder.completitud() == _pct(1, 34)

    respondida = _fila(db, form_id=form.id, respuestas_extra={'linkedin': 'https://linkedin.com/in/ana'})
    assert respondida.completitud() == _pct(2, 34)


def test_condicion_sobre_una_pregunta_nueva(db):
    pregunta = {'id': 'tiene_auto', 'tipo': 'radio', 't': '¿Tenés auto?', 'o': [{'t': 'Sí'}, {'t': 'No'}],
                'on': True, 'base': False}
    condicional = {'id': 'patente', 'tipo': 'texto', 't': 'Patente', 'si': {'id': 'tiene_auto', 'es': 'Sí'},
                   'on': True, 'base': False}
    form = _form_editable(db, extra=[pregunta, condicional])

    assert 'patente' not in _fila(db, form_id=form.id).preguntas_esperadas()
    assert 'patente' not in _fila(
        db, form_id=form.id, respuestas_extra={'tiene_auto': 'No'}).preguntas_esperadas()
    assert 'patente' in _fila(
        db, form_id=form.id, respuestas_extra={'tiene_auto': 'Sí'}).preguntas_esperadas()


def test_condicion_sobre_una_de_opcion_multiple(db):
    marca = 'Creé mis propios GPTs o asistentes personalizados para tareas que repito'
    condicional = {'id': 'gpt_link', 'tipo': 'link', 't': 'Link a tu GPT',
                   'si': {'id': 'ia_avanzado', 'en': [marca]}, 'on': True, 'base': False}
    form = _form_editable(db, extra=[condicional])

    fila = _fila(db, form_id=form.id, ia_avanzado=f'Casi no la uso | {marca}')
    assert 'gpt_link' in fila.preguntas_esperadas()


@pytest.mark.parametrize('clave, valor', [
    ('es', 'Sí'), ('igual', 'Sí'), ('valor', 'Sí'), ('en', ['Tal vez', 'Sí']), ('valores', ['Sí']),
])
def test_condicion_acepta_los_alias_del_formulario(db, clave, valor):
    pregunta = {'id': 'tiene_auto', 'tipo': 'radio', 't': '¿Tenés auto?', 'o': ['Sí', 'No'], 'on': True, 'base': False}
    condicional = {'id': 'patente', 'tipo': 'texto', 't': 'Patente', 'si': {'id': 'tiene_auto', clave: valor},
                   'on': True, 'base': False}
    form = _form_editable(db, extra=[pregunta, condicional])

    assert 'patente' in _fila(db, form_id=form.id, respuestas_extra={'tiene_auto': 'Sí'}).preguntas_esperadas()
    assert 'patente' not in _fila(db, form_id=form.id, respuestas_extra={'tiene_auto': 'No'}).preguntas_esperadas()


def test_condicion_sin_valor_esperado_pide_que_este_contestada(db):
    condicional = {'id': 'detalle', 'tipo': 'texto', 't': 'Contá más', 'si': {'id': 'aporte'},
                   'on': True, 'base': False}
    form = _form_editable(db, extra=[condicional])

    assert 'detalle' not in _fila(db, form_id=form.id).preguntas_esperadas()
    assert 'detalle' in _fila(db, form_id=form.id, aporte='Algo').preguntas_esperadas()


def test_si_la_pregunta_de_la_que_depende_esta_apagada_no_se_espera(db):
    # Como en el formulario público: meta apagada => meta_presupuesto no se muestra.
    form = _form_editable(db, apagar=('meta',))
    fila = _fila(db, form_id=form.id, meta=META_CON_PRESUPUESTO)
    assert 'meta_presupuesto' not in fila.preguntas_esperadas()


def test_una_base_sin_la_clave_si_hereda_la_condicion_original(db):
    form = _form_editable(db)
    preguntas = [dict(p) for p in form.preguntas]
    del next(p for p in preguntas if p['id'] == 'meta_presupuesto')['si']
    form.preguntas = preguntas
    db.session.commit()

    assert 'meta_presupuesto' not in _fila(db, form_id=form.id, meta='Nunca entré').preguntas_esperadas()
    # Con `si: null` explícito, en cambio, deja de ser condicional.
    preguntas = [dict(p) for p in form.preguntas]
    next(p for p in preguntas if p['id'] == 'meta_presupuesto')['si'] = None
    form.preguntas = preguntas
    db.session.commit()
    assert 'meta_presupuesto' in _fila(db, form_id=form.id, meta='Nunca entré').preguntas_esperadas()


def test_una_base_que_pasa_a_opcional_no_se_espera(db):
    form = _form_editable(db, cambios={'edad': {'req': False}})
    assert 'edad' not in _fila(db, form_id=form.id).preguntas_esperadas()


def test_recien_creada_sin_guardar_lee_su_formulario(db):
    form = _form_editable(db, apagar=('notion',))
    assert 'notion' not in AssistantApplication(nombre='Ana', form_id=form.id).preguntas_esperadas()
