"""Learnito para todo el equipo (24/10/2026): la dirección ve todo; el resto, lo suyo y el ranking
(app/services/tablas/alcance.py). Y las acciones y el gráfico del conector (app/services/learnito_conector.py)."""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client, ClientComment, Notification
from app.models.person import Person
from app.services import learnito_conector as conector
from app.services.tablas import motor


@pytest.fixture()
def equipo(db, make_user):
    """Dos closers con un cliente cada uno, y alguien de la dirección."""
    ana, beto, jefa = make_user(role='closer'), make_user(role='closer'), make_user(role='admin')
    clientes = {}
    for closer, nombre in ((ana, 'Carla Díaz'), (beto, 'Diego Paz')):
        p = Person(full_name=nombre, email=f'{nombre.split()[0].lower()}@test.local')
        db.session.add(p)
        db.session.flush()
        c = Client(full_name=nombre, email=p.email, person_uuid=p.uuid)
        db.session.add(c)
        db.session.flush()
        db.session.add(Appointment(closer_id=closer.id, client_id=c.id, person_uuid=p.uuid, origin='Setter',
                                   start_time=datetime.utcnow() - timedelta(days=1)))
        clientes[closer.id] = c
    db.session.commit()
    return ana, beto, jefa, clientes


AGENDAS = {'fuente': 'appointments', 'columnas': ['f.id']}


def test_un_closer_lista_solo_sus_agendas_y_la_direccion_todas(equipo):
    ana, _, jefa, _ = equipo
    suyas = motor.run(ana, AGENDAS)
    assert suyas['total'] == 1 and suyas['alcance'].startswith('Alcance: filas y total, solo las tuyas')
    todas = motor.run(jefa, AGENDAS)
    assert todas['total'] == 2 and 'alcance' not in todas


def test_el_ranking_por_closer_es_de_todo_el_equipo(equipo):
    ana, *_ = equipo
    r = motor.run(ana, {'fuente': 'appointments', 'agrupar_por': 'p.closer_id.username'})
    assert len(r['medicion']['rows']) == 2
    assert r['alcance'].endswith('La medición es de todo el equipo.')


def test_agrupar_por_un_dato_de_cliente_solo_mide_lo_suyo(equipo):
    ana, *_ = equipo
    r = motor.run(ana, {'fuente': 'appointments', 'agrupar_por': 'f.client_id'})
    assert len(r['medicion']['rows']) == 1
    assert r['alcance'].endswith('La medición también (es un total o agrupa por un dato personal).')


def test_clientes_y_expedientes_solo_los_suyos(equipo):
    ana, beto, jefa, clientes = equipo
    assert [c['nombre'] for c in conector.find_people(ana, 'test.local')] == ['Carla Díaz']
    assert len(conector.find_people(jefa, 'test.local')) == 2
    assert conector.person(ana, clientes[beto.id].id) is None
    assert 'entre los tuyos' in conector.dossier(ana, clientes[beto.id].id)


def test_la_academia_es_de_la_direccion(equipo):
    ana, *_ = equipo
    out = conector.run_tool('calcular_tabla', {'sistema': 'academia', 'plan': {'fuente': 'alumno'}}, ana)
    assert out['texto'].startswith('Error: Los datos de la Academia')


def test_comentario_propuesto_y_confirmado(db, equipo):
    ana, beto, _, clientes = equipo
    accion, error = conector.propose_action(ana, {'tipo': 'comentario', 'texto': 'Llamar el lunes',
                                                  'cliente_id': clientes[ana.id].id})
    assert error is None and accion['estado'] == 'propuesta' and ClientComment.query.count() == 0
    assert conector.execute_action(ana, accion, 'Llamar el martes') == 'Comentario guardado en la ficha de Carla Díaz.'
    assert ClientComment.query.one().text == 'Llamar el martes'
    with pytest.raises(conector.ConectorError):
        conector.execute_action(beto, accion, 'otro')


def test_no_se_comenta_un_cliente_ajeno(equipo):
    ana, beto, _, clientes = equipo
    accion, error = conector.propose_action(ana, {'tipo': 'comentario', 'texto': 'x',
                                                  'cliente_id': clientes[beto.id].id})
    assert accion is None and 'no es tuyo' in error


def test_aviso_a_alguien_del_equipo(equipo):
    ana, beto, _, _ = equipo
    accion, error = conector.propose_action(ana, {'tipo': 'aviso', 'texto': 'Mirá la seña de Diego',
                                                  'para': beto.username})
    assert error is None and accion['detalle'][0] == f'Para: {beto.username}'
    assert conector.execute_action(ana, accion, '') == f'Aviso enviado a {beto.username}.'
    n = Notification.query.one()
    assert n.target_users == [beto.id] and n.content == 'Mirá la seña de Diego'
    _, error = conector.propose_action(ana, {'tipo': 'aviso', 'texto': 'x', 'para': 'nadie-asi'})
    assert 'No hay nadie' in error


def test_el_grafico_de_un_plan_que_agrupa(equipo):
    *_, jefa, _ = equipo
    g = conector.card(jefa, {'fuente': 'appointments', 'agrupar_por': 'p.closer_id.username'})
    assert g['w']['tipo'] == 'barras' and g['error'] is None
    assert sorted(f['valor'] for f in g['data']['filas']) == [1, 1]
    assert conector.card(jefa, AGENDAS) is None


def test_los_ejemplos_son_de_work(db):
    """El cerebro habla de Work con los ejemplos del conector (ADR-W011): frases, sin alumnos ni el Pulso."""
    ejemplos = conector.handle('examples', {})
    assert ejemplos and all(isinstance(v, str) for v in ejemplos.values())
    texto = ' '.join(ejemplos.values()).lower()
    assert 'cliente' in texto and 'entrega' not in texto and 'pulso' not in texto


def test_un_total_sin_agrupar_cuenta_solo_lo_suyo(equipo):
    """"¿Cuántas agendas tuve?" no puede medir las del equipo: un total es como las filas (ADR-W011)."""
    ana, _, jefa, _ = equipo
    plan = {'fuente': 'appointments', 'medir': {'metrica': 'count'}}
    assert conector.measure(ana, plan)['value'] == 1
    assert conector.measure(jefa, plan)['value'] == 2


def test_buscar_un_cliente_por_palabras_y_sin_tildes(equipo):
    ana, _, _, clientes = equipo
    for texto in ('Carla Diaz', 'carla díaz', 'Díaz'):
        assert [c['student_id'] for c in conector.find_people(ana, texto)] == [clientes[ana.id].id]
    assert conector.people_named(ana, ['diaz']) == [clientes[ana.id].id]
