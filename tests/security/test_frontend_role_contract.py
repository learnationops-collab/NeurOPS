"""Contrato entre la politica de acceso del backend y los roles del frontend.

Proteger las 88 rutas de la herramienta interna es facil de hacer mal: si la tabla de roles se queda corta,
un rol pierde de golpe una pantalla que usa todos los dias y nadie se entera hasta que se queja. Este test
lo impide leyendo App.jsx: para cada pantalla, que roles llegan a ella (ProtectedRoute roles) y a que
endpoints llama (siguiendo los imports); y exige que la politica permita a TODO rol que llega a una
pantalla los endpoints que esa pantalla llama. Tambien que ninguna pagina publica (sin ProtectedRoute)
llame a una ruta protegida: eso romperia, por ejemplo, la pagina de reservas.

Si falla: o falta un rol en app/access_policy.py, o se cambio a proposito quien puede usar una pantalla y
hay que decidirlo (ampliar la politica o, si es un endurecimiento deliberado, documentarlo en EXCEPCIONES).
"""
from app.access_policy import POLITICA
from tests.security.frontend_roles import (
    bloqueos, cantidad_de_rutas_de_app, coincide, llamadas_del_frontend,
)

ROLES_REALES = {'admin', 'operator', 'closer', 'setter', 'triage', 'director_comercial', 'director_marketing',
                'hiring'}
# Nombres que App.jsx menciona en algun ProtectedRoute pero que no son un rol de la app (nadie los tiene).
ROLES_INEXISTENTES_EN_EL_FRONTEND = {'marketer'}

# (metodo, ruta) -> {rol: motivo}: el frontend deja llegar a ese rol a una pantalla que llama a la ruta, pero la
# politica se lo niega a proposito. Cada una explica por que.
EXCEPCIONES = {
    ('DELETE', '/api/conversational/records/clear'): {
        'setter': 'Borra los registros de interaccion de TODO el panel (mantenimiento global). El boton esta en '
                  'el gestor de mensajes del setter, pero un setter no debe poder poner en cero las '
                  'estadisticas de todos: recibe un 403 y el resto del gestor sigue funcionando.',
    },
}


def test_el_analisis_encuentra_las_pantallas_y_las_llamadas():
    # Que el contrato no pase en vacio si App.jsx cambia de forma y el analisis deja de ver las rutas.
    llamadas = llamadas_del_frontend()

    assert cantidad_de_rutas_de_app() >= 40
    assert len(llamadas) >= 200
    con_roles = [c for c, d in llamadas.items() if d['roles']]
    assert len(con_roles) >= 100


def test_la_mayoria_de_las_rutas_de_la_politica_tienen_una_pantalla_que_las_usa():
    llamadas = llamadas_del_frontend()
    usadas = {(m, r) for (m, r) in POLITICA
              if any(mf in (m, '*') and coincide(ruta, r) for (mf, ruta) in llamadas)}

    # El resto son rutas de ingesta (n8n, Apps Script) o de paginas que ninguna ruta de App.jsx alcanza.
    assert len(usadas) >= 60, f'Solo {len(usadas)} de {len(POLITICA)} rutas tienen una pantalla que las use'


def test_ningun_rol_pierde_una_pantalla_que_ya_usaba_ni_una_pagina_publica_se_rompe():
    problemas = bloqueos(POLITICA, llamadas_del_frontend(), ROLES_REALES, ROLES_INEXISTENTES_EN_EL_FRONTEND,
                         EXCEPCIONES)

    assert problemas == [], 'La politica de acceso dejaria a alguien sin una pantalla:\n' + '\n'.join(problemas)


def test_las_excepciones_siguen_vigentes():
    llamadas = llamadas_del_frontend()

    for (metodo, regla), roles in EXCEPCIONES.items():
        assert (metodo, regla) in POLITICA, f'{metodo} {regla} ya no esta en la politica: quitar la excepcion'
        for rol, motivo in roles.items():
            assert rol not in POLITICA[(metodo, regla)].roles, f'{rol} ya puede usar {metodo} {regla}: sobra la excepcion'
            alcanzado = any(mf in (metodo, '*') and coincide(ruta, regla) and rol in datos['roles']
                            for (mf, ruta), datos in llamadas.items())
            assert alcanzado, f'El frontend ya no lleva a {rol} a {metodo} {regla}: sobra la excepcion'
            assert len(motivo) > 30  # una excepcion sin motivo no es una decision


# --- El propio contrato detecta un bloqueo (para que no pueda pasar en vacio) ---------------------

class _Politica:
    def __init__(self, *roles):
        self.roles = frozenset(roles)


