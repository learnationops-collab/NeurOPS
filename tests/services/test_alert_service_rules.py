"""AlertService: el motor que decide cuándo disparar una alerta (evaluate_rules), cómo arma el mensaje
(`_create_alert_record`) y cómo lo manda a Discord (`_send_to_discord`, con la llamada HTTP simulada:
ver test_alert_service_metrics.py para cómo se calcula el valor de cada métrica).

Todo lo que evalúa reglas corre con el reloj congelado: `evaluate_rules` arma la ventana del período
a partir de "hoy", así que sin `freeze_time` el resultado dependía de la hora a la que alguien
corriera la suite (y once tests se caían todas las noches, después de las 20:00 en UTC-4).
"""
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from freezegun import freeze_time

from app.models import Alert, AlertRule, FinancialSale, Integration
from app.services.alert_service import AlertService

HOY = '2026-09-22 15:00:00'  # 11:00 en America/La_Paz (UTC-4): sin ambiguedad de dia calendario


def regla(db, metric='ventas', condition='>', value=1.0, period='7_days', scope_type='all', scope_value=None,
         notify_discord=False, is_active=True, severity='warning', name='Regla de prueba'):
    r = AlertRule(name=name, metric=metric, condition=condition, value=value, period=period,
                 scope_type=scope_type, scope_value=scope_value, notify_discord=notify_discord,
                 is_active=is_active, severity=severity)
    db.session.add(r)
    db.session.commit()
    return r


def venta_completada(db, monto=100.0, fecha=None):
    v = FinancialSale(monto=monto, estado='Completada', date=fecha or datetime.utcnow())
    db.session.add(v)
    db.session.commit()
    return v


@pytest.fixture()
def sin_discord():
    """Reemplaza _send_to_discord por un mock: para los tests de evaluate_rules que solo quieren ver
    SI se llamo, no lo que hace. Los tests de la propia _send_to_discord (mas abajo) NO la piden: ahi
    corre la real, con requests.post simulado."""
    with patch('app.services.alert_service.AlertService._send_to_discord') as mock:
        yield mock


# --- evaluate_rules: condicion y creacion de la alerta --------------------------------------------

@freeze_time(HOY)
def test_una_regla_desactivada_no_se_evalua(db):
    regla(db, condition='>', value=0.0, is_active=False)
    venta_completada(db)

    assert AlertService.evaluate_rules() == 0
    assert Alert.query.count() == 0


@freeze_time(HOY)
def test_condicion_mayor_dispara_cuando_el_valor_supera_el_limite(db):
    regla(db, metric='ventas', condition='>', value=1.0)
    venta_completada(db)
    venta_completada(db)  # 2 ventas > 1

    assert AlertService.evaluate_rules() == 1
    assert Alert.query.count() == 1


@freeze_time(HOY)
def test_condicion_mayor_no_dispara_si_no_supera_el_limite(db):
    regla(db, metric='ventas', condition='>', value=5.0)
    venta_completada(db)

    assert AlertService.evaluate_rules() == 0
    assert Alert.query.count() == 0


@freeze_time(HOY)
def test_condicion_menor_dispara_cuando_el_valor_cae_por_debajo(db):
    regla(db, metric='ventas', condition='<', value=5.0)
    venta_completada(db)  # 1 venta < 5

    assert AlertService.evaluate_rules() == 1


@freeze_time(HOY)
def test_condicion_menor_no_dispara_si_no_cae_por_debajo(db):
    regla(db, metric='ventas', condition='<', value=1.0)
    venta_completada(db)

    assert AlertService.evaluate_rules() == 0


@freeze_time(HOY)
def test_la_alerta_creada_lleva_los_datos_de_la_regla(db):
    r = regla(db, metric='ventas', condition='>', value=0.0, severity='critical')
    venta_completada(db, monto=100.0)

    AlertService.evaluate_rules()

    alerta = Alert.query.one()
    assert (alerta.rule_id, alerta.metric, alerta.severity, alerta.current_value, alerta.expected_limit) == (
        r.id, 'ventas', 'critical', 1.0, 0.0)
    assert alerta.is_resolved is False


# --- evaluate_rules: no duplicar la misma alerta en 24 horas --------------------------------------

