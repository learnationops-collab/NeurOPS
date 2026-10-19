"""Reparto de las entradas de una campaña entre los setters: distribuido, con continuidad por persona."""
import pytest

from app.automatizaciones import campanas
from app.automatizaciones.modelos import AutEjecucion
from app.models import ManychatLead
from app.services.setter_assignment_service import condicion_leads_visibles
from tests.automatizaciones.test_registro import campana, guia, lead  # noqa: F401  (fixtures)

LEADS = ('1001', '1002', '1003', '1004')


@pytest.fixture()
def setters(make_user):
    return [make_user(role='setter', username=n) for n in ('Paula', 'Elias')]


def entra(lead, palabra, quien, minutos=1):  # noqa: F811
    lead.escribe(palabra, minutos=minutos, lead=quien)
    return AutEjecucion.query.order_by(AutEjecucion.id.desc()).first()


def test_distribuido_alterna_entre_los_setters(guia, campana, lead, setters):  # noqa: F811
    campana(['GUIA'], guia)

    asignados = [entra(lead, 'GUIA', q).setter_id for q in LEADS]

    paula, elias = (s.id for s in setters)
    assert asignados == [paula, elias, paula, elias]


def test_la_persona_conserva_su_setter_aunque_entre_por_otra_campana(guia, campana, lead, setters):  # noqa: F811
    campana(['GUIA'], guia)
    campana(['PDF'], guia, nombre='PDF')
    primero = entra(lead, 'GUIA', '1001').setter_id
    entra(lead, 'PDF', '1002')  # le toca al otro

    assert entra(lead, 'PDF', '1001', minutos=60).setter_id == primero


def test_el_setter_queda_donde_lo_dejaba_manychat(guia, campana, lead, setters):  # noqa: F811
    campana(['GUIA'], guia)
    entra(lead, 'GUIA', '1001')

    persona = ManychatLead.query.one()
    assert persona.setter == 'Paula'
    paula, elias = setters
    assert ManychatLead.query.filter(condicion_leads_visibles(paula)).count() == 1
    de_elias = ManychatLead.query.filter(condicion_leads_visibles(elias), ManychatLead.setter.isnot(None))
    assert de_elias.count() == 0


def test_solo_participan_los_elegidos_y_los_activos(guia, campana, lead, setters, db):  # noqa: F811
    paula, elias = setters
    nueva = campana(['GUIA'], guia)
    campanas.guardar(nueva, {'setters': [elias.id]})
    db.session.commit()

    assert {entra(lead, 'GUIA', q).setter_id for q in LEADS[:2]} == {elias.id}

    elias.is_active = False
    db.session.commit()
    assert entra(lead, 'GUIA', '1003').setter_id is None  # su único participante ya no está


def test_sin_reparto_queda_para_todo_el_equipo(guia, campana, lead, setters, db):  # noqa: F811
    nueva = campana(['GUIA'], guia)
    campanas.guardar(nueva, {'reparto': 'sin_reparto'})
    db.session.commit()

    assert entra(lead, 'GUIA', '1001').setter_id is None
    assert ManychatLead.query.one().setter is None


def test_solo_entre_conectados_sin_presencia_reparte_igual(guia, campana, lead, setters, db):  # noqa: F811
    nueva = campana(['GUIA'], guia)
    campanas.guardar(nueva, {'solo_conectados': True})
    db.session.commit()

    assert [entra(lead, 'GUIA', q).setter_id for q in LEADS[:2]] == [s.id for s in setters]


def test_valida_el_reparto_y_los_setters(guia, campana, setters, make_user):  # noqa: F811
    nueva = campana(['GUIA'], guia)
    closer = make_user(role='closer')
    with pytest.raises(campanas.ErrorDeCampana, match='reparto'):
        campanas.guardar(nueva, {'reparto': 'al azar'})
    with pytest.raises(campanas.ErrorDeCampana, match='setters activos'):
        campanas.guardar(nueva, {'setters': [closer.id]})


def test_la_api_lista_los_setters_activos(client, make_user, auth_headers, setters):
    setters[1].is_active = False
    cabeceras = auth_headers(make_user(role='director_comercial'))
    respuesta = client.get('/api/inbox/setters', headers=cabeceras).get_json()
    assert respuesta['setters'] == [{'id': setters[0].id, 'nombre': 'Paula'}]
