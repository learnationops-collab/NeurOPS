"""Los anuncios de Marketing por palabra clave de ManyChat (pedido de Kerwin, 14/10/2026).

"Ya no se va a hacer por ID [...] ahora va a llegar la palabra clave directamente desde ManyChat y ahí
se va a crear el anuncio". Lo que se fija acá:

  1. La palabra clave se normaliza («Guia chile» = «GUÍA CHILE») y una variable vacía de ManyChat no
     es una palabra clave.
  2. El tablero: una persona entra una vez por palabra clave, el día de su primera interacción; la
     calificación es la última que llegó; la interacción sin palabra clave sigue a la conversación.
  3. Agendas y ventas se atribuyen por el Instagram a la última interacción de antes; una por persona;
     sin el marcador «Cualificado»; ventas = completo o split completados; lo cobrado suma también
     cuotas.
  4. El gasto: el de Meta por la palabra clave de cada anuncio de Meta, y el cargado a mano solo los
     días sin Meta. Sin gasto, los costos son None (no 0).
"""
import itertools
from datetime import date, datetime

import pytest

from app.models import (Ad, AdPeriodSpend, Appointment, Client, FinancialSale, LeadAnswer, ManychatLead,
                        MetaAnuncio, MetaGastoDiario)
from app.services import anuncios_service as servicio

_n = itertools.count(1)


def interaccion(db, lead, cuando, keyword=None, calificacion='null', ad=None):
    respuesta = LeadAnswer(lead_id=lead.id, keyword=keyword, qualification=calificacion,
                           ad_id=ad.id if ad else None, created_at=cuando, updated_at=cuando)
    db.session.add(respuesta)
    db.session.commit()
    return respuesta


def conversacion(db, ig=None, nombre='Lead'):
    lead = ManychatLead(manychat_id=f'mc-{next(_n)}', name=nombre, ig=ig)
    db.session.add(lead)
    db.session.commit()
    return lead


def fila(resultado, clave):
    return next(f for f in resultado['filas'] if f['clave'] == clave)


# --- 1. La palabra clave ---------------------------------------------------------------------------

@pytest.mark.parametrize('texto, clave', [
    ('Guia chile', 'GUIA CHILE'),
    ('  GUÍA   Chile ', 'GUIA CHILE'),
    ('Aprobación', 'APROBACION'),
    ('quiero-aplicar!', 'QUIERO APLICAR'),
    ('', None),
    (None, None),
])
def test_la_clave_normaliza_tildes_mayusculas_y_signos(texto, clave):
    assert servicio.clave_de(texto) == clave


@pytest.mark.parametrize('valor', ['', '   ', '{{keyword}}', 'cuf_123', 'null', 'manual_attribution', 'x' * 101, None, 5])
def test_lo_que_no_es_una_palabra_clave(valor):
    assert servicio.es_keyword_valida(valor) is False


# --- 2. Entrantes y calificación -----------------------------------------------------------------

def test_una_persona_entra_una_vez_por_palabra_clave_el_dia_de_su_primera_interaccion(db):
    ana = conversacion(db)
    interaccion(db, ana, datetime(2026, 9, 30, 22), 'APLICAR')  # antes del período
    interaccion(db, ana, datetime(2026, 10, 2, 10), 'APLICAR', 'true')
    beto = conversacion(db)
    interaccion(db, beto, datetime(2026, 10, 3, 9), 'APLICAR')
    interaccion(db, beto, datetime(2026, 10, 3, 9, 5), 'APLICAR')
    interaccion(db, beto, datetime(2026, 10, 4, 9), 'Obtener Guia', 'true')  # volvió por otro anuncio

    resultado = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))

    aplicar = fila(resultado, 'APLICAR')
    assert (aplicar['entrantes'], aplicar['calificados']) == (1, 0)  # Ana entró en septiembre
    guia = fila(resultado, 'OBTENER GUIA')
    assert (guia['entrantes'], guia['calificados'], guia['nombre']) == (1, 1, 'Obtener Guia')
    assert aplicar['dias'] == {'2026-10-03': [1, 0, 0.0, 0]}


def test_la_calificacion_es_la_ultima_que_llego_y_el_resto_son_no_calificados(db):
    for valores in (['true'], ['true', 'false'], ['false', 'true'], ['null'], ['true', 'null']):
        lead = conversacion(db)
        for minuto, valor in enumerate(valores):
            interaccion(db, lead, datetime(2026, 10, 5, 12, minuto), 'EARN', valor)

    f = fila(servicio.tablero(date(2026, 10, 1), date(2026, 10, 31)), 'EARN')

    assert (f['entrantes'], f['calificados'], f['descalificados'], f['no_calificados']) == (5, 3, 1, 2)
    assert (f['pct_calificados'], f['pct_no_calificados']) == (60.0, 40.0)