@freeze_time(HOY)
def test_no_crea_una_alerta_duplicada_dentro_de_las_24_horas(db):
    r = regla(db, metric='ventas', condition='>', value=0.0)
    venta_completada(db)
    AlertService.evaluate_rules()
    assert Alert.query.count() == 1

    nuevas = AlertService.evaluate_rules()  # la condicion se sigue cumpliendo

    assert nuevas == 0
    assert Alert.query.count() == 1


@freeze_time(HOY)
def test_una_alerta_de_hace_mas_de_24_horas_no_impide_una_nueva(db):
    r = regla(db, metric='ventas', condition='>', value=0.0)
    venta_completada(db)
    db.session.add(Alert(rule_id=r.id, title='vieja', metric='ventas', severity='warning', current_value=1.0,
                         expected_limit=0.0, is_resolved=False, created_at=datetime.utcnow() - timedelta(hours=25)))
    db.session.commit()

    nuevas = AlertService.evaluate_rules()

    assert nuevas == 1
    assert Alert.query.count() == 2


@freeze_time(HOY)
def test_una_alerta_ya_resuelta_no_impide_una_nueva_aunque_sea_reciente(db):
    r = regla(db, metric='ventas', condition='>', value=0.0)
    venta_completada(db)
    db.session.add(Alert(rule_id=r.id, title='vieja', metric='ventas', severity='warning', current_value=1.0,
                         expected_limit=0.0, is_resolved=True, created_at=datetime.utcnow()))
    db.session.commit()

    assert AlertService.evaluate_rules() == 1


@freeze_time(HOY)
def test_una_alerta_activa_de_otra_regla_no_bloquea_esta(db):
    otra = regla(db, metric='ventas', condition='>', value=999.0, name='Otra regla')
    db.session.add(Alert(rule_id=otra.id, title='de otra regla', metric='ventas', severity='warning',
                         current_value=1.0, expected_limit=999.0, is_resolved=False))
    db.session.commit()
    regla(db, metric='ventas', condition='>', value=0.0, name='Esta regla')
    venta_completada(db)

    assert AlertService.evaluate_rules() == 1


# --- evaluate_rules: notificar a Discord solo cuando corresponde ----------------------------------

@freeze_time(HOY)
def test_notify_discord_true_dispara_el_envio(db, sin_discord):
    regla(db, metric='ventas', condition='>', value=0.0, notify_discord=True)
    venta_completada(db)

    AlertService.evaluate_rules()

    sin_discord.assert_called_once()
    assert sin_discord.call_args[0][0].id == Alert.query.one().id


@freeze_time(HOY)
def test_notify_discord_false_no_envia_nada(db, sin_discord):
    regla(db, metric='ventas', condition='>', value=0.0, notify_discord=False)
    venta_completada(db)

    AlertService.evaluate_rules()

    sin_discord.assert_not_called()


@freeze_time(HOY)
def test_una_alerta_que_no_se_dispara_no_intenta_avisar_a_discord(db, sin_discord):
    regla(db, metric='ventas', condition='>', value=999.0, notify_discord=True)
    venta_completada(db)

    AlertService.evaluate_rules()

    sin_discord.assert_not_called()


# --- evaluate_rules: una regla que revienta no frena a las demas ----------------------------------

@freeze_time(HOY)
def test_una_metrica_desconocida_da_0_sin_romper_la_evaluacion_de_las_demas(db):
    regla(db, metric='metrica-que-no-existe', condition='>', value=1.0, name='Metrica rara')
    regla(db, metric='ventas', condition='>', value=0.0, name='Sana')
    venta_completada(db)

    # La metrica desconocida cae al `return 0.0` por defecto de _calculate_metric_value: 0.0 > 1.0 es
    # falso, no dispara (y sobre todo, no revienta la evaluacion de la regla sana).
    nuevas = AlertService.evaluate_rules()

    assert nuevas == 1
    assert Alert.query.one().metric == 'ventas'


