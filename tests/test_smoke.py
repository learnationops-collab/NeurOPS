"""Humo: la app arranca, las tablas se crean y las rutas estan bien cableadas."""
import collections

# Rutas repetidas (metodo, regla) que YA existen. Flask no avisa cuando dos funciones registran la
# misma regla: la segunda queda tapada y su codigo nunca corre. Esta lista es un trinquete: un
# duplicado NUEVO rompe el test, y arreglar uno viejo obliga a sacarlo de aca.
DUPLICADOS_CONOCIDOS = {
    # `create_admin_appointment` (admin.py) es codigo muerto: siempre gana `manage_db_agendas`,
    # cuya rama POST sin `id` responde "Agenda actualizada" sin crear nada.
    ('POST', '/api/admin/db/agendas'): ['api.manage_db_agendas', 'api.create_admin_appointment'],
}

BLUEPRINTS_ESPERADOS = {
    'api', 'closer_api', 'closer_dashboard_api', 'closer_followups_api', 'closer_installments_api',
    'public_api', 'external_academy_api', 'external_dev_platform_api', 'setter', 'google_calendar_bp',
    'webhooks', 'analytics', 'marketing', 'backup', 'comments', 'manychat', 'triage', 'sheets',
    'workshop', 'metrics', 'conversational', 'alerts', 'bug_reports', 'job_applications',
    'assistant_applications', 'playbook',
}

# Rutas de las que depende el frontend para arrancar la sesion.
RUTAS_DE_SESION = [
    ('POST', '/api/auth/login'), ('POST', '/api/auth/logout'), ('GET', '/api/auth/me'),
    ('GET', '/api/auth/csrf-token'), ('POST', '/api/auth/impersonate'), ('POST', '/api/auth/revert'),
    ('GET', '/api/health'),
]

PREFIJOS_CRITICOS = [
    '/api/admin/', '/api/closer/', '/api/setter/', '/api/public/', '/api/workshop/', '/api/marketing/',
    '/api/playbook/', '/api/triage/', '/api/webhooks/', '/api/external/academy/',
    '/api/external/dev-platform/',
]


def _rutas(app):
    """{(metodo, regla): [endpoints]} sin HEAD/OPTIONS, que Flask agrega solo."""
    tabla = collections.defaultdict(list)
    for regla in app.url_map.iter_rules():
        for metodo in (regla.methods or set()) - {'HEAD', 'OPTIONS'}:
            tabla[(metodo, regla.rule)].append(regla.endpoint)
    return tabla


# --- Arranque -----------------------------------------------------------------------------------

def test_health(client):
    respuesta = client.get('/api/health')
    assert respuesta.status_code == 200
    assert respuesta.get_json() == {'status': 'healthy', 'service': 'Learnation API'}


def test_la_api_no_se_cachea(client):
    cabeceras = client.get('/api/health').headers
    assert cabeceras['Cache-Control'] == 'no-cache, no-store, must-revalidate'
    assert cabeceras['Pragma'] == 'no-cache'
    assert cabeceras['Expires'] == '0'


def test_estan_registrados_todos_los_blueprints(app):
    assert BLUEPRINTS_ESPERADOS <= set(app.blueprints)


def test_las_rutas_de_sesion_existen(app):
    rutas = _rutas(app)
    faltan = [ruta for ruta in RUTAS_DE_SESION if ruta not in rutas]
    assert faltan == []


def test_cada_prefijo_critico_tiene_rutas(app):
    reglas = [regla.rule for regla in app.url_map.iter_rules()]
    sin_rutas = [p for p in PREFIJOS_CRITICOS if not any(r.startswith(p) for r in reglas)]
    assert sin_rutas == []


def test_no_aparecen_rutas_duplicadas_nuevas(app):
    duplicadas = {clave: eps for clave, eps in _rutas(app).items() if len(eps) > 1}
    assert duplicadas == DUPLICADOS_CONOCIDOS


# --- Base de datos ------------------------------------------------------------------------------

def test_create_all_crea_todas_las_tablas(db):
    assert len(db.metadata.tables) >= 80


def test_todas_las_tablas_se_pueden_consultar(db):
    # Falla si algun modelo declara algo que SQLite no acepta (y que en Postgres si).
    for nombre, tabla in db.metadata.tables.items():
        try:
            db.session.execute(tabla.select().limit(1))
        except Exception as error:  # noqa: BLE001 - se reporta con el nombre de la tabla
            raise AssertionError(f'La tabla {nombre} no se pudo consultar: {error}') from error


def test_make_user_guarda_al_usuario_con_su_clave(make_user):
    usuario = make_user(role='setter')

    assert usuario.id is not None
    assert usuario.role == 'setter'
    assert usuario.check_password('secret123')
    assert not usuario.check_password('otra-clave')


def test_la_base_arranca_vacia_en_cada_test(db, make_user):
    # Con `make_user` corriendo antes en otros tests, esto falla si la base no se limpia.
    for nombre, tabla in db.metadata.tables.items():
        cuantas = db.session.execute(tabla.select()).all()
        assert cuantas == [], f'La tabla {nombre} no estaba vacia al empezar el test'


# --- Pasada completa: app + base + login manager ------------------------------------------------

def test_login_y_me_de_punta_a_punta(client, make_user):
    usuario = make_user(role='closer', username='ana', email='ana@test.local')

    login = client.post('/api/auth/login', json={'username': 'ana', 'password': 'secret123'})
    assert login.status_code == 200
    token = login.get_json()['token']

    me = client.get('/api/auth/me', headers={'Authorization': f'Bearer {token}'})
    assert me.status_code == 200
    assert me.get_json()['user']['id'] == usuario.id
    assert me.get_json()['user']['role'] == 'closer'
