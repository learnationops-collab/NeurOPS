"""El gasto diario de Meta Ads y la palabra clave de cada anuncio de Meta (14/10/2026).

Los textos son los de los creativos reales de la cuenta (vistos con el conector de Meta Ads):
«Comenta QUIERO APLICAR y te ayudo…», «Tocá el botón del video o comentá CURSO GRATUITO…»,
«Respondé APROBACIÓN y te lo envío el DM». La Graph API se simula: ningún test sale a la red.
"""
from datetime import date
from urllib.parse import parse_qs, urlparse

import pytest

from app.models import Ad, MetaAnuncio, MetaGastoDiario
from app.services import meta_ads_service as servicio

CLAVES = {'APLICAR', 'QUIERO APLICAR', 'CURSO GRATUITO', 'APROBACION', 'EARN', 'GUIA', 'GUIA PERU',
          'GUIA STEPS', 'STEP', 'SISTEMA', 'OBTENER GUIA'}


@pytest.mark.parametrize('texto, nombre, conjunto, esperada', [
    # Lo que el anuncio pide escribir, después de «comenta», «respondé»…: la más larga que entra.
    ('Comenta QUIERO APLICAR y te ayudo personalizadamente a subir tu puntaje', 'DMV | H2 | BRD', '', 'QUIERO APLICAR'),
    ('Tocá el botón del video o comentá CURSO GRATUITO y te envío el acceso al DM', '', '', 'CURSO GRATUITO'),
    ('Respondé APROBACIÓN y te lo envío el DM', 'DM-TA-B | A9-A-H | APROBACIÓN', '', 'APROBACION'),
    ('Respondé EARN y te lo envío el DM', '', '', 'EARN'),
    ('Escribí la palabra "GUIA" y te la mando', '', '', 'GUIA'),
    # «APROBACIÓN STEPS» es el título de la guía de otro embudo, no la palabra clave APROBACION: el
    # conjunto dice cuál es («Guía Steps»).
    ('Pide gratis al DM la guía de APROBACIÓN STEPS.', 'LP-TA -PSI-US: Titulo Específico', 'LPF - TA - PSI: Guía Steps',
     'GUIA STEPS'),
    ('Pide gratis al DM la guía de APROBACIÓN médica.', 'LP-TA -PSI-Gral: Crudos', 'LPF - TA - PSI: General [CO + PE + MX]',
     None),
    ('CLASE GRATIS: Cómo estudiar para pasar tu examen de residencia médica.', 'B | PP | A3', 'Broad | Pizarra Problem', None),
    # «guía» en minúsculas es una palabra del texto, no la palabra clave.
    ('Descargá la guía gratis para tu examen', 'LP-TA -PSI-Gral: Crudos', '', None),
    # Una palabra clave de varias palabras se reconoce también en minúsculas.
    ('Comentá guia peru y te la mando', '', '', 'GUIA PERU'),
    # Sin texto, una tira del nombre que ES una palabra clave entera.
    ('', 'B | S | A9 - SISTEMA', '', 'SISTEMA'),
    ('', 'DM-TA-B | A5-A-R | APLICAR  [DS]', '', 'APLICAR'),
    ('', 'LP-TA -PSI-US: Titulo Específico', '', None),
    # «STEPS» no es «STEP»: palabra entera.
    ('', 'TLP - WSF: Guía Steps STEPS', '', 'GUIA STEPS'),
])
def test_detecta_la_palabra_clave_del_anuncio(texto, nombre, conjunto, esperada):
    assert servicio.detectar_clave(texto, nombre, CLAVES, (conjunto,)) == esperada


class _Respuesta:
    def __init__(self, datos, estado=200):
        self._datos, self.status_code = datos, estado

    def json(self):
        return self._datos