@freeze_time(HOY)
def test_una_excepcion_al_evaluar_una_regla_no_frena_a_las_demas(db):
    regla(db, metric='ventas', condition='>', value=-1.0, name='Va a reventar')
    regla(db, metric='ventas', condition='>', value=0.0, name='Sana')
    venta_completada(db)

    llamadas = []
    real = AlertService._calculate_metric_value

    def espia(metric, start_date, end_date, scope_type, scope_value):
        llamadas.append(1)
        if len(llamadas) == 1:
            raise RuntimeError('boom')
        return real(metric, start_date, end_date, scope_type, scope_value)

    with patch.object(AlertService, '_calculate_metric_value', staticmethod(espia)):
        nuevas = AlertService.evaluate_rules()

    assert nuevas == 1  # la regla sana si genero su alerta
    assert Alert.query.count() == 1


# --- evaluate_rules: vs_previous_week ---------------------------------------------------------

@freeze_time(HOY)
def test_vs_previous_week_compara_el_porcentaje_de_cambio_contra_la_semana_anterior(db):
    regla(db, metric='ventas', condition='>', value=50.0, period='vs_previous_week')
    # Semana anterior (dias 8-14 antes de hoy): 1 venta. Semana actual (7 dias): 3 ventas.
    # Cambio = (3-1)/1 * 100 = 200% > 50% -> dispara.
    for delta in (1, 3, 5):
        venta_completada(db, fecha=datetime.utcnow() - timedelta(days=delta))
    venta_completada(db, fecha=datetime.utcnow() - timedelta(days=10))

    nuevas = AlertService.evaluate_rules()

    assert nuevas == 1
    assert Alert.query.one().current_value == pytest.approx(200.0)


@freeze_time(HOY)
def test_vs_previous_week_sin_ninguna_venta_la_semana_anterior_es_100_por_ciento_si_hay_algo_ahora(db):
    regla(db, metric='ventas', condition='>', value=50.0, period='vs_previous_week')
    venta_completada(db, fecha=datetime.utcnow())

    assert AlertService.evaluate_rules() == 1
    assert Alert.query.one().current_value == 100.0


@freeze_time(HOY)
def test_vs_previous_week_sin_ninguna_venta_en_ninguna_semana_es_cero(db):
    regla(db, metric='ventas', condition='>', value=-1.0, period='vs_previous_week')

    AlertService.evaluate_rules()

    assert Alert.query.one().current_value == 0.0


# --- _create_alert_record: mensajes especiales -----------------------------------------------

def test_titulo_especial_para_cpl_al_alza(db):
    r = regla(db, metric='cpl', condition='>', value=10.0)

    alerta = AlertService._create_alert_record(r, current_value=20.0, percentage_change=None)

    assert alerta.title == "El costo por lead ha subido"


def test_titulo_generico_para_una_combinacion_sin_mensaje_especial(db):
    r = regla(db, metric='cash_collect', condition='<', value=100.0)

    alerta = AlertService._create_alert_record(r, current_value=50.0, percentage_change=None)

    assert alerta.title == "Desviación en Cash Collect"


def test_el_scope_keyword_arma_una_url_con_el_query_param(db):
    r = regla(db, metric='leads', condition='<', value=5.0, scope_type='keyword', scope_value='promo-sep')

    alerta = AlertService._create_alert_record(r, current_value=1.0, percentage_change=None)

    assert alerta.target_url == "/admin/marketing?keyword=promo-sep"
    assert "Palabra clave: promo-sep" in alerta.scope_value


def test_el_scope_all_no_lleva_query_param_en_la_url(db):
    r = regla(db, metric='leads', condition='<', value=5.0, scope_type='all')

    alerta = AlertService._create_alert_record(r, current_value=1.0, percentage_change=None)

    assert alerta.target_url == "/admin/marketing"


def test_la_alerta_queda_guardada_en_la_base(db):
    r = regla(db)

    AlertService._create_alert_record(r, current_value=5.0, percentage_change=12.5)

    guardada = Alert.query.one()
    assert (guardada.rule_id, guardada.percentage_change) == (r.id, 12.5)


# --- _send_to_discord: resolucion del webhook y envio (requests simulado) ------------------------

def _alerta(db, metric='ventas', severity='critical', percentage_change=None):
    r = regla(db, metric=metric, severity=severity)
    a = Alert(rule_id=r.id, title='Prueba', metric=metric, severity=severity, current_value=5.0,
             expected_limit=1.0, percentage_change=percentage_change, target_url='/admin/marketing')
    db.session.add(a)
    db.session.commit()
    return a


