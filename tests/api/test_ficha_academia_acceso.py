"""Dar, renovar y quitar el acceso a la Academia desde Fulfillment (pedido del 30/09/2026).

La Academia solo tiene una escritura sobre accesos: asignar un producto con su vencimiento. Estos
tests fijan que las tres acciones la usen bien —el producto del programa que pagó, por el id del
alumno cuando ya existe, «hoy» para quitar— y que un pedido incompleto NO llegue a la Academia:
es otro sistema, con un límite de peticiones compartido con producción.
"""
from datetime import datetime, timedelta
from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.models import (
    Appointment, Client, ClientComment, Enrollment, FinancialSale, Integration, LeadEventLog, Program,
)
from app.services import academy_access_service, ficha_academia, ficha_fulfillment_service
from app.services.learnation_service import LearnationAPIError
from app.services.user_time_service import hoy_del_usuario


@pytest.fixture()
def equipo(make_user):
    return {
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
    }


@pytest.fixture()
def alumno(db, equipo):
    """Compró RR (parcial) y ya es alumno en la Academia con el id 87."""
    programa = Program(name='Residency Roadmap', price=1000.0)
    cliente = Client(full_name='Luis Paz', email='luis@x.com', total_amount=1000.0, learnation_user_id=87)
    db.session.add_all([programa, cliente, Integration(
        key='learnation_academy', name='Academia',
        payload_config={'product_mapping': {'RR': 'residency-roadmap', 'AL': 'ace-learners'}})])
    db.session.commit()
    db.session.add_all([
        FinancialSale(mail_cliente='luis@x.com', tipo_pago='RR - Parcial', monto=400.0,
                      estado='Completada', date=datetime(2026, 8, 1), email_vendedor='vendedor@neuro.com'),
        Enrollment(client_id=cliente.id, program_id=programa.id, closer_id=equipo['closer'].id,
                   enrollment_date=datetime(2026, 8, 1)),
        Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                    start_time=datetime.utcnow() - timedelta(days=20), closer_result='Show up',
                    closer_processed=True, seguimiento_realizado=True),
    ])
    db.session.commit()
    return cliente


def _agenda(cliente):
    return Appointment.query.filter_by(client_id=cliente.id).first()


def _post(client, auth_headers, usuario, cliente, sufijo, cuerpo):
    return client.post(f'/api/ficha/{_agenda(cliente).id}/academia/{sufijo}', json=cuerpo,
                       headers=auth_headers(usuario))


@pytest.fixture()
def academia():
    """Los tres puntos por donde se le habla a la Academia, doblados."""
    with patch.object(ficha_academia, 'LearnationService') as escribe, \
            patch.object(ficha_fulfillment_service, 'LearnationService') as busca, \
            patch.object(academy_access_service, 'LearnationService') as alta:
        busca.check_user.return_value = {'exists': False}
        alta.upsert_user.return_value = {'action': 'created', 'user': {'id': 501}}
        alta.assign_product.return_value = {'assignment': {}}
        yield SimpleNamespace(escribe=escribe, busca=busca, alta=alta)


def _en(dias, usuario):
    return (hoy_del_usuario(usuario) + timedelta(days=dias)).isoformat()


# --- Renovar ------------------------------------------------------------------------------------





# --- Dar ----------------------------------------------------------------------------------------





# --- Lo que se rechaza antes de hablar con la Academia -----------------------------------------







# --- Quitar -------------------------------------------------------------------------------------

def test_quitar_hace_vencer_hoy_el_producto_que_pago(client, db, alumno, equipo, auth_headers, academia):
    hoy = _en(0, equipo['closer'])

    r = _post(client, auth_headers, equipo['closer'], alumno, 'quitar',
              {'confirmo': True, 'motivo': 'Se dio de baja'})

    assert r.status_code == 200, r.get_json()
    assert r.get_json() == {'accion': 'quitado', 'vence': hoy, 'programa': 'Residency Roadmap'}
    assert 'vence hoy' in ClientComment.query.one().text
    academia.escribe.assign_product.assert_called_once_with(87, 'residency-roadmap', expires_at=hoy)
    assert db.session.get(Client, alumno.id).academy_expires_at.date().isoformat() == hoy
    assert ClientComment.query.one().text.endswith('Motivo: Se dio de baja.')


