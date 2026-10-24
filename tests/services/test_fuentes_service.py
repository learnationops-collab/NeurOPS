"""Marketing por fuente: ROAS New Cash vs ROAS Total, costos y reparto de los cobros (23/10/2026)."""
from datetime import date, datetime
from types import SimpleNamespace

from app.models import FinancialAgenda
from app.services import fuentes_service as fs
from app.services.procedencia_ingresos_service import clasificar_pago


def _cobro(monto, balde=None, por_clave=False, es_venta=False, es_cuota=False, es_upsell=False, cliente='c'):
    return {'monto': monto, 'es_venta': es_venta, 'es_cuota': es_cuota, 'es_upsell': es_upsell, 'cliente': cliente,
            'por_clave': por_clave, 'balde': balde}


# --- ROAS doble y costos ----------------------------------------------------------------------

def test_roas_new_cash_y_total_se_calculan_sobre_el_mismo_gasto():
    m = fs.metricas_de_fuente({'gasto': 1000.0, 'new_cash': 900.0, 'cash_total': 2500.0,
                               'leads': 200, 'agendas': 50, 'show_up': 30, 'ventas': 3})
    assert m['roas_new_cash'] == 0.9
    assert m['roas_total'] == 2.5
    assert m['costo_agenda'] == 20.0
    assert m['costo_venta'] == 333.33
    assert m['cpl'] == 5.0
    assert m['pct_show_up'] == 60.0


def test_sin_gasto_no_hay_roas_ni_costos():
    m = fs.metricas_de_fuente({'gasto': 0.0, 'new_cash': 900.0, 'cash_total': 2500.0,
                               'leads': 10, 'agendas': 5, 'show_up': 2, 'ventas': 1})
    assert m['roas_new_cash'] is None and m['roas_total'] is None
    assert m['cpl'] is None and m['costo_agenda'] is None and m['costo_venta'] is None


def test_division_por_cero_en_los_costos():
    m = fs.metricas_de_fuente({'gasto': 100.0, 'new_cash': 0.0, 'cash_total': 0.0,
                               'leads': 0, 'agendas': 0, 'show_up': 0, 'ventas': 0})
    assert m['cpl'] is None and m['costo_agenda'] is None and m['costo_venta'] is None
    assert m['pct_show_up'] is None
    # Con gasto y sin cobros el ROAS es 0, no «—»: se gastó y no volvió nada.
    assert m['roas_new_cash'] == 0.0 and m['roas_total'] == 0.0


# --- Reparto de los cobros ---------------------------------------------------------------------

def test_new_cash_es_solo_venta_nueva_y_total_suma_cuotas_y_upsells():
    fuentes, otras = fs.sumar_cobros([
        _cobro(900, balde='setting', es_venta=True),
        _cobro(300, balde='setting', es_cuota=True),
        _cobro(200, balde='setting'),                       # upsell de un cliente de Setting
        _cobro(500, balde='workshop', es_venta=True),
        _cobro(100, balde='vsl'),
    ])
    assert {k: fuentes['setting'][k] for k in ('new_cash', 'cash_total', 'ventas', 'cuotas', 'cuotas_monto')} == {
        'new_cash': 900, 'cash_total': 1400, 'ventas': 1, 'cuotas': 1, 'cuotas_monto': 300}
    assert fuentes['workshop']['new_cash'] == 500 and fuentes['workshop']['cash_total'] == 500
    assert otras == {'cash_total': 100, 'cobros': 1}


def test_una_palabra_clave_manda_sobre_el_balde():
    # Llegó por un anuncio de ManyChat aunque la agenda diga workshop: es de Setting.
    fuentes, _ = fs.sumar_cobros([_cobro(400, balde='workshop', por_clave=True, es_venta=True)])
    assert fuentes['setting']['new_cash'] == 400 and fuentes['workshop']['cash_total'] == 0


def test_lo_cobrado_cierra_con_el_total_del_periodo():
    cobros = [_cobro(900, 'setting', es_venta=True), _cobro(-50, 'setting'), _cobro(70, 'sin_procedencia'),
              _cobro(30, 'fulfillment')]
    fuentes, otras = fs.sumar_cobros(cobros)
    total = sum(f['cash_total'] for f in fuentes.values()) + otras['cash_total']
    assert total == sum(c['monto'] for c in cobros)


def test_upsells_por_fuente_y_porcentaje_de_clientes_que_compran():
    fuentes, _ = fs.sumar_cobros([
        _cobro(900, 'setting', es_venta=True, cliente='a'),
        _cobro(300, 'setting', es_cuota=True, cliente='a'),
        _cobro(200, 'setting', es_upsell=True, cliente='a'),
        _cobro(150, 'setting', es_upsell=True, cliente='a'),
        _cobro(500, 'setting', es_venta=True, cliente='b'),
        _cobro(400, 'workshop', es_venta=True, cliente='c'),
    ])
    s = fuentes['setting']
    assert (s['upsells'], s['upsells_monto'], s['clientes'], s['clientes_upsell']) == (2, 350, 2, 1)
    m = fs.metricas_de_fuente({**s, 'gasto': 100.0})
    assert m['pct_upsell'] == 50.0
    assert fuentes['workshop']['upsells'] == 0
    assert fs.metricas_de_fuente({**fuentes['workshop'], 'gasto': 0})['pct_upsell'] == 0.0
    assert fs.metricas_de_fuente({'gasto': 0.0, 'clientes': 0, 'clientes_upsell': 0})['pct_upsell'] is None


# --- Por origen del cliente --------------------------------------------------------------------

def test_clasificar_pago_por_origen_no_manda_el_upsell_a_fulfillment():
    upsell = SimpleNamespace(tipo_pago='Upsell', setter='', id=1)
    agenda = SimpleNamespace(nombre='Elias')
    setters = {'elias': 'Elias'}
    assert clasificar_pago(upsell, agenda, setters)[0] == 'fulfillment'
    assert clasificar_pago(upsell, agenda, setters, por_origen=True)[0] == 'setting'


def test_agenda_con_fuente_workshop_o_setter():
    setters = {'elias': 'Elias'}
    assert fs.fuente_de_agenda('workshop', setters) == 'workshop'
    assert fs.fuente_de_agenda('Workshop Landing', setters) == 'workshop'
    assert fs.fuente_de_agenda('Elias', setters) == 'setting'
    assert fs.fuente_de_agenda('setting', setters) == 'setting'
    assert fs.fuente_de_agenda('vsl', setters) is None
    assert fs.fuente_de_agenda('Entrevista', setters) is None
    assert fs.fuente_de_agenda(None, setters) is None


def test_agendas_por_fuente_una_por_persona_y_show_up(db):
    def agenda(nombre, persona, estado, dia):
        return FinancialAgenda(nombre=nombre, person_uuid=persona, estado=estado,
                               created_at=datetime(2026, 10, dia, 12))

    db.session.add_all([
        agenda('Elias', None, 'No Show', 5),
        agenda('workshop', None, 'Show Up', 5),
        agenda('workshop', None, 'Pendiente', 6),
        agenda('vsl', None, 'Show Up', 6),
        agenda('Elias', None, 'Show Up', 30),  # fuera del período
    ])
    db.session.commit()
    r = fs.agendas_por_fuente(date(2026, 10, 1), date(2026, 10, 15))
    assert (r['setting']['agendas'], r['setting']['show_up']) == (1, 0)
    assert (r['workshop']['agendas'], r['workshop']['show_up']) == (2, 1)
    assert dict(r['workshop']['dias']) == {'2026-10-05': 1, '2026-10-06': 1}
