"""`marcar_duplicada`: cancelar una agenda por ser una copia de otra.

La acción nació de un caso real (Nerina con la lead "Mia Sky", 10/sep/2026): dos citas idénticas
—mismo cliente, mismo horario— de una sincronización procesada dos veces; una quedó con la llamada
real y la otra huérfana sin reportar, inflando el total de agendas del closer.

Lo que hay que probar no es que cancele: es que sus **dos guardas** no se puedan saltear, porque
son lo único que separa "limpiar una copia" de "borrar el historial de una llamada que ocurrió".

  · nunca toca una agenda que ya tiene un resultado reportado;
  · no cancela nada si no existe otra cita del mismo cliente dentro de la ventana de seis horas.

Se probaron acá, sobre el servicio, y no sobre la ruta: es el punto por el que pasan las dos
pantallas que ofrecen la acción (el modal del lead del dashboard comercial y la ruta del mazo), y
lo único que cambia entre ellas es quién tiene permiso.
"""
from datetime import datetime, timedelta

import pytest
from freezegun import freeze_time

from app.models import Appointment, Client
from app.services.closer_agendas_service import marcar_duplicada

HOY = '2026-09-17 21:30:00'


@pytest.fixture()
def marlon(make_user):
    return make_user(role='closer', username='Marlon', email='marlon@thelearnation.com')


@pytest.fixture()
def mia(db):
    c = Client(full_name='Mia Sky', email='mia@test.local')
    db.session.add(c)
    db.session.commit()
    return c


def agenda(db, closer, cli, *, cuando, closer_result='Pendiente', result='Confirmado'):
    a = Appointment(closer_id=closer.id, client_id=cli.id, start_time=cuando, result=result,
                    closer_result=closer_result, origin='Setter',
                    created_at=cuando - timedelta(days=1))
    db.session.add(a)
    db.session.commit()
    return a


@freeze_time(HOY)
def test_cancela_la_copia_sin_reportar_y_conserva_la_otra(db, marlon, mia):
    real = agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 15, 0), closer_result='Show up')
    copia = agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 15, 0))

    ok, _mensaje, conservada = marcar_duplicada(copia)

    assert ok is True
    assert conservada == real.id
    # La copia queda cancelada por el mismo camino que "Canceló" desde el mazo...
    assert db.session.get(Appointment, copia.id).closer_result == 'Cancelado'
    # ...y la que tenía la llamada real queda intacta.
    assert db.session.get(Appointment, real.id).closer_result == 'Show up'


@freeze_time(HOY)
def test_no_toca_una_agenda_que_ya_tiene_resultado(db, marlon, mia):
    """La guarda que impide borrar el historial: si la fila que se manda es la que tiene el
    resultado, la acción se rechaza aunque exista la copia al lado."""
    real = agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 15, 0), closer_result='Show up')
    agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 15, 0))

    ok, mensaje, conservada = marcar_duplicada(real)

    assert ok is False
    assert conservada is None
    assert 'resultado' in mensaje
    assert db.session.get(Appointment, real.id).closer_result == 'Show up'


@freeze_time(HOY)
def test_sin_hermana_cercana_no_es_una_duplicada(db, marlon, mia):
    """Una agenda sin reportar suelta no se cancela: eso se resuelve reportándola. Sin esta guarda
    la acción sería "cancelar cualquier pendiente" con otro nombre."""
    sola = agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 15, 0))

    ok, mensaje, conservada = marcar_duplicada(sola)

    assert (ok, conservada) == (False, None)
    assert 'duplicada' in mensaje


@freeze_time(HOY)
def test_dos_llamadas_del_mismo_dia_separadas_no_son_la_misma_cita(db, marlon, mia):
    """La ventana es de seis horas justamente para esto: dos llamadas REALES al mismo lead el
    mismo día se agendan más separadas, y confundirlas cancelaría una cita legítima."""
    agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 9, 0), closer_result='Show up')
    tarde = agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 20, 0))

    ok, _mensaje, conservada = marcar_duplicada(tarde)

    assert (ok, conservada) == (False, None)


@freeze_time(HOY)
def test_la_copia_de_otro_closer_no_cuenta_como_hermana(db, marlon, mia, make_user):
    """La hermana tiene que ser del MISMO closer: dos closers con una cita del mismo lead a la
    misma hora es un problema de asignación, no una carga repetida, y cancelar una de las dos
    escondería el problema en vez de mostrarlo."""
    otro = make_user(role='closer', username='Nerina', email='nerina@thelearnation.com')
    agenda(db, otro, mia, cuando=datetime(2026, 9, 16, 15, 0), closer_result='Show up')
    mia_copia = agenda(db, marlon, mia, cuando=datetime(2026, 9, 16, 15, 0))

    ok, _mensaje, conservada = marcar_duplicada(mia_copia)

    assert (ok, conservada) == (False, None)