def _llamada(roles=(), publico=False, cualquiera=False):
    return {'roles': set(roles), 'publico': publico, 'cualquiera': cualquiera, 'archivos': {'pages/Falsa.jsx'}}


def test_detecta_que_un_rol_pierde_una_pantalla():
    politica = {('GET', '/api/public/cosa'): _Politica('admin')}
    llamadas = {('GET', '/public/cosa'): _llamada(roles=['admin', 'closer'])}

    problemas = bloqueos(politica, llamadas, ROLES_REALES, set(), {})

    assert len(problemas) == 1 and 'closer' in problemas[0] and 'PIERDE UNA PANTALLA' in problemas[0]


def test_detecta_una_pagina_publica_que_llama_a_una_ruta_protegida():
    politica = {('POST', '/api/public/cosa'): _Politica('admin')}
    llamadas = {('POST', '/public/cosa'): _llamada(publico=True)}

    problemas = bloqueos(politica, llamadas, ROLES_REALES, set(), {})

    assert any('PAGINA PUBLICA' in p for p in problemas)


def test_detecta_una_llamada_desde_una_pantalla_sin_roles_que_deja_a_alguien_fuera():
    politica = {('GET', '/api/public/cosa'): _Politica('admin', 'closer')}
    llamadas = {('GET', '/public/cosa'): _llamada(cualquiera=True)}

    problemas = bloqueos(politica, llamadas, ROLES_REALES, set(), {})

    assert len(problemas) == len(ROLES_REALES - {'admin', 'closer'})


def test_detecta_un_rol_que_no_existe_en_el_backend():
    politica = {('GET', '/api/public/cosa'): _Politica('admin')}
    llamadas = {('GET', '/public/cosa'): _llamada(roles=['admin', 'jefe'])}

    assert any('ROL DESCONOCIDO' in p for p in bloqueos(politica, llamadas, ROLES_REALES, set(), {}))


def test_una_excepcion_documentada_tolera_el_bloqueo_y_una_llamada_sin_metodo_tambien_cuenta():
    politica = {('DELETE', '/api/public/cosa/<int:id>'): _Politica('admin')}
    llamadas = {('*', '/public/cosa/<x>'): _llamada(roles=['admin', 'setter'])}

    assert len(bloqueos(politica, llamadas, ROLES_REALES, set(), {})) == 1
    assert bloqueos(politica, llamadas, ROLES_REALES, set(),
                    {('DELETE', '/api/public/cosa/<int:id>'): {'setter': 'motivo'}}) == []


# --- La ficha unificada del lead (/api/ficha) ------------------------------------------------------
#
# Este blueprint no esta en POLITICA: su guardia es un before_request propio (sesion + 5 roles), como
# la del dashboard comercial. Los tests de arriba no lo alcanzan, asi que su contrato se fija aca:
# ninguna de sus rutas puede quedar anonima y cada rol tiene que dar el codigo esperado.

import pytest  # noqa: E402

from app.api.ficha import ROLES_CON_ACCESO  # noqa: E402

# Los cinco roles que trabajan un lead entran; los tres que no tocan el circuito comercial, no.
ROLES_FUERA_DE_LA_FICHA = ('operator', 'director_marketing', 'hiring')


def _rutas_de_la_ficha(app):
    return sorted(
        (metodo, str(regla))
        for regla in app.url_map.iter_rules() if str(regla).startswith('/api/ficha')
        for metodo in (regla.methods - {'HEAD', 'OPTIONS'}))


@pytest.fixture()
def lead_de_prueba(db, make_user):
    from datetime import datetime, timedelta

    from app.models import Appointment, Client

    closer = make_user(role='closer', username='duenio', email='duenio@ficha.test')
    cliente = Client(full_name='Ana Gomez', email='ana@ficha.test')
    db.session.add(cliente)
    db.session.commit()
    appt = Appointment(closer_id=closer.id, client_id=cliente.id,
                       start_time=datetime.utcnow() + timedelta(days=1))
    db.session.add(appt)
    db.session.commit()
    return appt


def test_la_ficha_registro_sus_rutas(app):
    # Que el contrato no pase en vacio si el blueprint deja de registrarse.
    rutas = _rutas_de_la_ficha(app)

    assert len(rutas) >= 12, rutas
    assert ('GET', '/api/ficha/lead') in rutas


