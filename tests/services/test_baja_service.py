"""La baja de un cliente como estado guardado (`app/services/baja_service.py`).

Antes «Dar de baja» solo dejaba `seguimiento_sub = 'Baja: …'` en una agenda: nada del sistema lo
leía como baja. Acá se fija el estado en sí —marcarlo, repetirlo, revertirlo— y la migración que
recupera las bajas dadas con la acción vieja, que tiene que poder correr dos veces sin cambiar nada.
"""
import importlib.util
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.models import Appointment, Client, ClientComment, Enrollment, Payment, Program
from app.services import baja_service

MIGRACION = Path(__file__).resolve().parents[2] / 'migrations' / 'versions' / 'ba7a0c1e3009_baja_del_cliente.py'


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='lucia', email='lucia@neuro.com')


@pytest.fixture()
def cliente(db):
    c = Client(full_name='Ana Gomez', email='ana@x.com', total_amount=1000.0)
    db.session.add(c)
    db.session.commit()
    return c


# --- El estado ---------------------------------------------------------------------------------

def test_dar_de_baja_guarda_fecha_motivo_y_quien(db, cliente, closer):
    assert baja_service.dar_de_baja(cliente, '  No puede pagar ', closer) is True
    db.session.commit()

    assert cliente.baja_at is not None
    assert cliente.baja_motivo == 'No puede pagar'
    assert cliente.baja_por_id == closer.id
    d = baja_service.descriptor(cliente)
    assert d['motivo'] == 'No puede pagar'
    assert d['por'] == 'lucia'
    assert d['fecha'] == cliente.baja_at.isoformat()


def test_repetir_la_baja_no_mueve_la_fecha_pero_corrige_el_motivo(db, cliente, closer):
    """La baja ocurrió la primera vez: repetirla no la vuelve a fechar."""
    antes = datetime(2026, 9, 1, 12, 0)
    baja_service.dar_de_baja(cliente, 'Se muda', closer, cuando=antes)
    db.session.commit()

    assert baja_service.dar_de_baja(cliente, 'Motivos familiares', closer) is False
    db.session.commit()

    assert cliente.baja_at == antes
    assert cliente.baja_motivo == 'Motivos familiares'


def test_revertir_borra_la_marca_y_devuelve_lo_que_habia(db, cliente, closer):
    baja_service.dar_de_baja(cliente, 'Salud', closer)
    db.session.commit()

    anterior = baja_service.revertir(cliente)
    db.session.commit()

    assert anterior['motivo'] == 'Salud'
    assert (cliente.baja_at, cliente.baja_motivo, cliente.baja_por_id) == (None, None, None)
    assert baja_service.descriptor(cliente) is None
    assert baja_service.revertir(cliente) is None


def test_la_fecha_legible_no_depende_del_locale(db, cliente, closer):
    baja_service.dar_de_baja(cliente, 'x', closer, cuando=datetime(2026, 9, 12, 10, 0))
    db.session.commit()

    assert baja_service.descriptor(cliente)['fecha_legible'] == '12 sep 2026'


def test_ids_de_baja_de_todos_o_de_una_lista(db, cliente, closer):
    otro = Client(full_name='Beto', email='beto@x.com')
    db.session.add(otro)
    db.session.commit()
    baja_service.dar_de_baja(cliente, 'x', closer)
    db.session.commit()

    assert baja_service.ids_de_baja() == {cliente.id}
    assert baja_service.ids_de_baja([otro.id]) == set()
    assert baja_service.ids_de_baja([otro.id, cliente.id]) == {cliente.id}
    assert baja_service.ids_de_baja([]) == set()


def test_sin_baja_filtra_las_agendas_del_cliente_de_baja(db, cliente, closer):
    otro = Client(full_name='Beto', email='beto@x.com')
    db.session.add(otro)
    db.session.commit()
    db.session.add_all([Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 9, 1)),
                        Appointment(closer_id=closer.id, client_id=otro.id, start_time=datetime(2026, 9, 1))])
    baja_service.dar_de_baja(cliente, 'x', closer)
    db.session.commit()

    quedan = Appointment.query.filter(baja_service.sin_baja()).all()

    assert [a.client_id for a in quedan] == [otro.id]


