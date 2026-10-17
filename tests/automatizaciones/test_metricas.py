"""Número de paso y métricas de un flujo (alcance, caída y reparto entre botones)."""
from datetime import datetime, timedelta

from app.automatizaciones import bandeja, metricas, servicio
from app.automatizaciones.modelos import AutEjecucion, AutFlujo, IgContacto, IgMensaje
from app.automatizaciones.nucleo import pasos
from tests.automatizaciones import flujos as f

AHORA = datetime(2026, 10, 15, 13, 0)


def test_los_pasos_se_numeran_a_lo_ancho_desde_el_inicio():
    assert pasos.orden(f.guia()) == {'perfil': 1, 'genial': 2, 'general': 3, 'seguimiento': 4, 'examen': 5,
                                     'es_enarm': 6, 'enarm': 7}
    assert pasos.orden(f.guia(inicio=None)) == {}


def test_los_mensajes_siguientes_atraviesan_condiciones():
    assert sorted(pasos.mensajes_siguientes(f.guia(), 'es_enarm')[0]) == ['enarm', 'general']
    assert pasos.mensajes_siguientes(f.guia(), 'es_enarm')[1] == ['es_enarm']


def _recorrer(db, version, nodos, estado=AutEjecucion.TERMINADA, actual=None):
    contacto = IgContacto(igsid=f'c{IgContacto.query.count()}', variables={})
    db.session.add(contacto)
    db.session.flush()
    ejecucion = AutEjecucion(contacto_id=contacto.id, version_id=version.id, estado=estado, nodo_actual=actual,
                             iniciada_en=AHORA - timedelta(days=1))
    db.session.add(ejecucion)
    db.session.flush()
    for nodo in nodos:
        db.session.add(IgMensaje(contacto_id=contacto.id, direccion=IgMensaje.SALIENTE, origen=IgMensaje.MOTOR,
                                 texto='x', ejecucion_id=ejecucion.id, nodo_id=nodo, enviado_en=AHORA))


def test_metricas_de_un_flujo(db):
    flujo = AutFlujo(nombre='Guía', grafo=f.guia())
    db.session.add(flujo)
    db.session.commit()
    servicio.publicar(flujo, momento=AHORA - timedelta(days=2))
    version = flujo.version_publicada
    for _ in range(6):
        _recorrer(db, version, ['perfil', 'genial', 'examen', 'enarm'])
    for _ in range(4):
        _recorrer(db, version, ['perfil', 'genial', 'examen'], estado=AutEjecucion.CANCELADA)
    for _ in range(5):
        _recorrer(db, version, ['perfil', 'general'])
    for _ in range(3):
        _recorrer(db, version, ['perfil', 'seguimiento'])
    for _ in range(2):
        _recorrer(db, version, ['perfil'], estado=AutEjecucion.ESPERANDO_RESPUESTA, actual='perfil')
    db.session.commit()

    m = metricas.de_flujo(flujo, AHORA, detalle=True)

    assert (m['entradas'], m['completan'], m['suficiente']) == (20, round(14 / 20, 3), True)
    assert [p['alcance'] for p in m['embudo']] == [20, 10, 5, 3, 10, 6]
    perfil = m['nodos']['perfil']
    # 2 siguen esperando: la caída se mide sobre 18, y los 3 que fueron a «sin respuesta» se cayeron.
    assert (perfil['base'], perfil['caida']) == (18, round(1 - 15 / 18, 3))
    assert perfil['salidas'] == {'medico': round(10 / 15, 3), 'estudiante': round(5 / 15, 3)}
    assert m['nodos']['examen']['caida'] == 0.4
    assert m['mayor_caida'] == {'id': 'examen', 'numero': 5, 'nombre': None, 'caida': 0.4}


def test_con_pocas_entradas_no_hay_mayor_caida(db):
    flujo = AutFlujo(nombre='Prueba', grafo=f.guia())
    db.session.add(flujo)
    db.session.commit()
    servicio.publicar(flujo, momento=AHORA - timedelta(days=2))
    _recorrer(db, flujo.version_publicada, ['perfil'])
    db.session.commit()

    m = metricas.de_flujo(flujo, AHORA)
    assert (m['entradas'], m['suficiente'], m['mayor_caida']) == (1, False, None)
    assert 'nodos' not in m


def test_mediana_de_respuesta_del_equipo(db):
    contacto = IgContacto(igsid='c1', variables={})
    db.session.add(contacto)
    db.session.flush()
    for minutos, origen in [(0, IgMensaje.LEAD), (1, IgMensaje.MOTOR), (10, IgMensaje.LEAD), (14, IgMensaje.OTRO),
                            (20, IgMensaje.LEAD), (40, IgMensaje.OTRO)]:
        db.session.add(IgMensaje(contacto_id=contacto.id, direccion='x', origen=origen, texto='x',
                                 enviado_en=AHORA - timedelta(hours=1) + timedelta(minutes=minutos)))
    db.session.commit()
    # Al bot no se lo cuenta: 4 y 20 minutos.
    assert bandeja.mediana_respuesta(AHORA) == 12
