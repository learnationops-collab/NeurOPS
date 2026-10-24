"""Workshop › Correlaciones: la estadística pura y el endpoint de solo lectura."""
from datetime import date

import pytest

from app.models import WorkshopEvent
from app.services import workshop_correlaciones_service as svc


# --- Estadística pura ---

def test_pearson_recta_perfecta_y_negativa():
    assert svc.pearson([1, 2, 3, 4], [2, 4, 6, 8]) == pytest.approx(1.0)
    assert svc.pearson([1, 2, 3, 4], [8, 6, 4, 2]) == pytest.approx(-1.0)


@pytest.mark.parametrize('xs,ys', [([], []), ([1], [2]), ([1, 2], [3, 4])])
def test_con_menos_de_tres_puntos_no_se_calcula(xs, ys):
    assert svc.pearson(xs, ys) is None
    assert svc.spearman(xs, ys) is None


def test_datos_constantes_no_dan_correlacion():
    assert svc.pearson([5, 5, 5, 5], [1, 2, 3, 4]) is None
    assert svc.spearman([1, 2, 3, 4], [7, 7, 7, 7]) is None


def test_spearman_captura_lo_monotono_no_lineal():
    xs, ys = [1, 2, 3, 4, 5], [1, 4, 9, 16, 100]
    assert svc.spearman(xs, ys) == pytest.approx(1.0)
    assert svc.pearson(xs, ys) < 0.99


def test_rangos_con_empates_usan_el_promedio():
    assert svc._rangos([10, 20, 20, 30]) == [1.0, 2.5, 2.5, 4.0]


def test_p_aproximado_requiere_mas_de_tres_y_baja_con_n():
    assert svc.p_aproximado(0.9, 3) is None
    assert svc.p_aproximado(0.9, 20) < svc.p_aproximado(0.9, 6)


def test_par_ignora_talleres_sin_el_dato_y_cuenta_n():
    celda = svc._par([1, 2, None, 4, 5], [2, 4, 6, None, 10])
    assert celda['n'] == 3
    assert celda['pearson'] == pytest.approx(1.0)
    assert celda['confianza'] == 'insuficiente'  # n=3: sin p aproximado


def test_par_marca_constante_y_confianza_baja_con_n_chico():
    assert svc._par([3, 3, 3, 3], [1, 2, 3, 4])['constante'] is True
    chico = svc._par([1, 2, 3, 4, 5], [2, 1, 4, 3, 5])
    assert chico['n'] == 5 and chico['confianza'] == 'baja'


def test_ranking_ordena_por_fuerza_y_manda_al_final_los_sin_calculo():
    matriz = {'obj': {'obj': {}, 'a': {'pearson': 0.2}, 'b': {'pearson': -0.9}, 'c': {'pearson': None}}}
    assert [f['key'] for f in svc.ranking(matriz, 'obj')] == ['b', 'a', 'c']


# --- Endpoint ---

@pytest.fixture()
def marketing(make_user, auth_headers):
    return auth_headers(make_user(role='director_marketing'))


def _cargar(db, *filas):
    """Crea los talleres y recién después fija las métricas automáticas: el sync en vivo las recalcula
    al crear otro taller (también el anterior), y un UPDATE masivo no lo dispara."""
    base = dict(leads=100, wa=50, show=20, aplic=10, agendas=8, citas=6, ventas=2, cash=1000.0, gasto=500.0)
    completas = [{**base, **f} for f in filas]
    eventos = []
    for f in completas:
        ev = WorkshopEvent(date=f['dia'], name=f"T{f['dia']}", inversion=f['gasto'], leads=f['leads'],
                           whatsapp_leads=f['wa'], show_up=f['show'], pitch_leads=f['show'],
                           pitch_final_leads=f['show'])
        db.session.add(ev)
        db.session.commit()
        eventos.append(ev)
    for ev, f in zip(eventos, completas):
        WorkshopEvent.query.filter_by(id=ev.id).update({
            'aplicaciones_form': f['aplic'], 'agendas_exitosas': f['agendas'],
            'show_up_sales_call': f['citas'], 'sales': f['ventas'], 'cash_collected': f['cash']})
    db.session.commit()


