"""Vista previa y reenvio a Discord de los reportes diarios de closers y setters.

La tabla de reportes abre la vista previa en una pestaña nueva con el JWT en `?token=` (sin cabecera) y
reenvia con un POST normal. Los dos endpoints validan el rol en la propia vista: no estan en
app/access_policy.py.

Desde el 10/10/2026 (se retira la vista «Administracion») la direccion comercial hereda del admin la vista
previa, el reenvio del reporte de cualquiera, la tira de pendientes y el filtro de closers del dashboard de
performance. No hereda lo que se calcula para `current_user.id` como si fuera un closer (los cupos).
"""
from datetime import date

import pytest

from app.models import CloserDailyReport, SetterDailyStats

TODOS_LOS_ROLES = ['admin', 'operator', 'director_comercial', 'director_marketing', 'closer', 'setter', 'triage',
                   'hiring']
DIRECCION = ('admin', 'director_comercial')


@pytest.fixture()
def closer(make_user):
    return make_user(role='closer')


@pytest.fixture()
def setter(make_user):
    return make_user(role='setter')


@pytest.fixture()
def reporte_closer(db, closer):
    r = CloserDailyReport(closer_id=closer.id, date=date(2026, 10, 9), slots=5)
    db.session.add(r)
    db.session.commit()
    return r


@pytest.fixture()
def reporte_setter(db, setter):
    r = SetterDailyStats(setter_id=setter.id, date=date(2026, 10, 9))
    db.session.add(r)
    db.session.commit()
    return r


@pytest.fixture()
def discord(monkeypatch):
    """Lo que llego a Discord (mockeado): [(tipo, id del reporte)]."""
    enviados = []
    monkeypatch.setattr('app.api.public.closer._trigger_closer_report_discord',
                        lambda r: enviados.append(('closer', r.id)))
    monkeypatch.setattr('app.api.setter._trigger_setter_report_webhook',
                        lambda s: enviados.append(('setter', s.id)))
    return enviados


def vista_previa(client, tipo, reporte, user, **claims):
    """La pide como la abre la tabla: pestaña nueva, el JWT en `?token=` y ninguna cabecera."""
    return client.get(f'/api/public/{tipo}-reports/{reporte.id}/preview?token={user.get_auth_token(**claims)}')


def reenviar(client, tipo, reporte, headers=None):
    return client.post(f'/api/public/{tipo}-reports/{reporte.id}/resend-discord', headers=headers or {})


# --- Vista previa ------------------------------------------------------------------------------

@pytest.mark.parametrize('tipo', ['closer', 'setter'])
@pytest.mark.parametrize('rol', TODOS_LOS_ROLES)
def test_la_vista_previa_es_solo_de_la_direccion(client, make_user, request, tipo, rol):
    reporte = request.getfixturevalue(f'reporte_{tipo}')

    r = vista_previa(client, tipo, reporte, make_user(role=rol))

    if rol in DIRECCION:
        assert r.status_code == 200
        assert r.mimetype == 'text/html'
    else:
        assert r.status_code == 403


@pytest.mark.parametrize('tipo', ['closer', 'setter'])
@pytest.mark.parametrize('rol', DIRECCION)
def test_una_cuenta_desactivada_no_ve_la_vista_previa_con_su_token_vigente(client, make_user, request, tipo, rol):
    """El request_loader ya rechaza el token de una cuenta desactivada; la vista tenia un respaldo propio que
    volvia a leer el token y la dejaba pasar."""
    reporte = request.getfixturevalue(f'reporte_{tipo}')
    activo = make_user(role=rol)
    desactivado = make_user(role=rol, is_active=False)

    assert vista_previa(client, tipo, reporte, activo).status_code == 200
    assert vista_previa(client, tipo, reporte, desactivado).status_code == 403


# --- Reenviar a Discord ------------------------------------------------------------------------

@pytest.mark.parametrize('tipo', ['closer', 'setter'])
@pytest.mark.parametrize('rol', TODOS_LOS_ROLES)
def test_la_direccion_reenvia_el_reporte_de_cualquiera(client, make_user, auth_headers, request, discord, tipo, rol):
    """`make_user` crea una cuenta nueva: el closer o el setter de aca NO es el duenio del reporte."""
    reporte = request.getfixturevalue(f'reporte_{tipo}')

    r = reenviar(client, tipo, reporte, auth_headers(make_user(role=rol)))

    if rol in DIRECCION:
        assert r.status_code == 200
        assert discord == [(tipo, reporte.id)]
    else:
        assert r.status_code == 403
        assert discord == []


