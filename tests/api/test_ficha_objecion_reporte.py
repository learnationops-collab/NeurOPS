"""La objecion obligatoria de un «No cerró» al reportar la llamada desde la ficha.

Pedido de Kerwin (09/10/2026): si la llamada se reporta como «No cerró», el arbol pregunta «¿Por qué
no cerró? ¿Cuál es la objeción?» y eso queda registrado en Comunicacion. Los pedidos son los del
contrato del arbol (`reportes.json`, generado por el arbol de verdad): el backend la exige, la guarda
con el formato que lee el panel «No cerradas» del dashboard (ver `objeciones_service`) y deja la nota
en el hilo del cliente.
"""
import copy
import json
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from app.models import Appointment, Client, ClientComment, LeadEventLog
from app.services import objeciones_service

CONTRATO = (Path(__file__).resolve().parents[2] / 'frontend' / 'src' / 'components' / 'ficha'
            / '__fixtures__' / 'reportes.json')
REPORTES = json.loads(CONTRATO.read_text(encoding='utf-8'))
NO_CERRO = ('asistio_sin_cierre_seguimiento', 'asistio_sin_cierre_perdido')

# 21:30 UTC del 2 de octubre: las 17:30 en La Paz, la zona por defecto de un usuario.
LLAMADA = datetime(2026, 10, 2, 21, 30)


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
        'setter': make_user(role='setter', username='captador', email='captador@neuro.com'),
    }


@pytest.fixture()
def lead(db, equipo):
    cliente = Client(full_name='Ana Gomez', email='ana@x.com', instagram='ana.g', phone='+59171234567')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=equipo['closer'].id, setter_id=equipo['setter'].id,
                       client_id=cliente.id, start_time=LLAMADA, origin='vsl',
                       result='Confirmado', closer_result='Pendiente', closer_processed=False)
    db.session.add(appt)
    db.session.commit()
    return appt


def pedido(caso, **cambios):
    datos = copy.deepcopy(REPORTES[caso]['datos'])
    datos.update(cambios)
    return datos


def reportar(client, auth_headers, usuario, appt, datos, **claims):
    return client.post(f'/api/ficha/{appt.id}/resultado', json=datos,
                       headers=auth_headers(usuario, **claims))


def objeciones(appt):
    return LeadEventLog.query.filter_by(appointment_id=appt.id, action_type='objecion').all()


def notas_del_cliente(appt):
    return [c.text for c in ClientComment.query.filter_by(client_id=appt.client_id).all()]


# --- El contrato ------------------------------------------------------------------------------

def test_el_contrato_del_arbol_manda_la_objecion_en_los_dos_no_cerro():
    """Si el arbol deja de mandarla, el backend rechazaria todos los «No cerró»."""
    for caso in NO_CERRO:
        datos = REPORTES[caso]['datos']
        assert datos['cierre'] is False
        assert len(datos['objecion']) >= objeciones_service.MINIMO
        # Viaja ya sin los espacios de los costados que el closer haya dejado.
        assert datos['objecion'] == datos['objecion'].strip()


@pytest.mark.parametrize('caso', NO_CERRO)
def test_un_no_cerro_deja_la_objecion_con_el_formato_del_contrato(client, db, lead, equipo,
                                                                  auth_headers, caso):
    r = reportar(client, auth_headers, equipo['closer'], lead, pedido(caso))

    assert r.status_code == 200, r.get_json()
    assert r.get_json()['objecion'] is True
    [fila] = objeciones(lead)
    assert (fila.appointment_id, fila.user_id, fila.action_type) == (
        lead.id, equipo['closer'].id, 'objecion')
    # El texto TAL CUAL, sin prefijo ni sufijo: es lo que muestra el panel del dashboard.
    assert fila.description == REPORTES[caso]['datos']['objecion']
    assert fila.created_at is not None


def test_la_objecion_queda_en_comunicacion(client, db, lead, equipo, auth_headers):
    reportar(client, auth_headers, equipo['closer'], lead, pedido('asistio_sin_cierre_seguimiento'))

    texto = REPORTES['asistio_sin_cierre_seguimiento']['datos']['objecion']
    esperada = f'Objeción de la llamada del 02/10/2026 (no cerró): {texto}'
    assert esperada in notas_del_cliente(lead)

    # Y es lo que muestra la pestaña Comunicación de la ficha.
    leida = client.get(f'/api/ficha/lead?appointment_id={lead.id}',
                       headers=auth_headers(equipo['director'])).get_json()
    notas = leida['comunicacion']['notas']
    assert [n['autor'] for n in notas if n['texto'] == esperada] == ['vendedor']


def test_el_dia_de_la_llamada_se_dice_en_el_reloj_de_quien_reporta(client, db, lead, equipo,
                                                                   auth_headers):
    """A las 01:30 UTC del 3 en La Paz todavía es el 2: la nota no puede decir el día siguiente."""
    lead.start_time = datetime(2026, 10, 3, 1, 30)
    db.session.commit()

    reportar(client, auth_headers, equipo['closer'], lead, pedido('asistio_sin_cierre_seguimiento'))

    assert any(n.startswith('Objeción de la llamada del 02/10/2026') for n in notas_del_cliente(lead))