@pytest.fixture()
def meta(monkeypatch):
    """Una Graph API falsa: `meta.gastos` es lo que devuelven los insights."""
    monkeypatch.setenv('META_ADS_TOKEN', 'token-de-prueba')
    monkeypatch.setenv('META_AD_ACCOUNT_IDS', 'act_886943269514111')

    class Falsa:
        anuncios = [
            {'id': '111', 'name': 'DMV | H2 | BRD', 'effective_status': 'ACTIVE',
             'campaign': {'id': 'c1', 'name': 'DMV | Test Públicos'}, 'adset': {'id': 's1', 'name': 'DMV | H2 | BRD'},
             'creative': {'id': '9', 'body': 'Comenta QUIERO APLICAR y te ayudo'}},
            {'id': '222', 'name': 'LP-TA -PSI-US: Crudo', 'effective_status': 'PAUSED',
             'campaign': {'name': 'LM Funnel'}, 'adset': {'name': 'Guía Steps'},
             'creative': {'id': '8', 'body': 'Descargá la guía gratis'}},
        ]
        gastos = [
            {'ad_id': '111', 'date_start': '2026-10-12', 'spend': '10.50', 'account_currency': 'USD',
             'campaign_id': 'c1', 'adset_id': 's1', 'impressions': '4200', 'clicks': '90', 'inline_link_clicks': '61'},
            {'ad_id': '111', 'date_start': '2026-10-13', 'spend': '4', 'account_currency': 'USD'},
            {'ad_id': '222', 'date_start': '2026-10-13', 'spend': '7.25', 'account_currency': 'USD'},
        ]
        pedidos = []

    falsa = Falsa()

    def get(url, params=None, timeout=None):
        falsa.pedidos.append((url, params))
        ruta = urlparse(url).path
        if (params or {}).get('ids'):
            # Como Meta: si uno de los ids no existe, falla el pedido entero.
            por_id = {a['id']: a for a in falsa.anuncios}
            ids = params['ids'].split(',')
            if any(i not in por_id for i in ids):
                return _Respuesta({'error': {'message': 'Some of the aliases you requested do not exist', 'code': 100}}, 404)
            return _Respuesta({i: por_id[i] for i in ids})
        if ruta.endswith('/act_886943269514111/insights'):
            # Paginado: la primera página trae un `next`.
            if 'after' in parse_qs(urlparse(url).query):
                return _Respuesta({'data': falsa.gastos[2:]})
            return _Respuesta({'data': falsa.gastos[:2],
                               'paging': {'next': f'{url}?after=abc&access_token=token-de-prueba'}})
        return _Respuesta({'error': {'message': 'no existe', 'code': 100}}, 400)

    monkeypatch.setattr(servicio.requests, 'get', get)
    return falsa


def test_sin_configurar_no_sincroniza(db):
    assert servicio.configurado() is False
    with pytest.raises(servicio.ErrorDeMeta, match='META_ADS_TOKEN'):
        servicio.sincronizar()


def test_sincroniza_anuncios_gasto_por_dia_y_palabra_clave(db, meta):
    db.session.add(Ad(name='QUIERO APLICAR', keyword='QUIERO APLICAR', status='active'))
    db.session.commit()

    resumen = servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    assert resumen == {'desde': '2026-10-12', 'hasta': '2026-10-13', 'anuncios': 2, 'filas_de_gasto': 3,
                       'gasto': 21.75}
    anuncios = {a.meta_ad_id: a for a in MetaAnuncio.query.all()}
    assert (anuncios['111'].clave, anuncios['111'].mapeo, anuncios['111'].campana) == \
        ('QUIERO APLICAR', 'auto', 'DMV | Test Públicos')
    assert (anuncios['222'].clave, anuncios['222'].mapeo, anuncios['222'].estado) == (None, None, 'PAUSED')
    assert sorted((g.meta_ad_id, g.fecha.isoformat(), g.gasto) for g in MetaGastoDiario.query.all()) == [
        ('111', '2026-10-12', 10.5), ('111', '2026-10-13', 4.0), ('222', '2026-10-13', 7.25)]
    # Impresiones y clics de cada día (sin el campo, 0), y los ids de campaña y conjunto.
    dia = MetaGastoDiario.query.filter_by(meta_ad_id='111', fecha=date(2026, 10, 12)).one()
    assert (dia.impresiones, dia.clics, dia.clics_enlace) == (4200, 90, 61)
    assert MetaGastoDiario.query.filter_by(meta_ad_id='222').one().impresiones == 0
    assert (anuncios['111'].campana_id, anuncios['111'].conjunto_id) == ('c1', 's1')
    # La cuenta va sin «act_» duplicado y el token viaja en los parámetros.
    url, params = meta.pedidos[0]
    assert url.endswith('/v24.0/act_886943269514111/insights') and params['access_token'] == 'token-de-prueba'
    # Las fichas de los anuncios que gastaron, juntas en un solo pedido.
    assert [p['ids'] for _, p in meta.pedidos if p and p.get('ids')] == ['111,222']