@pytest.mark.parametrize('cuerpo', [{}, {'confirmo': 'true'}, {'confirmo': 1}])
def test_quitar_sin_confirmar_no_corta_nada(client, db, alumno, equipo, auth_headers, academia, cuerpo):
    r = _post(client, auth_headers, equipo['closer'], alumno, 'quitar', cuerpo)

    assert r.status_code == 400
    academia.escribe.assign_product.assert_not_called()


def test_quitar_a_quien_no_es_alumno_avisa(client, db, alumno, equipo, auth_headers, academia):
    alumno.learnation_user_id = None
    db.session.commit()

    r = _post(client, auth_headers, equipo['closer'], alumno, 'quitar', {'confirmo': True})

    assert r.status_code == 400
    assert 'no hay acceso que quitar' in r.get_json()['message']
    academia.escribe.assign_product.assert_not_called()


# --- Con qué arranca el formulario --------------------------------------------------------------

def _venta(tipo, mail='luis@x.com'):
    return SimpleNamespace(tipo_pago=tipo, mail_cliente=mail)


def test_la_sugerencia_renueva_desde_el_vencimiento_que_tiene_si_todavia_no_paso():
    from datetime import date

    cliente = SimpleNamespace(email='luis@x.com')
    hoy = date(2026, 9, 30)
    vigente = {'expires_at': '2026-10-15T00:00:00+00:00'}
    vencido = {'expires_at': '2026-09-01T00:00:00+00:00'}

    sugerido = ficha_fulfillment_service.sugerencias_de_acceso
    assert sugerido(cliente, [_venta('RR - Parcial')], vigente, hoy)['vence_sugerido'] == '2027-02-15'
    assert sugerido(cliente, [_venta('RR - Parcial')], vencido, hoy)['vence_sugerido'] == '2027-01-30'
    # Lo único que pagó es una seña: la regla del alta da 7 días.
    assert sugerido(cliente, [_venta('RR - Seña')], None, hoy)['vence_sugerido'] == '2026-10-07'


def test_la_sugerencia_de_correo_saltea_el_inventado():
    cliente = SimpleNamespace(email='no-email-ab12@neurops.com')

    assert ficha_fulfillment_service.sugerencias_de_acceso(
        cliente, [_venta('RR - Parcial', 'real@x.com')])['email_sugerido'] == 'real@x.com'


# --- De qué closer depende el alumno -------------------------------------------------------------





def test_desactivar_un_closer_le_avisa_a_la_academia_con_los_que_siguen_activos(client, db, equipo, make_user,
                                                                                auth_headers):
    admin = make_user(role='admin', username='jefa', email='jefa@neuro.com')
    otro = make_user(role='closer', username='otro', email='Otro@neuro.com')
    make_user(role='closer', username='inactivo', email='inactivo@neuro.com', is_active=False)

    with patch.object(academy_access_service.AcademyAccessService, 'avisar_baja') as avisar:
        r = client.put(f"/api/admin/users/{equipo['closer'].id}", json={'is_active': False}, headers=auth_headers(admin))
        assert r.status_code == 200, r.get_json()
        avisar.assert_called_once()
        # Volver a guardarlo ya desactivado no avisa de nuevo.
        client.put(f"/api/admin/users/{equipo['closer'].id}", json={'is_active': False}, headers=auth_headers(admin))
        avisar.assert_called_once()

    with patch.object(academy_access_service, 'threading') as hilo, \
            patch.object(academy_access_service, 'LearnationService') as academia:
        academy_access_service.AcademyAccessService.avisar_baja(equipo['closer'])
        hilo.Thread.call_args.kwargs['target']()
    payload = academia.report_closer_deactivated.call_args.args[0]
    assert payload['email'] == 'vendedor@neuro.com'
    assert [a['email'] for a in payload['activos']] == [otro.email.lower()]