def test_la_interaccion_sin_palabra_clave_sigue_a_la_conversacion(db):
    lead = conversacion(db)
    interaccion(db, lead, datetime(2026, 10, 5, 12), None)  # el primer webhook no la mandó
    interaccion(db, lead, datetime(2026, 10, 5, 12, 1), 'LECCION')
    interaccion(db, lead, datetime(2026, 10, 5, 12, 2), None, 'true')
    solo = conversacion(db)
    interaccion(db, solo, datetime(2026, 10, 6), None)

    resultado = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))

    assert (fila(resultado, 'LECCION')['entrantes'], fila(resultado, 'LECCION')['calificados']) == (1, 1)
    assert fila(resultado, None)['nombre'] == 'Sin palabra clave'
    assert fila(resultado, None)['entrantes'] == 1


def test_un_anuncio_viejo_sin_palabra_clave_en_la_interaccion_usa_la_del_anuncio(db):
    viejo = Ad(name='M. D. | Leccion', keyword='leccion', status='active')
    db.session.add(viejo)
    db.session.commit()
    lead = conversacion(db)
    interaccion(db, lead, datetime(2026, 10, 5), 'manual_attribution', 'true', ad=viejo)

    f = fila(servicio.tablero(date(2026, 10, 1), date(2026, 10, 31)), 'LECCION')

    assert (f['entrantes'], f['nombre'], f['ad_id']) == (1, 'leccion', viejo.id)


# --- 3. Agendas y ventas ----------------------------------------------------------------------------

def _cliente(db, ig):
    c = Client(full_name=f'Cliente {ig}', email=f'{ig}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    return c


def _agenda(db, cliente, creada, reunion, result='Confirmado'):
    from app.models import User
    closer = User.query.filter_by(role='closer').first()
    a = Appointment(client_id=cliente.id, closer_id=closer.id, created_at=creada, start_time=reunion, result=result)
    db.session.add(a)
    db.session.commit()
    return a


def test_las_agendas_se_atribuyen_por_el_instagram_una_por_persona_y_sin_el_marcador(db, make_user):
    make_user(role='closer', username='Marlon')
    ana = conversacion(db, ig='@Ana.Lopez')
    interaccion(db, ana, datetime(2026, 10, 1), 'APLICAR')
    cliente_ana = _cliente(db, 'ana.lopez')
    _agenda(db, cliente_ana, datetime(2026, 10, 2), datetime(2026, 10, 4))
    _agenda(db, cliente_ana, datetime(2026, 10, 5), datetime(2026, 10, 7))  # reagendó: la misma persona
    _agenda(db, cliente_ana, datetime(2026, 10, 2), datetime(2026, 10, 2), result='Cualificado')  # marcador
    # Llegó por ManyChat DESPUÉS de la reunión: esa agenda no es de ese anuncio.
    beto = conversacion(db, ig='beto')
    interaccion(db, beto, datetime(2026, 10, 20), 'APLICAR')
    _agenda(db, _cliente(db, 'beto'), datetime(2026, 10, 3), datetime(2026, 10, 6))
    _agenda(db, _cliente(db, 'sin_manychat'), datetime(2026, 10, 3), datetime(2026, 10, 6))

    resultado = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))

    assert fila(resultado, 'APLICAR')['agendas'] == 1
    assert resultado['sin_atribuir']['agendas'] == 2


def test_ventas_son_completo_o_split_completados_y_lo_cobrado_suma_todo(db):
    ana = conversacion(db, ig='ana')
    interaccion(db, ana, datetime(2026, 10, 1), 'EARN')
    cliente = _cliente(db, 'ana')
    for tipo, monto, estado in [('RR - Completo', 1000, 'Completada'), ('RR - Parcial', 400, 'Completada'),
                                ('RR - Cuota', 200, 'Completada'), ('RR - Completo', 999, 'Reembolsada')]:
        db.session.add(FinancialSale(client_id=cliente.id, instagram='@ana', tipo_pago=tipo, monto=monto,
                                     estado=estado, date=datetime(2026, 10, 10)))
    db.session.commit()

    f = fila(servicio.tablero(date(2026, 10, 1), date(2026, 10, 31)), 'EARN')

    assert (f['ventas'], f['cobrado']) == (2, 1600.0)


