"""Descarte automático de una postulación de Asistente.

El formulario público corta la postulación cuando se elige una opción excluyente
(`descartado` + `motivo_descarte` con el texto de la opción), pero desde la
pantalla de descarte se puede volver atrás, cambiar la respuesta y seguir. La
marca nunca se apaga, así que el panel mira si la respuesta que cortó sigue en
pie (caso real del 08/10/2026: ~40 postulaciones aparecían descartadas aunque
habían cambiado la respuesta y seguido). Con formulario editable, además, las
excluyentes son las que marca ese formulario.
"""
import copy

from app.models import AssistantApplication, HiringForm
from app.services.hiring_forms import PREGUNTAS_BASE

OK = dict(
    equipo='Sí, las tres cosas',
    disponibilidad='Sí, las 4 horas ahora y las 8 desde el tercer mes',
    horario='Sí, me organizo sin problema',
    empleo='No',
)
SOLO_4 = 'Solo podría las 4 horas, no podría escalar a 8'


def _fila(db, form=None, **campos):
    datos = {'nombre': 'Ana', 'pais': 'Brasil', **OK, **campos}
    fila = AssistantApplication(form_id=form.id if form else None, **datos)
    db.session.add(fila)
    db.session.commit()
    return fila


def _form(db, cambiar=None):
    preguntas = copy.deepcopy(PREGUNTAS_BASE)
    if cambiar:
        cambiar(preguntas)
    form = HiringForm(nombre='F', activo=True, preguntas=preguntas)
    db.session.add(form)
    db.session.commit()
    return form


def test_volvio_atras_y_cambio_la_excluyente_no_queda_descartada(db):
    fila = _fila(db, descartado=True, motivo_descarte=SOLO_4, completo=True)
    assert fila.descarte_vigente() is False
    assert fila.veredicto() == 'sin_analizar'
    assert fila.to_dict(include_respuestas=False)['descartado'] is False


def test_si_la_excluyente_sigue_elegida_sigue_descartada(db):
    fila = _fila(db, descartado=True, motivo_descarte=SOLO_4, disponibilidad=SOLO_4)
    assert fila.descarte_vigente() is True
    assert fila.veredicto() == 'descartado'


def test_sin_motivo_guardado_la_marca_vale(db):
    assert _fila(db, descartado=True).veredicto() == 'descartado'


def test_incompleta_que_cambio_la_excluyente_queda_incompleta(db):
    assert _fila(db, descartado=True, motivo_descarte=SOLO_4).veredicto() == 'incompleta'


def test_el_veredicto_del_revisor_pisa_el_descarte(db):
    fila = _fila(db, descartado=True, motivo_descarte=SOLO_4, disponibilidad=SOLO_4, estado='seleccionada')
    assert fila.veredicto() == 'seleccionada'


def test_con_formulario_las_excluyentes_son_las_de_ese_formulario(db):
    def sacar_ko(preguntas):
        for p in preguntas:
            if p['id'] == 'disponibilidad':
                p['o'] = [{'t': o['t']} if isinstance(o, dict) else o for o in p['o']]

    sin_marca = _form(db, sacar_ko)
    fila = _fila(db, form=sin_marca, disponibilidad=SOLO_4, descartado=True, motivo_descarte=SOLO_4, completo=True)
    assert fila.auto_ko() is False
    assert fila.descarte_vigente() is False
    assert fila.veredicto() == 'sin_analizar'

    con_marca = _form(db)
    assert _fila(db, form=con_marca, disponibilidad=SOLO_4).auto_ko() is True


def test_una_pregunta_apagada_no_corta(db):
    def apagar(preguntas):
        for p in preguntas:
            if p['id'] == 'equipo':
                p['on'] = False

    form = _form(db, apagar)
    fila = _fila(db, form=form, equipo='Me falta alguna de las tres', completo=True)
    assert fila.auto_ko() is False
    assert fila.veredicto() == 'sin_analizar'


def test_las_estadisticas_cuentan_solo_los_descartes_vigentes(client, db, auth_headers, make_user):
    _fila(db, descartado=True, motivo_descarte=SOLO_4, completo=True)
    _fila(db, descartado=True, motivo_descarte=SOLO_4, disponibilidad=SOLO_4)
    res = client.get('/api/assistant-applications/stats', headers=auth_headers(make_user(role='hiring')))
    assert res.status_code == 200
    assert res.get_json()['descartadas_ko'] == 1
