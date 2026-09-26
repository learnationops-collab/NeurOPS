"""La tabla del contrato: estado del lead -> pestañas y pestaña por defecto de la ficha.

Un caso por fila de la tabla de la especificación (§5) más los bordes que la rompían cuando la
regla vivía en el JS: el lead sin agenda, la agenda vencida sin reportar, la "Reportada · sin
resultado", la venta con deuda y la venta al día. Si alguien cambia la tabla, acá se ve qué
pantalla se movió y para quién.
"""
from datetime import datetime, timedelta

import pytest

from app.models import Appointment, Client
from app.services.estado_lead import PESTANAS, estado_de_agenda, resolver_estado


def clave_y_pestana(**kwargs):
    estado = resolver_estado(**kwargs)
    return estado['clave'], estado['pestana_por_defecto']


# --- La tabla, fila por fila ------------------------------------------------------------------

def test_un_lead_sin_agenda_se_abre_en_confirmacion():
    """Recién llegó de setting o de un workshop: lo único que hay para hacer es contactarlo."""
    assert clave_y_pestana() == ('sin_agenda', 'conf')


def test_una_agenda_futura_sin_confirmar_se_abre_en_confirmacion():
    assert clave_y_pestana(estado_agenda='por_confirmar') == ('por_confirmar', 'conf')


def test_una_agenda_a_medio_confirmar_se_distingue_de_una_sin_tocar():
    """El wizard ya avanzó aunque el lead siga sin confirmar: el estado lo dice, la pestaña no
    cambia."""
    assert clave_y_pestana(estado_agenda='por_confirmar', etapa_confirmacion='horario') \
        == ('confirmando', 'conf')


def test_la_primera_etapa_del_wizard_no_cuenta_como_a_medio_confirmar():
    assert clave_y_pestana(estado_agenda='por_confirmar', etapa_confirmacion='por_contactar') \
        == ('por_confirmar', 'conf')


def test_una_agenda_confirmada_con_la_llamada_por_ocurrir_se_abre_en_confirmacion():
    assert clave_y_pestana(estado_agenda='confirmada') == ('confirmada', 'conf')


def test_una_agenda_vencida_sin_reportar_se_abre_en_resultado():
    """Es el agujero que ensucia el show up: la llamada pasó y nadie dijo qué pasó."""
    assert clave_y_pestana(estado_agenda='sin_reportar') == ('sin_reportar', 'resultado')


def test_reportada_sin_resultado_tambien_se_abre_en_resultado():
    """El closer la sacó del mazo sin dejar resultado (reagendas viejas, cargas históricas): la
    ficha lo dice con su propio nombre en vez de inventarle un resultado."""
    estado = resolver_estado(estado_agenda='reportada_sin_resultado')
    assert estado['clave'] == 'reportada_sin_resultado'
    assert estado['etiqueta'] == 'Reportada · sin resultado'
    assert estado['pestana_por_defecto'] == 'resultado'


def test_una_venta_con_deuda_se_abre_en_acciones():
    assert clave_y_pestana(estado_agenda='show_up', tiene_venta=True, deuda=600.0) \
        == ('venta_con_deuda', 'acciones')


def test_una_venta_al_dia_se_abre_en_historial():
    assert clave_y_pestana(estado_agenda='show_up', tiene_venta=True, deuda=0.0) \
        == ('venta_al_dia', 'hist')


def test_un_lead_descartado_se_abre_en_historial():
    assert clave_y_pestana(estado_agenda='lead_perdido') == ('descartado', 'hist')
    assert clave_y_pestana(estado_agenda='no_lead') == ('descartado', 'hist')


def test_una_baja_despues_de_comprar_se_puede_forzar():
    """Dar de baja a un cliente no deja rastro en `closer_result`: quien arma la ficha lo dice."""
    assert clave_y_pestana(estado_agenda='show_up', tiene_venta=True, deuda=500.0, descartado=True) \
        == ('descartado', 'hist')


# --- Bordes ------------------------------------------------------------------------------------

def test_unos_centavos_de_resto_no_son_una_deuda():
    """Los montos salen de sumas de floats: un resto de centavos no manda a nadie a cobrar."""
    assert clave_y_pestana(estado_agenda='show_up', tiene_venta=True, deuda=0.005) \
        == ('venta_al_dia', 'hist')


def test_una_deuda_sin_venta_registrada_igual_abre_el_cobro():
    """Ventas históricas cargadas solo como Enrollment: hay plata que cobrar aunque el cruce de
    `FinancialSale` no la encuentre."""
    clave, pestana = clave_y_pestana(estado_agenda='show_up', deuda=900.0)
    assert (clave, pestana) == ('venta_con_deuda', 'acciones')


