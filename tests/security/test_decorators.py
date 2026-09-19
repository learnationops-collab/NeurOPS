"""Decoradores de acceso (app/decorators.py): quien pasa y que responde cada uno cuando no pasa.

Se prueban sobre una app Flask minima, sin base de datos, para aislar el decorador de las vistas
reales: el rol llega en la cabecera X-Rol y las rutas devuelven {"ok": true}. Politica esperada:

  admin_required / operator_required -> admin, operator
  workshop_required                  -> admin, operator, director_marketing
  hiring_required                    -> admin, hiring
  role_required('closer')            -> solo closer
"""
import pytest
from flask import Flask, abort, jsonify
from flask_login import LoginManager, UserMixin

from app.decorators import (
    admin_required,
    hiring_required,
    operator_required,
    role_required,
    workshop_required,
)

ROLES = ['admin', 'operator', 'director_comercial', 'director_marketing', 'closer', 'setter', 'triage', 'hiring']

DECORADORES = {
    'admin': (admin_required, {'admin', 'operator'}),
    'operator': (operator_required, {'admin', 'operator'}),
    'workshop': (workshop_required, {'admin', 'operator', 'director_marketing'}),
    'hiring': (hiring_required, {'admin', 'hiring'}),
    'closer': (role_required('closer'), {'closer'}),
    'setter': (role_required('setter'), {'setter'}),
}


class Usuario(UserMixin):
    def __init__(self, rol):
        self.id = rol
        self.role = rol


def _rol_permitido(nombre):
    return sorted(DECORADORES[nombre][1])[0]


@pytest.fixture()
def mini_app():
    app = Flask(__name__)
    app.config.update(SECRET_KEY='x', TESTING=True)
    login = LoginManager(app)

    @login.request_loader
    def cargar_usuario(peticion):
        rol = peticion.headers.get('X-Rol')
        return Usuario(rol) if rol else None

    for nombre, (decorador, _) in DECORADORES.items():
        def vista_ok():
            return jsonify(ok=True)

        def vista_aborta():
            abort(404)

        def vista_falla():
            raise ValueError('detalle-interno-secreto')

        for ruta, vista in ((f'/api/{nombre}', vista_ok), (f'/panel/{nombre}', vista_ok),
                            (f'/api/{nombre}/aborta', vista_aborta), (f'/api/{nombre}/falla', vista_falla)):
            app.add_url_rule(ruta, endpoint=ruta, view_func=decorador(vista))
    return app


# --- Quien pasa -------------------------------------------------------------------------------

@pytest.mark.parametrize('nombre', DECORADORES)
@pytest.mark.parametrize('rol', ROLES)
def test_cada_rol_pasa_o_recibe_403(mini_app, nombre, rol):
    respuesta = mini_app.test_client().get(f'/api/{nombre}', headers={'X-Rol': rol})

    if rol in DECORADORES[nombre][1]:
        assert respuesta.status_code == 200
        assert respuesta.get_json() == {'ok': True}
    else:
        assert respuesta.status_code == 403
        assert 'error' in respuesta.get_json()


@pytest.mark.parametrize('nombre', DECORADORES)
def test_sin_sesion_en_la_api_es_401_json(mini_app, nombre):
    respuesta = mini_app.test_client().get(f'/api/{nombre}')

    assert respuesta.status_code == 401
    assert respuesta.get_json() == {'error': 'Authentication required'}


@pytest.mark.parametrize('nombre', DECORADORES)
def test_sin_sesion_fuera_de_la_api_redirige_al_login(mini_app, nombre):
    respuesta = mini_app.test_client().get(f'/panel/{nombre}')

    assert respuesta.status_code == 302
    assert respuesta.headers['Location'].endswith('/login')


@pytest.mark.parametrize('nombre', DECORADORES)
def test_rol_no_permitido_fuera_de_la_api_redirige_a_la_raiz(mini_app, nombre):
    rol_denegado = next(r for r in ROLES if r not in DECORADORES[nombre][1])

    respuesta = mini_app.test_client().get(f'/panel/{nombre}', headers={'X-Rol': rol_denegado})

    assert respuesta.status_code == 302
    assert respuesta.headers['Location'] == '/'


def test_un_rol_desconocido_nunca_pasa(mini_app):
    for nombre in DECORADORES:
        respuesta = mini_app.test_client().get(f'/api/{nombre}', headers={'X-Rol': 'root'})
        assert respuesta.status_code == 403


def test_la_politica_de_roles_es_la_documentada():
    # Un rol nuevo no hereda acceso por accidente: la union de los permitidos es solo esta.
    assert set().union(*(permitidos for _, permitidos in DECORADORES.values())) == {
        'admin', 'operator', 'director_marketing', 'hiring', 'closer', 'setter',
    }


# --- Manejador de no autenticado de la app real -----------------------------------------------

def test_una_ruta_protegida_fuera_de_la_api_redirige_a_la_pantalla_de_login(app):
    # Antes hacia url_for('auth.login'), un endpoint que no existe (el login de la API es 'api.login'):
    # la primera ruta protegida que no fuera /api/... habria devuelto 500 en vez de redirigir.
    from app import unauthorized

    with app.test_request_context('/panel/algo'):
        respuesta = unauthorized()

    assert respuesta.status_code == 302
    assert respuesta.headers['Location'] == '/login'


def test_una_ruta_protegida_de_la_api_responde_401_json(app):
    from app import unauthorized

    with app.test_request_context('/api/algo'):
        cuerpo, codigo = unauthorized()

    assert codigo == 401
    assert cuerpo.get_json() == {'message': 'Unauthorized'}


# --- Que hacen con los errores de la vista ----------------------------------------------------
# Antes los decoradores envolvian TAMBIEN la vista en try/except Exception: un abort(404) salia como
# HTTP 500 y una excepcion devolvia al cliente el mensaje y el traceback completo con rutas del
# servidor. Afectaba a toda vista con role_required/admin_required/etc. (69 + 38 usos).

def test_un_abort_de_la_vista_conserva_su_codigo(mini_app):
    con_otro_codigo = {}
    for nombre in DECORADORES:
        respuesta = mini_app.test_client().get(f'/api/{nombre}/aborta', headers={'X-Rol': _rol_permitido(nombre)})
        if respuesta.status_code != 404:
            con_otro_codigo[nombre] = respuesta.status_code

    assert con_otro_codigo == {}


def test_una_excepcion_de_la_vista_no_se_devuelve_al_cliente(mini_app):
    filtran = []
    for nombre in DECORADORES:
        try:
            respuesta = mini_app.test_client().get(f'/api/{nombre}/falla', headers={'X-Rol': _rol_permitido(nombre)})
        except ValueError:
            continue  # la excepcion llego al manejador de errores de la app: es lo correcto
        cuerpo = respuesta.get_data(as_text=True)
        if 'Traceback' in cuerpo or 'detalle-interno-secreto' in cuerpo:
            filtran.append(nombre)

    assert filtran == []