@pytest.mark.parametrize('tipo', ['closer', 'setter'])
def test_cada_uno_reenvia_el_suyo(client, auth_headers, request, discord, tipo):
    duenio = request.getfixturevalue(tipo)
    reporte = request.getfixturevalue(f'reporte_{tipo}')

    assert reenviar(client, tipo, reporte, auth_headers(duenio)).status_code == 200
    assert discord == [(tipo, reporte.id)]


@pytest.mark.parametrize('tipo', ['closer', 'setter'])
def test_sin_sesion_no_se_reenvia(client, request, discord, tipo):
    assert reenviar(client, tipo, request.getfixturevalue(f'reporte_{tipo}')).status_code == 401
    assert discord == []


# --- Multirol: vale el rol ACTIVO --------------------------------------------------------------

def test_con_dos_roles_decide_el_activo(client, make_user, auth_headers, reporte_closer, discord):
    """Un closer que tambien es direccion ve y reenvia el reporte de otro solo mientras trabaja como direccion;
    y la direccion que entra como closer pierde lo que es de la direccion."""
    closer_y_direccion = make_user(role='closer', roles_extra='director_comercial')
    direccion_y_closer = make_user(role='director_comercial', roles_extra='closer')

    assert vista_previa(client, 'closer', reporte_closer, closer_y_direccion,
                        active_role='director_comercial').status_code == 200
    assert reenviar(client, 'closer', reporte_closer,
                    auth_headers(closer_y_direccion, active_role='director_comercial')).status_code == 200
    assert vista_previa(client, 'closer', reporte_closer, closer_y_direccion).status_code == 403
    assert reenviar(client, 'closer', reporte_closer, auth_headers(closer_y_direccion)).status_code == 403

    assert vista_previa(client, 'closer', reporte_closer, direccion_y_closer, active_role='closer').status_code == 403
    assert reenviar(client, 'closer', reporte_closer,
                    auth_headers(direccion_y_closer, active_role='closer')).status_code == 403
    assert discord == [('closer', reporte_closer.id)]


# --- Lo que la tabla y el dashboard le piden al backend para la direccion -----------------------

def test_la_tira_de_pendientes_responde_a_la_direccion_por_closer_o_por_equipo(
        client, make_user, auth_headers, closer, monkeypatch):
    pedidos = []
    monkeypatch.setattr('app.services.closer_pending_service.CloserPendingService.get_pending_work',
                        lambda closer_id=None, **kw: pedidos.append(closer_id) or {'total': 0})
    direccion = auth_headers(make_user(role='director_comercial'))

    assert client.get('/api/closer/pending-summary?closer_id=all', headers=direccion).status_code == 200
    assert client.get(f'/api/closer/pending-summary?closer_id={closer.id}', headers=direccion).status_code == 200
    # El closer solo ve lo suyo aunque pida el de otro.
    assert client.get('/api/closer/pending-summary?closer_id=all', headers=auth_headers(closer)).status_code == 200
    for rol in ('setter', 'triage', 'operator', 'director_marketing', 'hiring'):
        assert client.get('/api/closer/pending-summary', headers=auth_headers(make_user(role=rol))).status_code == 403

    assert pedidos == [None, closer.id, closer.id]


def test_el_filtro_de_closers_del_dashboard_le_sirve_a_la_direccion(
        client, make_user, auth_headers, closer, monkeypatch):
    pedidos = []
    monkeypatch.setattr('app.api.closer_dashboard.CloserDashboardService.get_performance_data',
                        lambda closer_id=None, **kw: pedidos.append(closer_id) or {})
    otro = make_user(role='closer')

    url = f'/api/closer/performance-dashboard?closer_id={otro.id}'
    assert client.get(url, headers=auth_headers(make_user(role='director_comercial'))).status_code == 200
    assert client.get(url, headers=auth_headers(closer)).status_code == 200

    assert pedidos == [otro.id, closer.id]


def test_los_cupos_siguen_siendo_del_closer(client, make_user, auth_headers):
    """Los cupos se leen y se guardan para `current_user.id` como si fuera un closer: la direccion no tiene
    cupos propios, asi que no se le abren (el aviso de cupos del dashboard solo se dibuja para el closer)."""
    direccion = auth_headers(make_user(role='director_comercial'))

    assert client.get('/api/closer/performance-dashboard/slots-pendientes', headers=direccion).status_code == 403
    assert client.post('/api/closer/performance-dashboard/slots', headers=direccion,
                       json={'dias': {'2026-10-09': 5}}).status_code == 403