def test_solo_se_guardan_y_listan_los_anuncios_que_gastaron(db, meta):
    meta.anuncios.append({'id': '333', 'name': 'Sin gasto', 'effective_status': 'PAUSED',
                          'creative': {'id': '7', 'body': 'Comenta APLICAR'}})

    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    assert {a.meta_ad_id for a in MetaAnuncio.query.all()} == {'111', '222'}
    db.session.add(MetaAnuncio(meta_ad_id='444', nombre='Viejo', cuenta_id='886943269514111'))
    db.session.commit()
    assert [f['meta_ad_id'] for f in servicio.listado(date(2026, 10, 12), date(2026, 10, 13))] == ['111', '222']


def test_un_anuncio_borrado_no_tira_las_fichas_de_los_demas(db, meta):
    """Meta rechaza el `?ids=` entero si uno no existe: se parte el grupo y el borrado queda con lo
    que dicen los insights."""
    meta.gastos.append({'ad_id': '999', 'ad_name': 'Borrado | A1', 'campaign_name': 'LM Funnel',
                        'adset_name': 'Guía Steps', 'date_start': '2026-10-13', 'spend': '3',
                        'account_currency': 'USD'})

    resumen = servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    anuncios = {a.meta_ad_id: a for a in MetaAnuncio.query.all()}
    assert resumen['anuncios'] == 3
    assert anuncios['111'].texto == 'Comenta QUIERO APLICAR y te ayudo'
    assert (anuncios['999'].nombre, anuncios['999'].campana, anuncios['999'].texto) == \
        ('Borrado | A1', 'LM Funnel', None)
    assert MetaGastoDiario.query.filter_by(meta_ad_id='999').one().gasto == 3.0


def test_volver_a_sincronizar_pisa_el_gasto_del_dia_no_lo_suma(db, meta):
    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))
    meta.gastos[0] = {**meta.gastos[0], 'spend': '12'}

    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    assert MetaGastoDiario.query.count() == 3
    assert MetaGastoDiario.query.filter_by(meta_ad_id='111', fecha=date(2026, 10, 12)).one().gasto == 12.0


def test_un_dia_que_meta_ya_no_devuelve_no_queda_con_el_valor_viejo_ni_con_el_de_muestra(db, meta):
    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))
    # Un día cargado de muestra (o con un gasto que Meta después corrigió a cero) dentro de la ventana.
    db.session.add(MetaGastoDiario(meta_ad_id='222', fecha=date(2026, 10, 12), gasto=99.0, moneda='USD'))
    db.session.commit()

    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    assert sorted((g.meta_ad_id, g.fecha.isoformat()) for g in MetaGastoDiario.query.all()) == [
        ('111', '2026-10-12'), ('111', '2026-10-13'), ('222', '2026-10-13')]


def test_el_modo_muestra_se_ve_conectado_pero_no_sincroniza(db, monkeypatch):
    monkeypatch.setenv('META_ADS_DEMO', 'true')

    assert servicio.modo_muestra() is True
    with pytest.raises(servicio.ErrorDeMeta, match='muestra'):
        servicio.sincronizar()
    # Con el token cargado, manda lo real.
    monkeypatch.setenv('META_ADS_TOKEN', 'token')
    monkeypatch.setenv('META_AD_ACCOUNT_IDS', '1')
    assert servicio.modo_muestra() is False


