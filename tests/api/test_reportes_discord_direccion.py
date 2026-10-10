"""Vista previa y reenvio a Discord de los reportes diarios de closers y setters.

La tabla de reportes abre la vista previa en una pestaña nueva con el JWT en `?token=` (sin cabecera) y
reenvia con un POST normal. Los dos endpoints validan el rol en la propia vista: no estan en
app/access_policy.py.
"""
from datetime import date

import pytest

from app.models import CloserDailyReport, SetterDailyStats


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


def vista_previa(client, tipo, reporte, user, **claims):
    """La pide como la abre la tabla: pestaña nueva, el JWT en `?token=` y ninguna cabecera."""
    return client.get(f'/api/public/{tipo}-reports/{reporte.id}/preview?token={user.get_auth_token(**claims)}')


# --- Cuentas desactivadas ----------------------------------------------------------------------

@pytest.mark.parametrize('tipo', ['closer', 'setter'])
def test_una_cuenta_desactivada_no_ve_la_vista_previa_con_su_token_vigente(client, make_user, request, tipo):
    """El request_loader ya rechaza el token de una cuenta desactivada; la vista tenia un respaldo propio que
    volvia a leer el token y la dejaba pasar."""
    reporte = request.getfixturevalue(f'reporte_{tipo}')
    activo = make_user(role='admin')
    desactivado = make_user(role='admin', is_active=False)

    assert vista_previa(client, tipo, reporte, activo).status_code == 200
    assert vista_previa(client, tipo, reporte, desactivado).status_code == 403
