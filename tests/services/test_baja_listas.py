"""Un cliente dado de baja sale de las listas de cobro del closer y no dispara avisos.

Las listas que se fijan acá salen de dos lugares: `_base_query` (los seguimientos del día, el
pool, el contador del dashboard, el bloqueo del reporte y los avisos por WhatsApp) y la cartera
comprada (`_cerrada_pool_items`, la cola de «Llamadas cerradas», y `_cartera_items`). Lo que
queda de un cliente de baja es solo lo que alguien agendó al darlo de baja o después.
"""
from datetime import date, datetime, timedelta
from unittest.mock import patch

import pytest

from app.models import Appointment, Client, Enrollment, FinancialSale, Payment, Program
from app.services import baja_service
from app.services.closer_followup_service import CloserFollowUpService
from app.services.closer_pending_service import CloserPendingService

HOY = date.today().isoformat()
AYER = (date.today() - timedelta(days=1)).isoformat()


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer', username='vendedor', email='vendedor@neuro.com',
                     two_chat_number='5491100000000')


@pytest.fixture()
def programa(db):
    p = Program(name='RR', price=1000.0)
    db.session.add(p)
    db.session.commit()
    return p


def _cliente_que_debe(db, closer, programa, nombre):
    """Compró, debe 600 y tiene un seguimiento de cobro vencido desde ayer, con aviso armado."""
    email = f"{nombre.split()[0].lower()}@x.com"
    c = Client(full_name=nombre, email=email, total_amount=1000.0, phone='1155550000')
    db.session.add(c)
    db.session.commit()
    db.session.add(FinancialSale(mail_cliente=email, tipo_pago='RR - Parcial', monto=400.0,
                                 estado='Completada', date=datetime(2026, 8, 1),
                                 email_vendedor='vendedor@neuro.com'))
    inscripcion = Enrollment(client_id=c.id, program_id=programa.id, closer_id=closer.id,
                             enrollment_date=datetime(2026, 8, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add(Payment(enrollment_id=inscripcion.id, amount=400.0, status='completed',
                           date=datetime(2026, 8, 1)))
    appt = Appointment(closer_id=closer.id, client_id=c.id, start_time=datetime(2026, 8, 1, 15, 0),
                       closer_result='Show up', closer_processed=True,
                       seguimiento_tipo='cerrada', seguimiento_sub='Seguimiento de cobro',
                       seguimiento_realizado=False, fecha_seguimiento=AYER,
                       followup_reminder_enabled=True, followup_reminder_time='00:00')
    db.session.add(appt)
    db.session.commit()
    return c, appt


@pytest.fixture()
def de_baja(db, closer, programa):
    c, appt = _cliente_que_debe(db, closer, programa, 'Ana Gomez')
    # La baja es posterior a todo lo que ya estaba escrito en su agenda.
    baja_service.dar_de_baja(c, 'No puede pagar', closer, cuando=datetime.utcnow() + timedelta(seconds=5))
    db.session.commit()
    return c, appt


@pytest.fixture()
def activo(db, closer, programa):
    return _cliente_que_debe(db, closer, programa, 'Beto Diaz')


def _ids(items):
    return sorted(i['client_id'] for i in items)


# --- Seguimientos del día y pool ---------------------------------------------------------------

def test_el_cobro_agendado_antes_de_la_baja_sale_de_los_seguimientos_del_dia(db, closer, de_baja, activo):
    grupos = CloserFollowUpService.get_today_grouped(closer.id, HOY)

    assert _ids(grupos['cerrada']) == [activo[0].id]


def test_el_recontacto_de_la_baja_si_aparece_y_dice_que_es_una_baja(db, closer, de_baja):
    """«¿Agendás un seguimiento a futuro?»: lo pidió quien dio la baja, así que llega su día."""
    cliente, appt = de_baja
    appt.seguimiento_sub = 'Baja: No puede pagar'
    appt.updated_at = cliente.baja_at - timedelta(seconds=1)   # aunque la fecha no ayude
    db.session.commit()

    fila, = CloserFollowUpService.get_today_grouped(closer.id, HOY)['cerrada']

    assert fila['client_id'] == cliente.id
    assert fila['deuda'] == 0.0
    assert fila['proxima_cuota'] is None
    assert fila['etapa_cobro']['clave'] == 'baja'
    assert fila['baja']['motivo'] == 'No puede pagar'


def test_un_seguimiento_escrito_despues_de_la_baja_aparece(db, closer, de_baja):
    """Agendado a sabiendas desde la ficha: esconderlo sería dejar a alguien esperándolo."""
    cliente, appt = de_baja
    appt.updated_at = cliente.baja_at + timedelta(minutes=1)
    db.session.commit()

    assert _ids(CloserFollowUpService.get_today_grouped(closer.id, HOY)['cerrada']) == [cliente.id]


def test_la_cola_de_cobro_y_su_contador_no_lo_listan(db, closer, de_baja, activo):
    assert _ids(CloserFollowUpService.get_pool(closer.id, tipo='cerrada')) == [activo[0].id]
    assert CloserFollowUpService.get_pool_counts(closer.id)['cerrada'] == 1


def test_mi_cartera_no_lo_lista(db, closer, de_baja, activo):
    assert _ids(CloserFollowUpService._cartera_items(closer.id)) == [activo[0].id]


def test_el_contador_del_dashboard_no_lo_cuenta(db, closer, de_baja, activo):
    """Es el mismo número que el mazo: si lo contara, pediría trabajo que no existe."""
    assert CloserPendingService._seguimientos(closer.id)['cerrada'] == 1


def test_revertir_lo_devuelve_a_las_listas(db, closer, de_baja, activo):
    baja_service.revertir(de_baja[0])
    db.session.commit()

    assert len(CloserFollowUpService.get_today_grouped(closer.id, HOY)['cerrada']) == 2
    assert len(CloserFollowUpService.get_pool(closer.id, tipo='cerrada')) == 2


# --- Avisos por WhatsApp ----------------------------------------------------------------------

def _mandar_avisos(monkeypatch):
    monkeypatch.setenv('FOLLOWUP_REMINDERS_ENABLED', 'true')
    with patch('app.services.whatchimp_service.WhatchimpService.send_followup_reminder') as enviar:
        resultado = CloserFollowUpService.send_due_reminders(HOY)
    return resultado, [llamada.kwargs['lead_name'] for llamada in enviar.call_args_list]


def test_un_cliente_de_baja_no_dispara_ningun_aviso(db, monkeypatch, closer, de_baja, activo):
    resultado, avisados = _mandar_avisos(monkeypatch)

    assert avisados == ['Beto Diaz']
    assert resultado['total_opted_in'] == 1


def test_ni_siquiera_por_el_recontacto_de_la_baja(db, monkeypatch, closer, de_baja):
    """El aviso lo había armado alguien para cobrarle; el WhatsApp no dice que ya no se le cobra."""
    cliente, appt = de_baja
    appt.seguimiento_sub = 'Baja: No puede pagar'
    db.session.commit()

    _resultado, avisados = _mandar_avisos(monkeypatch)

    assert avisados == []