def test_la_palabra_clave_elegida_a_mano_no_la_pisa_la_sincronizacion(db, meta):
    db.session.add_all([Ad(name='APLICAR', keyword='APLICAR'), Ad(name='Obtener Guia', keyword='Obtener Guia')])
    db.session.commit()
    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    servicio.asignar_clave('222', 'OBTENER GUIA')
    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    assert MetaAnuncio.query.filter_by(meta_ad_id='222').one().clave == 'OBTENER GUIA'
    with pytest.raises(ValueError):
        servicio.asignar_clave('222', 'NO EXISTE')
    servicio.asignar_clave('222', automatico=True)
    assert (MetaAnuncio.query.filter_by(meta_ad_id='222').one().clave, MetaAnuncio.query.filter_by(
        meta_ad_id='222').one().mapeo) == (None, None)


def test_una_pagina_demasiado_pesada_se_pide_con_menos_filas(db, meta, monkeypatch):
    """La cuenta real (15/10/2026): con una página muy grande Meta responde «Please reduce the amount
    of data you're asking for» (código 1). Se repite la página con la mitad de filas."""
    get_original = servicio.requests.get

    def get(url, params=None, timeout=None):
        if urlparse(url).path.endswith('/insights'):
            meta.pedidos.append((url, params))
            consulta = {k: v[0] for k, v in parse_qs(urlparse(url).query).items()}
            limite = int((params or consulta).get('limit'))
            if limite > 100:
                return _Respuesta({'error': {'message': 'Please reduce the amount of data', 'code': 1}}, 500)
            if 'after' in consulta:
                return _Respuesta({'data': meta.gastos[2:]})
            # El `next` de Meta trae el límite de la primera pedida: también se achica.
            return _Respuesta({'data': meta.gastos[:2],
                               'paging': {'next': f'{url}?after=x&limit=500&access_token=token-de-prueba'}})
        return get_original(url, params=params, timeout=timeout)

    monkeypatch.setattr(servicio.requests, 'get', get)

    resumen = servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    assert (resumen['anuncios'], resumen['filas_de_gasto']) == (2, 3)


def test_si_ni_con_pocas_filas_alcanza_el_error_sale_igual(db, meta, monkeypatch):
    monkeypatch.setattr(servicio.requests, 'get', lambda *a, **k: _Respuesta(
        {'error': {'message': 'Please reduce the amount of data', 'code': 1}}, 500))

    with pytest.raises(servicio.ErrorDeMeta, match='reduce'):
        servicio.sincronizar()


def test_las_campanas_de_workshop_se_marcan_a_mano(db, meta):
    servicio.sincronizar(date(2026, 10, 12), date(2026, 10, 13))

    # Ninguna es de workshop hasta que alguien la marca (no se adivina por el nombre).
    assert servicio.campanas(date(2026, 10, 12), date(2026, 10, 13)) == [
        {'campana_id': 'c1', 'nombre': 'DMV | Test Públicos', 'gasto': 14.5, 'anuncios': 1, 'workshop': False}]
    servicio.marcar_workshop('c1', True)
    servicio.marcar_workshop('c1', True)  # dos veces no la duplica
    assert servicio.campanas_workshop() == {'c1': 'DMV | Test Públicos'}
    # Marcada sigue en la lista aunque no gaste en el período.
    assert servicio.campanas(date(2026, 1, 1), date(2026, 1, 2)) == [
        {'campana_id': 'c1', 'nombre': 'DMV | Test Públicos', 'gasto': 0.0, 'anuncios': 0, 'workshop': True}]
    servicio.marcar_workshop('c1', False)
    assert servicio.campanas_workshop() == {}
    with pytest.raises(LookupError):
        servicio.marcar_workshop('no-existe', True)


def test_un_token_vencido_es_un_error_claro(db, meta, monkeypatch):
    monkeypatch.setattr(servicio.requests, 'get', lambda *a, **k: _Respuesta(
        {'error': {'message': 'Session has expired', 'code': 190}}, 400))

    with pytest.raises(servicio.ErrorDeMeta, match='venció'):
        servicio.sincronizar()
