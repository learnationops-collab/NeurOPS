"""`completitud`: % de preguntas del formulario REAL que contestó la postulación.

El nombre siempre está contestado (la fila no existe sin él), así que una
postulación recién nacida ya trae 1 de 33.
"""
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