def test_ninguna_ruta_de_la_ficha_responde_a_un_anonimo(client, app, db, lead_de_prueba):
    """Trinquete: una ruta nueva en la ficha sin sesion rompe este test y hay que decidirla."""
    abiertas = []
    for metodo, regla in _rutas_de_la_ficha(app):
        ruta = regla.replace('<int:appt_id>', str(lead_de_prueba.id)).replace('<grupo>', 'dolores')
        respuesta = client.open(ruta, method=metodo, json={})
        if respuesta.status_code not in (401, 403):
            abiertas.append(f'{metodo} {regla} -> {respuesta.status_code}')

    assert abiertas == [], 'Rutas de la ficha abiertas a cualquiera:\n' + '\n'.join(abiertas)


@pytest.mark.parametrize('rol', ROLES_CON_ACCESO)
def test_los_cinco_roles_de_la_ficha_leen_el_lead(client, db, make_user, auth_headers, rol,
                                                 lead_de_prueba):
    usuario = make_user(role=rol, username=f'lee_{rol}', email=f'lee_{rol}@ficha.test')

    r = client.get(f'/api/ficha/lead?appointment_id={lead_de_prueba.id}',
                   headers=auth_headers(usuario))

    assert r.status_code == 200, rol


@pytest.mark.parametrize('rol', ROLES_FUERA_DE_LA_FICHA)
def test_los_roles_de_fuera_del_circuito_comercial_no_leen_el_lead(client, db, make_user,
                                                                  auth_headers, rol,
                                                                  lead_de_prueba):
    usuario = make_user(role=rol, username=f'no_{rol}', email=f'no_{rol}@ficha.test')

    r = client.get(f'/api/ficha/lead?appointment_id={lead_de_prueba.id}',
                   headers=auth_headers(usuario))

    assert r.status_code == 403, rol


# (metodo, ruta, permiso) -> el codigo que tiene que dar cada rol. 400 significa "el rol pasa la
# guardia de permiso y el payload vacio es lo que lo rechaza": lo que se fija es que NO sea 403.
ESCRITURAS = [
    ('PATCH', '/confirmacion', {'admin': 400, 'director_comercial': 400, 'closer': 400,
                                'triage': 400, 'setter': 403}),
    ('POST', '/resultado', {'admin': 400, 'director_comercial': 400, 'closer': 400,
                            'triage': 403, 'setter': 403}),
    ('PUT', '/plan-cuotas', {'admin': 400, 'director_comercial': 400, 'closer': 400,
                             'triage': 403, 'setter': 403}),
    ('POST', '/nota', {'admin': 400, 'director_comercial': 400, 'closer': 400,
                       'triage': 400, 'setter': 400}),
    # El borrado es irreversible: se comprueban primero los tres que NO pueden y al final el rol de
    # direccion que si. Que `admin` tambien pueda lo fija `tests/api/test_ficha_lead_escritura.py`.
    ('DELETE', '', {'closer': 403, 'triage': 403, 'setter': 403, 'director_comercial': 200}),
]


@pytest.mark.parametrize('metodo,sufijo,esperado', ESCRITURAS)
def test_cada_escritura_de_la_ficha_da_el_codigo_esperado_por_rol(client, db, make_user,
                                                                 auth_headers, metodo, sufijo,
                                                                 esperado, lead_de_prueba):
    """El bloque `permisos` de la lectura no es decorativo: cada ruta lo comprueba de verdad.

    Que un `director_comercial` confirme y reporte por aca es el motivo de que el blueprint exista;
    que un `setter` no pueda reportar ni cobrar es lo que evita que la puerta nueva le de permisos
    que no tenia en ninguna pantalla.
    """
    for rol, codigo in esperado.items():
        usuario = make_user(role=rol, username=f'{rol}_{metodo}_{sufijo}',
                            email=f'{rol}{metodo}{sufijo}@ficha.test'.replace('/', ''))
        r = client.open(f'/api/ficha/{lead_de_prueba.id}{sufijo}', method=metodo,
                        json={}, headers=auth_headers(usuario))
        assert r.status_code == codigo, f'{metodo} {sufijo} con rol {rol}: {r.status_code}'
        if codigo == 200:
            break  # el borrado es irreversible: con el primero que lo logra ya queda probado


def test_una_variable_del_frontend_no_se_atribuye_a_una_ruta_literal_del_backend():
    assert coincide('/public/x/<x>', '/api/public/x/<int:id>') is True
    assert coincide('/public/x/<x>', '/api/public/x/repair-db') is False
    assert coincide('/public/x/7', '/api/public/x/<int:id>') is True
    assert coincide('/public/x/abc', '/api/public/x/<int:id>') is False
    assert coincide('/public/x/abc', '/api/public/x/<string:nombre>') is True
    assert coincide('/public/x', '/api/public/x/<int:id>') is False
