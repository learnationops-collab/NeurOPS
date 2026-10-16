"""La grabacion de un taller se guarda sin publicarse (16/10/2026).

Pedido de Kerwin: el link de la grabacion se carga en cada taller para tener el registro de lo
que se hizo (si un taller rinde bien, poder verlo), y publicarlo en institute-site/replay/ es otra
decision. El endpoint publico solo sirve un taller PUBLICADO (Loom + desde + vence). Antes bastaba
el Loom, y la landing lo mostraba con su ciclo semanal generico (lunes a jueves).
"""
from datetime import date, datetime

from app.models import WorkshopEvent

URL = '/api/public/workshop-lead/replay-config'


def taller(db, dia, loom=None, desde=None, vence=None):
    evento = WorkshopEvent(date=dia, name=f'WEBINAR {dia.isoformat()}', replay_loom_id=loom,
                           replay_activo_desde=desde, replay_vence_hasta=vence)
    db.session.add(evento)
    db.session.commit()
    return evento


def test_una_grabacion_guardada_sin_publicar_no_sale_en_la_landing(client, db):
    taller(db, date(2026, 10, 12), loom='solo-guardada')

    assert client.get(URL).get_json() == {}


def test_sale_el_ultimo_publicado_aunque_haya_uno_mas_nuevo_solo_guardado(client, db):
    taller(db, date(2026, 10, 3), loom='publicada', desde=datetime(2026, 10, 6, 12), vence=datetime(2026, 10, 8, 12))
    taller(db, date(2026, 10, 12), loom='solo-guardada')

    datos = client.get(URL).get_json()

    assert datos['loom_id'] == 'publicada'
    assert datos['activo_desde'] == '2026-10-06T12:00:00Z'
    assert datos['vence_hasta'] == '2026-10-08T12:00:00Z'


def test_entre_dos_publicados_manda_el_que_se_publico_ultimo(client, db):
    # Se puede volver a publicar la grabacion de un taller viejo que rindio bien.
    taller(db, date(2026, 9, 12), loom='vieja-republicada', desde=datetime(2026, 10, 14, 12), vence=datetime(2026, 10, 16, 12))
    taller(db, date(2026, 10, 3), loom='anterior', desde=datetime(2026, 10, 6, 12), vence=datetime(2026, 10, 8, 12))

    assert client.get(URL).get_json()['loom_id'] == 'vieja-republicada'


def test_un_publicado_que_ya_vencio_se_sigue_sirviendo_para_que_la_landing_diga_vencido(client, db):
    taller(db, date(2026, 9, 5), loom='vencida', desde=datetime(2026, 9, 8, 12), vence=datetime(2026, 9, 10, 12))

    assert client.get(URL).get_json()['vence_hasta'] == '2026-09-10T12:00:00Z'