def test_sin_ningun_webhook_configurado_no_llama_a_requests(db, monkeypatch):
    monkeypatch.delenv('DISCORD_ALERTS_WEBHOOK', raising=False)
    monkeypatch.delenv('DISCORD_REPORTS_WEBHOOK', raising=False)
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        AlertService._send_to_discord(alerta)

    post.assert_not_called()
    assert alerta.discord_sent is False


def test_usa_la_variable_de_entorno_de_alertas_si_esta_configurada(db, monkeypatch):
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 204
        AlertService._send_to_discord(alerta)

    assert post.call_args[0][0] == 'https://discord.example/alertas'
    assert alerta.discord_sent is True


def test_sin_la_variable_cae_a_la_integracion_discord_alerts_de_la_base(db, monkeypatch):
    monkeypatch.delenv('DISCORD_ALERTS_WEBHOOK', raising=False)
    db.session.add(Integration(key='discord_alerts', url_prod='https://discord.example/prod',
                               url_dev='https://discord.example/dev', active_env='prod'))
    db.session.commit()
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    assert post.call_args[0][0] == 'https://discord.example/prod'


def test_la_integracion_usa_la_url_dev_si_ese_es_el_entorno_activo(db, monkeypatch):
    monkeypatch.delenv('DISCORD_ALERTS_WEBHOOK', raising=False)
    db.session.add(Integration(key='discord_alerts', url_prod='https://discord.example/prod',
                               url_dev='https://discord.example/dev', active_env='dev'))
    db.session.commit()
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    assert post.call_args[0][0] == 'https://discord.example/dev'


def test_sin_alertas_configurado_cae_al_canal_de_reportes_por_variable_de_entorno(db, monkeypatch):
    monkeypatch.delenv('DISCORD_ALERTS_WEBHOOK', raising=False)
    monkeypatch.setenv('DISCORD_REPORTS_WEBHOOK', 'https://discord.example/reportes')
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    assert post.call_args[0][0] == 'https://discord.example/reportes'


def test_ultimo_recurso_la_integracion_discord_reports_de_la_base(db, monkeypatch):
    monkeypatch.delenv('DISCORD_ALERTS_WEBHOOK', raising=False)
    monkeypatch.delenv('DISCORD_REPORTS_WEBHOOK', raising=False)
    db.session.add(Integration(key='discord_reports', payload_config={'webhook_url': 'https://discord.example/ultimo'}))
    db.session.commit()
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    assert post.call_args[0][0] == 'https://discord.example/ultimo'


def test_un_status_de_error_no_marca_discord_sent(db, monkeypatch):
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 500
        post.return_value.text = 'error'
        AlertService._send_to_discord(alerta)

    assert alerta.discord_sent is False


def test_una_excepcion_de_red_no_rompe_el_flujo(db, monkeypatch):
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    alerta = _alerta(db)

    with patch('app.services.alert_service.requests.post', side_effect=ConnectionError('caido')):
        AlertService._send_to_discord(alerta)  # no debe propagar la excepcion

    assert alerta.discord_sent is False


def test_el_payload_lleva_el_color_de_la_severidad_y_el_link_a_la_plataforma(db, monkeypatch):
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    alerta = _alerta(db, severity='critical')

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    payload = post.call_args.kwargs['json']
    assert payload['embeds'][0]['color'] == 15548997  # rojo de 'critical'
    boton = payload['components'][0]['components'][0]
    assert boton['url'] == 'https://work.thelearnation.com/admin/marketing'


def test_una_severidad_desconocida_usa_el_color_por_defecto_sin_reventar(db, monkeypatch):
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    alerta = _alerta(db, severity='rara')

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    assert post.call_args.kwargs['json']['embeds'][0]['color'] == 12370112


def test_el_porcentaje_de_cambio_aparece_en_el_valor_actual_cuando_existe(db, monkeypatch):
    monkeypatch.setenv('DISCORD_ALERTS_WEBHOOK', 'https://discord.example/alertas')
    alerta = _alerta(db, percentage_change=25.3)

    with patch('app.services.alert_service.requests.post') as post:
        post.return_value.status_code = 200
        AlertService._send_to_discord(alerta)

    valor = next(f['value'] for f in post.call_args.kwargs['json']['embeds'][0]['fields'] if f['name'] == 'Valor Actual')
    assert '+25.3%' in valor