# --- La migración: las bajas dadas con la acción vieja -------------------------------------------

def _migracion():
    spec = importlib.util.spec_from_file_location('migracion_baja_del_cliente', MIGRACION)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def _baja_vieja(db, cliente, closer, motivo='No puede pagar', comentario_el=None):
    """Lo que dejaba la acción vieja: el seguimiento cerrado y, si se pide, el comentario."""
    appt = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 8, 1),
                       closer_result='Show up', seguimiento_tipo='cerrada',
                       seguimiento_sub=f'Baja: {motivo}', seguimiento_realizado=True)
    db.session.add(appt)
    if comentario_el:
        db.session.add(ClientComment(client_id=cliente.id, author_id=closer.id, created_at=comentario_el,
                                     text=f'Cliente dado de baja por {closer.username}. Motivo: {motivo}.'))
    db.session.commit()
    return appt


def _correr(db):
    marcados = _migracion().recuperar_bajas_viejas(db.session.connection())
    db.session.commit()
    db.session.expire_all()
    return marcados


def test_la_migracion_recupera_la_baja_con_la_fecha_y_el_autor_del_comentario(db, cliente, closer):
    cuando = datetime(2026, 9, 10, 14, 30)
    _baja_vieja(db, cliente, closer, comentario_el=cuando)

    assert _correr(db) == (1, 0)

    c = db.session.get(Client, cliente.id)
    assert c.baja_at == cuando
    assert c.baja_motivo == 'No puede pagar'
    assert c.baja_por_id == closer.id


def test_sin_comentario_la_fecha_es_la_de_la_agenda_y_no_hay_autor(db, cliente, closer):
    appt = _baja_vieja(db, cliente, closer)

    assert _correr(db) == (1, 0)

    c = db.session.get(Client, cliente.id)
    assert c.baja_at == appt.updated_at
    assert c.baja_por_id is None


def test_la_migracion_se_puede_correr_dos_veces(db, cliente, closer):
    _baja_vieja(db, cliente, closer, comentario_el=datetime(2026, 9, 10))
    _correr(db)
    primera = db.session.get(Client, cliente.id).baja_at

    assert _correr(db) == (0, 0)
    assert db.session.get(Client, cliente.id).baja_at == primera


def test_no_marca_a_quien_pago_despues_de_la_baja(db, cliente, closer):
    """Volvió a pagar: en los hechos no se fue, y marcarlo le escondería una deuda viva."""
    _baja_vieja(db, cliente, closer, comentario_el=datetime(2026, 9, 10))
    programa = Program(name='RR', price=1000.0)
    db.session.add(programa)
    db.session.commit()
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id, enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=200.0, status='completed',
                           date=datetime(2026, 9, 20)))
    db.session.commit()

    assert _correr(db) == (0, 1)
    assert db.session.get(Client, cliente.id).baja_at is None


def test_un_seguimiento_que_no_es_una_baja_no_marca_a_nadie(db, cliente, closer):
    db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id, start_time=datetime(2026, 8, 1),
                               seguimiento_tipo='cerrada', seguimiento_sub='Seguimiento de cobro'))
    db.session.commit()

    assert _correr(db) == (0, 0)


def test_la_migracion_no_pisa_una_baja_que_ya_estaba(db, cliente, closer):
    original = datetime(2026, 9, 1)
    baja_service.dar_de_baja(cliente, 'Salud', closer, cuando=original)
    db.session.commit()
    _baja_vieja(db, cliente, closer, motivo='Otra cosa', comentario_el=original + timedelta(days=5))

    assert _correr(db) == (0, 0)
    c = db.session.get(Client, cliente.id)
    assert (c.baja_at, c.baja_motivo) == (original, 'Salud')
