"""Resumen del uso de la IA: quien la usa y cuanto gasta, solo para admin y operator."""
from datetime import datetime, timedelta
from decimal import Decimal

from app.models import AiUsage

RESUMEN = '/api/ai-usage/resumen'
LLAMADAS = '/api/ai-usage/llamadas'


def _uso(db, user, costo, feature='copiloto', status='ok', cuando=None):
    fila = AiUsage(user_id=user.id if user else None, feature=feature, model='claude-haiku-5-5',
                   input_tokens=100, output_tokens=10, cache_creation_input_tokens=0,
                   cache_read_input_tokens=0, cost_usd=Decimal(costo), status=status,
                   created_at=cuando or datetime.utcnow())
    db.session.add(fila)
    db.session.commit()
    return fila


def test_resumen_agrupa_por_usuario_funcion_y_modelo(client, db, auth_headers, make_user):
    admin = make_user(role='admin')
    ana = make_user(role='closer', username='ana')
    beto = make_user(role='closer', username='beto')
    _uso(db, ana, '0.002')
    _uso(db, ana, '0.001', status='error')
    _uso(db, beto, '0.010', feature='redaccion')

    datos = client.get(RESUMEN, headers=auth_headers(admin)).get_json()

    assert datos['total']['llamadas'] == 3
    assert datos['total']['errores'] == 1
    assert datos['total']['cost_usd'] == 0.013
    assert [(u['usuario'], u['llamadas']) for u in datos['por_usuario']] == [('beto', 1), ('ana', 2)]
    assert {f['feature'] for f in datos['por_funcion']} == {'copiloto', 'redaccion'}
    assert datos['por_modelo'][0]['model'] == 'claude-haiku-5-5'


def test_el_mes_anterior_no_entra_por_defecto(client, db, auth_headers, make_user):
    admin = make_user(role='admin')
    _uso(db, admin, '0.5', cuando=datetime.utcnow().replace(day=1) - timedelta(days=2))

    datos = client.get(RESUMEN, headers=auth_headers(admin)).get_json()

    assert datos['total']['llamadas'] == 0


def test_rango_invalido(client, auth_headers, make_user):
    admin = make_user(role='admin')

    respuesta = client.get(f'{RESUMEN}?desde=2026-10-10&hasta=2026-10-01', headers=auth_headers(admin))

    assert respuesta.status_code == 400


def test_un_closer_no_ve_el_gasto(client, auth_headers, make_user):
    closer = make_user(role='closer')

    assert client.get(RESUMEN, headers=auth_headers(closer)).status_code == 403
    assert client.get(LLAMADAS, headers=auth_headers(closer)).status_code == 403


def test_llamadas_filtra_por_usuario(client, db, auth_headers, make_user):
    admin = make_user(role='operator')
    ana = make_user(role='closer')
    _uso(db, ana, '0.001')
    _uso(db, admin, '0.001')

    filas = client.get(f'{LLAMADAS}?user_id={ana.id}', headers=auth_headers(admin)).get_json()

    assert [f['user_id'] for f in filas] == [ana.id]