def test_bajo_suplantacion_la_objecion_no_lleva_el_sufijo(client, db, lead, equipo, auth_headers):
    """`BookingService.log_lead_event` le agrega «(Acción ejecutada por …)» a la descripción: la
    objeción no, porque el panel la muestra como texto de la llamada. Quién la escribió está en
    `user_id`."""
    r = reportar(client, auth_headers, equipo['closer'], lead,
                 pedido('asistio_sin_cierre_seguimiento'), is_impersonating=True,
                 original_user_id=equipo['director'].id, original_user_role='director_comercial')

    assert r.status_code == 200, r.get_json()
    [fila] = objeciones(lead)
    assert fila.description == REPORTES['asistio_sin_cierre_seguimiento']['datos']['objecion']
    # Las otras filas del mismo reporte sí lo llevan: la suplantación estaba activa.
    otra = LeadEventLog.query.filter_by(appointment_id=lead.id, action_type='reporte_arbol').one()
    assert 'actuando en nombre de' in otra.description


# --- Es obligatoria ---------------------------------------------------------------------------

@pytest.mark.parametrize('objecion', [None, '', '      ', 'Es caro'])
@pytest.mark.parametrize('caso', NO_CERRO)
def test_un_no_cerro_sin_objecion_no_guarda_nada(client, db, lead, equipo, auth_headers, caso,
                                                 objecion):
    r = reportar(client, auth_headers, equipo['closer'], lead, pedido(caso, objecion=objecion))

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'objecion'
    # Se valida antes de escribir: ni el resultado, ni la bitácora, ni la nota.
    assert (lead.closer_result, lead.closer_processed, lead.fecha_seguimiento) == (
        'Pendiente', False, None)
    assert LeadEventLog.query.count() == 0
    assert ClientComment.query.count() == 0


def test_el_motivo_del_rechazo_dice_el_minimo(client, db, lead, equipo, auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead,
                 pedido('asistio_sin_cierre_seguimiento', objecion='Es caro'))

    assert '10 caracteres' in r.get_json()['message']


def test_sin_el_campo_cierre_igual_se_sabe_que_no_cerro(client, db, lead, equipo, auth_headers):
    """Por esta ruta no viaja ninguna venta: asistió + oferta presentada es un «No cerró», lo diga
    o no el pedido (un navegador con el JavaScript de antes no manda `cierre`)."""
    datos = pedido('asistio_sin_cierre_seguimiento', objecion=None)
    datos.pop('cierre')
    datos['respuestas'].pop('cierre')

    r = reportar(client, auth_headers, equipo['closer'], lead, datos)

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'objecion'


def test_una_objecion_demasiado_larga_no_pasa(client, db, lead, equipo, auth_headers):
    r = reportar(client, auth_headers, equipo['closer'], lead,
                 pedido('asistio_sin_cierre_seguimiento', objecion='x' * 2001))

    assert r.status_code == 400
    assert r.get_json()['campo'] == 'objecion'


@pytest.mark.parametrize('caso', [c for c in REPORTES if c not in NO_CERRO
                                  and not c.startswith(('cadencia_', 'cobro_'))])
def test_los_demas_caminos_de_la_llamada_no_llevan_objecion(client, db, lead, equipo,
                                                            auth_headers, caso):
    assert REPORTES[caso]['datos']['objecion'] is None

    r = reportar(client, auth_headers, equipo['closer'], lead, pedido(caso))

    assert r.status_code == 200, r.get_json()
    assert objeciones(lead) == []
    assert not any(n.startswith('Objeción') for n in notas_del_cliente(lead))


# --- Las funciones del contrato ---------------------------------------------------------------

def test_objeciones_por_agenda_da_la_vigente_de_cada_una(db, lead, equipo):
    otra = Appointment(closer_id=equipo['closer'].id, client_id=lead.client_id,
                       start_time=LLAMADA - timedelta(days=30), closer_result='Show up')
    sin = Appointment(closer_id=equipo['closer'].id, client_id=lead.client_id,
                      start_time=LLAMADA - timedelta(days=60), closer_result='Show up')
    db.session.add_all([otra, sin])
    db.session.commit()

    objeciones_service.registrar_objecion(lead, equipo['closer'], 'La primera versión de la objeción')
    objeciones_service.registrar_objecion(otra, equipo['director'], 'Lo quiere pensar con su socio')
    objeciones_service.registrar_objecion(lead, equipo['director'], '  Precio: quiere cuotas sin interés  ')
    db.session.commit()

    vigentes = objeciones_service.objeciones_por_agenda([lead.id, otra.id, sin.id])

    assert set(vigentes) == {lead.id, otra.id}
    assert set(vigentes[lead.id]) == {'texto', 'autor', 'fecha'}
    assert (vigentes[lead.id]['texto'], vigentes[lead.id]['autor']) == (
        'Precio: quiere cuotas sin interés', 'direccion')
    assert vigentes[otra.id]['texto'] == 'Lo quiere pensar con su socio'
    assert datetime.fromisoformat(vigentes[lead.id]['fecha'])
    # Agregar otra no borra la anterior: queda el historial entero en la bitácora.
    assert len(objeciones(lead)) == 2
    assert objeciones_service.objeciones_por_agenda([]) == {}


def test_reemplazarla_lo_dice_en_comunicacion(db, lead, equipo):
    objeciones_service.registrar_objecion(lead, equipo['closer'], 'La primera versión de la objeción')
    objeciones_service.registrar_objecion(lead, equipo['closer'], 'La segunda versión de la objeción')
    db.session.commit()

    assert notas_del_cliente(lead) == [
        'Objeción de la llamada del 02/10/2026 (no cerró): La primera versión de la objeción',
        'Objeción actualizada de la llamada del 02/10/2026 (no cerró): La segunda versión de la objeción',
    ]


def test_registrar_objecion_valida_el_texto(db, lead, equipo):
    with pytest.raises(objeciones_service.ObjecionInvalida):
        objeciones_service.registrar_objecion(lead, equipo['closer'], 'corta')
    assert LeadEventLog.query.count() == 0