def _semanal(i):
    return date(2026, 8, 3 + 7 * i)


def test_sin_talleres_responde_vacio_con_aviso(client, db, marketing):
    data = client.get('/api/workshop/correlaciones', headers=marketing).get_json()
    assert data['n_talleres'] == 0 and data['ranking'] == []
    assert any('no se puede calcular' in a for a in data['avisos'])


def test_dos_talleres_no_calculan_nada(client, db, marketing):
    _cargar(db, {'dia': date(2026, 9, 1)}, {'dia': date(2026, 9, 8), 'show': 30, 'cash': 2000.0})
    data = client.get('/api/workshop/correlaciones', headers=marketing).get_json()
    assert data['n_talleres'] == 2
    celda = data['matriz']['show_up']['cash_collected']
    assert celda['n'] == 2 and celda['pearson'] is None


def test_correlaciona_show_up_con_cash_y_excluye_programados(client, db, marketing):
    reales = [(10, 500.0), (20, 1000.0), (30, 1500.0), (40, 2100.0), (50, 2400.0)]
    _cargar(db, *[{'dia': _semanal(i), 'show': s, 'wa': 100, 'cash': c} for i, (s, c) in enumerate(reales)],
            {'dia': date(2999, 1, 1), 'show': 0, 'wa': 0, 'leads': 0, 'aplic': 0})  # programado: no entra
    data = client.get('/api/workshop/correlaciones', headers=marketing).get_json()
    assert data['n_talleres'] == 5
    celda = data['matriz']['show_up_workshop']['cash_collected']
    assert celda['n'] == 5 and celda['pearson'] > 0.95
    assert celda['confianza'] == 'baja'  # n<8 siempre advierte
    assert data['ranking'][0]['pearson'] is not None
    assert all(r['key'] != 'cash_collected' for r in data['ranking'])


def test_metrica_constante_queda_sin_correlacion(client, db, marketing):
    _cargar(db, *[{'dia': _semanal(i), 'show': 10 + i, 'cash': 100.0} for i in range(4)])  # cash idéntico
    celda = client.get('/api/workshop/correlaciones', headers=marketing).get_json()['matriz']['show_up']['cash_collected']
    assert celda['pearson'] is None and celda['constante'] is True


def test_sin_base_el_porcentaje_es_none_no_cero(client, db, marketing):
    _cargar(db, *[{'dia': _semanal(i), 'citas': 0, 'ventas': 0} for i in range(3)])  # close rate sin base
    taller = client.get('/api/workshop/correlaciones', headers=marketing).get_json()['talleres'][0]
    assert taller['valores']['close_rate'] is None


def test_filtros_y_objetivo_invalido(client, db, marketing):
    _cargar(db, *[{'dia': _semanal(i), 'show': 10 + i} for i in range(4)])
    base = '/api/workshop/correlaciones'
    assert client.get(base + '?desde=2026-08-10', headers=marketing).get_json()['n_talleres'] == 3
    assert client.get(base + '?ultimos=2', headers=marketing).get_json()['n_talleres'] == 2
    assert client.get(base + '?desde=basura', headers=marketing).get_json()['n_talleres'] == 4
    assert client.get(base + '?objetivo=nada', headers=marketing).get_json()['objetivo'] == 'cash_collected'


def test_exige_permiso(client, db, make_user, auth_headers):
    assert client.get('/api/workshop/correlaciones').status_code in (401, 403)
    closer = auth_headers(make_user(role='closer'))
    assert client.get('/api/workshop/correlaciones', headers=closer).status_code == 403


def test_marca_las_parejas_que_se_parecen_por_construccion(client, db, marketing):
    ligadas = client.get('/api/workshop/correlaciones', headers=marketing).get_json()['ligadas']
    assert ['cash_collected', 'roas'] in ligadas
    assert ['cash_collected', 'ventas'] in ligadas
    assert ['inversion', 'roas'] in ligadas
