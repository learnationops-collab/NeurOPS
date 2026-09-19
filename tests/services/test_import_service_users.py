"""ImportService: las cuentas que crea al importar (closers y setters por su nombre).

Cuando el archivo trae un closer o setter que no existe y se resuelve como "crear", la importacion crea
la cuenta por su nombre. Antes todas recibian la MISMA clave escrita en el codigo, conocida por
cualquiera con acceso al repositorio: con ella se entraba como cualquiera de esas cuentas. Ahora reciben
una clave aleatoria que nadie conoce y solo entran cuando un admin les fija una.
"""
import pandas as pd
import pytest

from app.models import Appointment, SetterDailyStats, User
from app.services.import_service import ImportService
from tests.security.claves_por_defecto import CLAVES_POR_DEFECTO

VENTA = {'student_email': 'ana@x.com', 'program_name': 'AL', 'closer_username': 'Carla Ruiz',
         'payment_method_name': 'Zelle', 'payment_amount': '500', 'payment_type': 'split'}
AGENDA = {'student_email': 'beto@x.com', 'closer_username': 'Carla Ruiz', 'start_time': '2026-09-20 10:00'}
SETTER = {'date': '2026-09-19', 'Nombre': 'Sofia Paz', 'Inbox': 5}

pytestmark = pytest.mark.usefixtures('hashes_baratos')

# destino -> (fila, columna que trae al usuario, nombre, rol con que se crea, resoluciones)
CREAN_CUENTAS = {
    'sales': (VENTA, 'closer_username', 'Carla Ruiz', 'closer',
              {'closer_username': {'Carla Ruiz': '__CREATE__'}, 'program_name': {'AL': '__CREATE__'},
               'payment_method_name': {'Zelle': '__CREATE__'}}),
    'agendas': (AGENDA, 'closer_username', 'Carla Ruiz', 'closer', {'closer_username': {'Carla Ruiz': '__CREATE__'}}),
    'setters': (SETTER, 'Nombre', 'Sofia Paz', 'setter', {'Nombre': {'Sofia Paz': '__CREATE__'}}),
}


def importar(destino, fila, resoluciones):
    tabla = pd.DataFrame([fila])
    return ImportService.execute(tabla, destino, {columna: columna for columna in tabla.columns},
                                 {'resolutions': resoluciones})


@pytest.mark.parametrize('destino', sorted(CREAN_CUENTAS))
def test_la_cuenta_creada_no_tiene_ninguna_clave_conocida(db, destino):
    fila, _, nombre, rol, resoluciones = CREAN_CUENTAS[destino]

    importar(destino, fila, resoluciones)

    cuenta = User.query.filter_by(username=nombre).one()
    assert cuenta.role == rol
    assert cuenta.password_hash  # tiene una clave (aleatoria), no queda sin hash
    for candidata in (*CLAVES_POR_DEFECTO, '', nombre, nombre.lower(), nombre.replace(' ', '')):
        assert cuenta.check_password(candidata) is False


@pytest.mark.parametrize('destino', sorted(CREAN_CUENTAS))
def test_no_se_puede_entrar_a_la_cuenta_creada_con_una_clave_por_defecto(client, db, destino):
    fila, _, nombre, _, resoluciones = CREAN_CUENTAS[destino]
    importar(destino, fila, resoluciones)

    for clave in CLAVES_POR_DEFECTO:
        respuesta = client.post('/api/auth/login', json={'username': nombre, 'password': clave})

        assert respuesta.status_code == 401


def test_un_admin_puede_fijarle_una_clave_y_entonces_entra(client, db, make_user, auth_headers):
    fila, _, nombre, _, resoluciones = CREAN_CUENTAS['sales']
    importar('sales', fila, resoluciones)
    cuenta = User.query.filter_by(username=nombre).one()

    respuesta = client.put(f'/api/admin/users/{cuenta.id}', headers=auth_headers(make_user(role='admin')),
                           json={'password': 'clave-elegida-por-el-admin'})

    assert respuesta.status_code == 200
    assert client.post('/api/auth/login', json={'username': nombre, 'password': 'clave-elegida-por-el-admin'}
                       ).status_code == 200


def test_una_cuenta_que_ya_existia_no_se_toca(db, make_user):
    existente = make_user(role='closer', username='Carla Ruiz', password='la-clave-de-carla-1234')
    hash_antes = existente.password_hash

    stats = importar('sales', VENTA, {'program_name': {'AL': '__CREATE__'}, 'payment_method_name': {'Zelle': '__CREATE__'}})

    assert stats['errors'] == []
    assert User.query.count() == 1
    db.session.refresh(existente)
    assert existente.password_hash == hash_antes
    assert existente.check_password('la-clave-de-carla-1234')


def test_sin_resolver_como_crear_un_closer_desconocido_no_se_crea(db):
    stats = importar('sales', VENTA, {'program_name': {'AL': '__CREATE__'}, 'payment_method_name': {'Zelle': '__CREATE__'}})

    assert stats['success'] == 0
    assert "Closer 'Carla Ruiz' no encontrado" in stats['errors'][0]['error']
    assert User.query.count() == 0


# --- Bugs de la importacion encontrados al probarla (sin relacion con las claves) -------------
# El modelo de agendas y el de estadisticas del setter cambiaron y la herramienta quedo con el esquema
# viejo: dos de sus cuatro destinos fallan en TODAS las filas. Arreglarlo exige decidir como mapear las
# columnas (el modelo de setter se rediseño por completo), por eso solo se documenta.

@pytest.mark.xfail(strict=True, reason=(
    "BUG: importar agendas falla en TODAS las filas: Appointment no tiene las columnas status ni "
    "appointment_type (el modelo cambio y la herramienta quedo con el esquema viejo). Ademas la cuenta del "
    "closer se crea y se confirma aunque la fila falle."))
def test_importar_agendas_crea_la_agenda(db):
    stats = importar('agendas', AGENDA, {'closer_username': {'Carla Ruiz': '__CREATE__'}})

    assert stats['errors'] == []
    assert Appointment.query.count() == 1


@pytest.mark.xfail(strict=True, reason=(
    "BUG: importar estadisticas de setters falla en TODAS las filas: SetterDailyStats ya no tiene las "
    "columnas inbound_leads, openings... (el modelo se rediseño con el embudo por etapas). Ademas la cuenta "
    "del setter se crea y se confirma aunque la fila falle."))
def test_importar_estadisticas_de_setters_crea_el_registro(db):
    stats = importar('setters', SETTER, {'Nombre': {'Sofia Paz': '__CREATE__'}})

    assert stats['errors'] == []
    assert SetterDailyStats.query.count() == 1