def test_una_llamada_por_ocurrir_gana_al_estado_de_cobro():
    """Un cliente con deuda y una 2ª llamada mañana: el trabajo de hoy es confirmar esa llamada."""
    assert clave_y_pestana(estado_agenda='por_confirmar', tiene_venta=True, deuda=800.0) \
        == ('por_confirmar', 'conf')


def test_una_llamada_reportada_sin_venta_se_abre_en_historial():
    for estado in ('no_show', 'cancelada', 'reagendada', 'segunda_llamada', 'show_up', 'otro'):
        assert clave_y_pestana(estado_agenda=estado) == (estado, 'hist')


def test_un_estado_desconocido_no_rompe_la_ficha():
    estado = resolver_estado(estado_agenda='inventado')
    assert estado['clave'] == 'inventado'
    assert estado['tono'] == 'idle'
    assert estado['pestana_por_defecto'] == 'hist'


# --- Qué pestañas se muestran ------------------------------------------------------------------

def test_sin_agenda_no_hay_pestana_de_resultado_ni_de_cobro():
    assert resolver_estado()['pestanas'] == ['conf', 'hist', 'form', 'com']


def test_sin_venta_no_hay_pestana_de_cobro():
    assert 'acciones' not in resolver_estado(estado_agenda='no_show')['pestanas']


def test_con_deuda_aparece_la_pestana_de_cobro():
    pestanas = resolver_estado(estado_agenda='show_up', tiene_venta=True, deuda=600.0)['pestanas']
    assert pestanas == ['resultado', 'acciones', 'hist', 'form', 'com']


def test_una_llamada_ya_ocurrida_no_muestra_confirmacion():
    """El stepper de precall no tiene nada que ofrecer y el "100% confirmado" sería mentira."""
    assert 'conf' not in resolver_estado(estado_agenda='show_up')['pestanas']


def test_una_llamada_sin_reportar_todavia_muestra_confirmacion():
    """Puede haber quedado a medio confirmar: el closer tiene que poder ver y corregir eso."""
    assert 'conf' in resolver_estado(estado_agenda='sin_reportar')['pestanas']


def test_historial_formulario_y_comunicacion_estan_siempre():
    for estado in (None, 'por_confirmar', 'sin_reportar', 'show_up', 'lead_perdido'):
        pestanas = resolver_estado(estado_agenda=estado)['pestanas']
        assert {'hist', 'form', 'com'} <= set(pestanas)


def test_las_pestanas_salen_siempre_en_el_orden_del_contrato():
    for estado in (None, 'por_confirmar', 'sin_reportar', 'show_up'):
        pestanas = resolver_estado(estado_agenda=estado, tiene_venta=True, deuda=10.0)['pestanas']
        assert pestanas == [p for p in PESTANAS if p in pestanas]


def test_la_pestana_por_defecto_siempre_esta_entre_las_visibles():
    combinaciones = [
        {}, {'estado_agenda': 'por_confirmar'}, {'estado_agenda': 'sin_reportar'},
        {'estado_agenda': 'reportada_sin_resultado'}, {'estado_agenda': 'lead_perdido'},
        {'estado_agenda': 'show_up', 'tiene_venta': True, 'deuda': 600.0},
        {'estado_agenda': 'show_up', 'tiene_venta': True},
        {'estado_agenda': 'inventado'},
    ]
    for kwargs in combinaciones:
        estado = resolver_estado(**kwargs)
        assert estado['pestana_por_defecto'] in estado['pestanas'], kwargs


# --- El puente con el libro de agendas ---------------------------------------------------------

def test_el_estado_de_la_agenda_sale_del_mismo_derivador_que_el_libro(db, make_user):
    """Si la ficha derivara el estado por su cuenta, contradiría a la tabla desde la que se abre."""
    closer = make_user(role='closer')
    cliente = Client(full_name='Ana')
    db.session.add(cliente)
    db.session.commit()
    ahora = datetime(2026, 9, 26, 12, 0)
    futura = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=ahora + timedelta(days=1),
                         result='confirmado', closer_result='Pendiente')
    vencida = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=ahora - timedelta(days=3),
                          closer_result='Pendiente', closer_processed=False)
    reportada = Appointment(closer_id=closer.id, client_id=cliente.id, start_time=ahora - timedelta(days=3),
                            closer_result='Pendiente', closer_processed=True)
    db.session.add_all([futura, vencida, reportada])
    db.session.commit()

    assert estado_de_agenda(futura, ahora) == 'confirmada'
    assert estado_de_agenda(vencida, ahora) == 'sin_reportar'
    assert estado_de_agenda(reportada, ahora) == 'reportada_sin_resultado'
    assert estado_de_agenda(None) is None


@pytest.mark.parametrize('deuda', [None, '', 0])
def test_una_deuda_ausente_no_rompe_el_calculo(deuda):
    assert resolver_estado(estado_agenda='show_up', deuda=deuda)['clave'] == 'show_up'