# --- 4. El gasto ---------------------------------------------------------------------------------------

def test_el_gasto_de_meta_va_a_la_palabra_clave_de_su_anuncio_y_el_manual_solo_los_dias_sin_meta(db):
    viejo = Ad(name='APLICAR', keyword='APLICAR', status='active')
    db.session.add(viejo)
    db.session.add_all([
        MetaAnuncio(meta_ad_id='111', nombre='DMV | H2', clave='APLICAR', mapeo='auto', estado='ACTIVE'),
        MetaAnuncio(meta_ad_id='222', nombre='DMV | L2', clave='APLICAR', mapeo='auto', estado='PAUSED'),
        MetaAnuncio(meta_ad_id='333', nombre='LP | Guía', clave=None),
        MetaGastoDiario(meta_ad_id='111', fecha=date(2026, 10, 2), gasto=10.0, moneda='USD'),
        MetaGastoDiario(meta_ad_id='222', fecha=date(2026, 10, 2), gasto=5.5, moneda='USD'),
        MetaGastoDiario(meta_ad_id='333', fecha=date(2026, 10, 2), gasto=7.0, moneda='USD'),
        MetaGastoDiario(meta_ad_id='111', fecha=date(2026, 9, 30), gasto=99.0, moneda='USD'),  # fuera
    ])
    db.session.commit()
    # Cargado a mano del 1 al 3: 3 por día; el 2 ya lo trae Meta.
    db.session.add(AdPeriodSpend(ad_id=viejo.id, start_date=date(2026, 10, 1), end_date=date(2026, 10, 3), spend=9.0))
    lead = conversacion(db)
    interaccion(db, lead, datetime(2026, 10, 2), 'APLICAR', 'true')

    resultado = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))

    f = fila(resultado, 'APLICAR')
    assert f['gasto'] == 21.5
    assert (f['cpl'], f['cpl_calificado'], f['costo_agenda']) == (21.5, 21.5, None)
    assert f['meta'] == {'anuncios': 2, 'activos': 1, 'nombres': ['DMV | H2', 'DMV | L2']}
    assert resultado['sin_atribuir']['gasto_meta'] == 7.0
    assert resultado['moneda'] == 'USD'


def test_sin_gasto_los_costos_son_none_y_no_cero(db):
    lead = conversacion(db)
    interaccion(db, lead, datetime(2026, 10, 2), 'APLICAR', 'true')

    f = fila(servicio.tablero(date(2026, 10, 1), date(2026, 10, 31)), 'APLICAR')

    assert (f['gasto'], f['cpl'], f['costo_venta'], f['roas']) == (0, None, None, None)


def test_los_totales_suman_las_filas(db):
    for keyword in ('A1', 'A1', 'B2'):
        interaccion(db, conversacion(db), datetime(2026, 10, 2), keyword, 'true')

    totales = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))['totales']

    assert (totales['entrantes'], totales['calificados'], totales['pct_calificados']) == (3, 3, 100.0)


def test_archivar_una_palabra_clave_sin_anuncio_lo_crea_archivado(db):
    interaccion(db, conversacion(db), datetime(2026, 10, 2), 'Guia Peru')

    servicio.archivar('GUIA PERU', True)

    assert [(a.keyword, a.status) for a in Ad.query.all()] == [('Guia Peru', 'archived')]
    assert fila(servicio.tablero(date(2026, 10, 1), date(2026, 10, 31)), 'GUIA PERU')['archivado'] is True


def test_el_gasto_viejo_por_conjunto_se_reparte_entre_sus_anuncios(db):
    from app.models import AdSet, Campaign
    campana = Campaign(name='DM Funnel')
    db.session.add(campana)
    db.session.flush()
    conjunto = AdSet(campaign_id=campana.id, name='AD 5 | APLICAR')
    db.session.add(conjunto)
    db.session.flush()
    db.session.add_all([Ad(ad_set_id=conjunto.id, name='APLICAR', keyword='APLICAR'),
                        Ad(ad_set_id=conjunto.id, name='EARN', keyword='EARN'),
                        AdPeriodSpend(ad_set_id=conjunto.id, start_date=date(2026, 7, 22),
                                      end_date=date(2026, 7, 23), spend=8.0)])
    db.session.commit()

    resultado = servicio.tablero(date(2026, 7, 23), date(2026, 7, 31))

    assert (fila(resultado, 'APLICAR')['gasto'], fila(resultado, 'EARN')['gasto']) == (2.0, 2.0)
