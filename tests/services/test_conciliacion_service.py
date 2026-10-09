"""La conciliación de Finanzas › Diferencias (09/10/2026): cargas sin duplicar, el emparejamiento de lo
reportado con lo ingresado (los cuatro estados y sus tolerancias), los candidatos, los KPIs y las
diferencias revisadas. Los datos son inventados, con las situaciones que trajo septiembre."""
from datetime import date, datetime

import pytest

from app.models import Client, ConciliacionMovimiento, FinancialSale
from app.services import conciliacion_csv as lector
from app.services import conciliacion_service as conc

SEPTIEMBRE = (date(2026, 9, 1), date(2026, 9, 30))
CABECERA_STRIPE = 'Created date (UTC),Amount,Fee,Total,Card Name,Customer Email,Notas\n'
CABECERA_HOTMART = 'Fecha de venta,Nombre,Precio de la Oferta,precio bruto,comision,porcentaje de comision,Email\n'


def venta(db, monto, fecha, email=None, nombre='Cliente Prueba', metodo='Stripe', estado='Completada', **campos):
    v = FinancialSale(monto=monto, date=fecha, mail_cliente=email, nombre_cliente=nombre, metodo_pago=metodo,
                      estado=estado, tipo_pago='AL - Cuota', **campos)
    db.session.add(v)
    db.session.commit()
    return v


def subir(texto, archivo='stripe.csv', usuario=None):
    return conc.guardar_carga(lector.leer(texto.encode(), archivo), archivo, usuario)


def stripe(*filas):
    """Filas (fecha UTC, bruto, nombre, email[, nota]) en el formato de la planilla de Stripe."""
    lineas = [f'{f},{b},{round(b * 0.045, 2)},{round(b * 0.955, 2)},{n},{e},{nota[0] if nota else ""}'
              for f, b, n, e, *nota in filas]
    return CABECERA_STRIPE + '\n'.join(lineas) + '\n'


def conciliar():
    return conc.conciliar(*SEPTIEMBRE)


def fila_de(resultado, estado, nombre=None):
    filas = [f for f in resultado['filas'] if f['estado'] == estado
             and (nombre is None or nombre in ((f['venta'] or {}).get('nombre') or '')
                  or any(nombre in (m['nombre'] or '') for m in f['movimientos']))]
    assert len(filas) == 1, filas
    return filas[0]


# --- Cargas ---------------------------------------------------------------------------------------

def test_volver_a_subir_el_mismo_archivo_no_duplica_ni_deja_una_carga_vacia(db):
    texto = stripe(('2026-09-10 15:00:00', 100, 'Ana Prueba', 'ana@prueba.com'),
                   ('2026-09-11 15:00:00', 50, 'Beto Prueba', 'beto@prueba.com'))

    primera = subir(texto)
    segunda = subir(texto)
    # Otro export que se pisa con el primero: solo entra lo nuevo.
    tercera = subir(stripe(('2026-09-11 15:00:00', 50, 'Beto Prueba', 'beto@prueba.com'),
                           ('2026-09-12 15:00:00', 75, 'Caro Prueba', 'caro@prueba.com')))

    assert (primera['nuevas'], primera['repetidas']) == (2, 0) and primera['carga']
    assert (segunda['nuevas'], segunda['repetidas'], segunda['carga']) == (0, 2, None)
    assert (tercera['nuevas'], tercera['repetidas']) == (1, 1)
    assert ConciliacionMovimiento.query.count() == 3
    assert [c['nuevas'] for c in conciliar()['cargas']] == [1, 2]


def test_una_fila_repetida_dentro_del_mismo_archivo_entra_una_vez(db):
    fila = ('2026-09-10 15:00:00', 100, 'Ana Prueba', 'ana@prueba.com')

    resumen = subir(stripe(fila, fila))

    assert (resumen['filas'], resumen['nuevas'], resumen['repetidas']) == (2, 1, 1)


def test_borrar_una_carga_se_lleva_sus_cobros(db):
    primera = subir(stripe(('2026-09-10 15:00:00', 100, 'Ana Prueba', 'ana@prueba.com')))
    subir(stripe(('2026-09-12 15:00:00', 75, 'Caro Prueba', 'caro@prueba.com')))

    assert conc.borrar_carga(primera['carga']) is True
    assert conc.borrar_carga(primera['carga']) is False
    assert [m.nombre for m in ConciliacionMovimiento.query.all()] == ['Caro Prueba']


# --- Los cuatro estados ---------------------------------------------------------------------------

def test_los_cuatro_estados(db):
    venta(db, 100, datetime(2026, 9, 9, 14, 0), 'ana@prueba.com', 'Ana Prueba')       # coincide
    venta(db, 207, datetime(2026, 9, 26, 22, 0), 'cami@prueba.com', 'Cami Prueba')    # monto distinto
    venta(db, 300, datetime(2026, 9, 15, 10, 0), 'dani@prueba.com', 'Dani Prueba')    # sin ingreso
    subir(stripe(('2026-09-10 16:41:14', 100, 'Ana Prueba', 'ana@prueba.com'),
                 ('2026-09-27 3:58:16', 200, 'Cami Prueba', 'cami@prueba.com'),
                 ('2026-09-05 23:41:05', 100, 'Eze Prueba', 'eze@prueba.com', 'No esta en los reportes')))

    r = conciliar()

    assert sorted(f['estado'] for f in r['filas']) == ['coincide', 'monto_distinto', 'sin_ingreso', 'sin_reportar']
    distinto = fila_de(r, 'monto_distinto')
    assert (distinto['reportado'], distinto['ingresado'], distinto['diferencia']) == (207.0, 200.0, -7.0)
    sin_reportar = fila_de(r, 'sin_reportar')
    assert sin_reportar['movimientos'][0]['nota'] == 'No esta en los reportes'
    assert sin_reportar['diferencia'] == 100.0
    assert fila_de(r, 'sin_ingreso')['diferencia'] == -300.0


def test_la_fecha_tiene_tres_dias_de_tolerancia_para_cada_lado(db):
    venta(db, 100, datetime(2026, 9, 10, 12, 0), 'ana@prueba.com', 'Ana Prueba')
    venta(db, 150, datetime(2026, 9, 10, 12, 0), 'beto@prueba.com', 'Beto Prueba')
    subir(stripe(('2026-09-13 14:00:00', 100, 'Ana Prueba', 'ana@prueba.com'),      # 2 días y 23 h después
                 ('2026-09-13 16:00:00', 150, 'Beto Prueba', 'beto@prueba.com')))   # 3 días y 1 h

    r = conciliar()

    assert fila_de(r, 'coincide')['venta']['nombre'] == 'Ana Prueba'
    assert fila_de(r, 'sin_ingreso')['venta']['nombre'] == 'Beto Prueba'
    assert fila_de(r, 'sin_reportar')['movimientos'][0]['nombre'] == 'Beto Prueba'


def test_solo_cuentan_las_ventas_completadas_de_stripe_y_hotmart(db):
    venta(db, 100, datetime(2026, 9, 10), 'ana@prueba.com', metodo='Transferencia Bancaria')
    venta(db, 100, datetime(2026, 9, 10), 'ana@prueba.com', estado='Cancelada')
    subir(stripe(('2026-09-10 15:00:00', 100, 'Ana Prueba', 'ana@prueba.com')))

    r = conciliar()

    assert [f['estado'] for f in r['filas']] == ['sin_reportar']
    assert r['kpis']['stripe']['reportado'] == 0


# --- Cómo se reconoce a la persona -----------------------------------------------------------------

def test_por_el_correo_del_cliente_aunque_la_venta_tenga_otro(db):
    cliente = Client(full_name='Wendis Prueba', email='wendis@prueba.com')
    db.session.add(cliente)
    db.session.commit()
    venta(db, 100, datetime(2026, 9, 10, 21, 0), 'otro@prueba.com', 'Webdis Prueba', client_id=cliente.id)
    subir(stripe(('2026-09-12 1:02:15', 100, 'Wendis Prueba', 'wendis@prueba.com')))

    assert [(f['estado'], f['identidad']) for f in conciliar()['filas']] == [('coincide', 'correo')]


def test_por_el_correo_cortado_en_el_sistema(db):
    venta(db, 500, datetime(2026, 9, 24, 12, 58), 'milagros_prueba@', 'Milagros Prueba')
    subir(stripe(('2026-09-24 11:50:28', 500, 'Milagros del Rocio Prueba', 'milagros_prueba@hotmail.com')))

    assert [(f['estado'], f['identidad']) for f in conciliar()['filas']] == [('coincide', 'correo_parcial')]


def test_por_el_nombre_sin_tildes_y_con_una_letra_de_diferencia(db):
    venta(db, 100, datetime(2026, 9, 13, 23, 32), 'sergio1@prueba.com', 'Sergio Carrillo')
    venta(db, 480, datetime(2026, 9, 26), 'juan@prueba.com', 'Kervin Calderón')
    subir(stripe(('2026-09-15 2:00:18', 100, 'Sergio Carrilo Paredes', 'sergio2@prueba.com'),
                 ('2026-09-27 2:29:57', 480.77, 'Kervin Calderon', 'knamir@prueba.com')))

    r = conciliar()

    assert fila_de(r, 'coincide')['identidad'] == 'nombre'
    distinto = fila_de(r, 'monto_distinto')
    assert (distinto['identidad'], distinto['diferencia']) == ('nombre', 0.77)


def test_por_nombre_solo_no_empareja_montos_muy_distintos(db):
    venta(db, 750, datetime(2026, 9, 10), 'maria1@prueba.com', 'Maria Garcia')
    subir(stripe(('2026-09-11 15:00:00', 50, 'Maria Garcia', 'maria2@prueba.com')))

    assert sorted(f['estado'] for f in conciliar()['filas']) == ['sin_ingreso', 'sin_reportar']


def test_por_nombre_con_el_correo_de_otro_cliente_empareja_pero_lo_dice(db):
    """Como Jennifer Guzmán en septiembre: el correo con el que pagó figura en la ficha de otra persona."""
    db.session.add_all([Client(full_name='Areli Otra', email='jguzman@prueba.com'),
                        Client(full_name='Jennifer Guzman Simisterra', email='patry@prueba.com')])
    db.session.commit()
    venta(db, 150, datetime(2026, 9, 10, 18, 11), 'patry@prueba.com', 'Jennifer Guzmán Simisterra')
    subir(stripe(('2026-09-11 21:57:14', 150, 'Jennifer Guzman', 'jguzman@prueba.com')))

    fila = conciliar()['filas'][0]

    assert (fila['estado'], fila['identidad']) == ('coincide', 'nombre_otro_cliente')
    assert fila['movimientos'][0]['cliente_nombre'] == 'Areli Otra'


# --- Pagos partidos, repetidos y de la otra pasarela ----------------------------------------------

def test_un_pago_partido_en_dos_cobros_que_suman_lo_reportado_coincide(db):
    venta(db, 250, datetime(2026, 9, 30, 14, 13), 'belen@prueba.com', 'Belen Prueba')
    subir(stripe(('2026-09-30 17:08:21', 200, 'BELEN PRUEBA', 'belen@prueba.com'),
                 ('2026-09-30 17:12:04', 50, 'BELEN PRUEBA', 'belen@prueba.com')))

    fila = conciliar()['filas'][0]

    assert (fila['estado'], fila['ingresado'], len(fila['movimientos'])) == ('coincide', 250.0, 2)


def test_una_rafaga_de_cobros_que_no_suma_lo_reportado_va_junta_como_monto_distinto(db):
    venta(db, 250, datetime(2026, 9, 21, 21, 17), 'jm@prueba.com', 'Jose Prueba')
    subir(stripe(('2026-09-22 0:31:20', 71.31, 'Monica Prueba', 'jm@prueba.com'),
                 ('2026-09-22 0:35:09', 163.65, 'Monica Prueba', 'jm@prueba.com')))

    fila = conciliar()['filas'][0]

    assert (fila['estado'], fila['ingresado'], fila['diferencia']) == ('monto_distinto', 234.96, -15.04)


def test_una_venta_reportada_dos_veces_deja_la_segunda_sin_ingreso_con_el_cobro_de_candidato(db):
    venta(db, 200, datetime(2026, 9, 7, 20, 39), 'kia@prueba.com', 'Kia Prueba')
    venta(db, 200, datetime(2026, 9, 7, 20, 40), 'kia@prueba.com', 'Kia Prueba')
    subir(stripe(('2026-09-09 2:17:58', 200, 'Kia Prueba', 'kia@prueba.com')))

    r = conciliar()

    assert sorted(f['estado'] for f in r['filas']) == ['coincide', 'sin_ingreso']
    candidato = fila_de(r, 'sin_ingreso')['candidatos'][0]
    assert (candidato['tipo'], candidato['motivo'], candidato['ocupado']) == ('movimiento', 'misma_persona', True)


def test_una_venta_reportada_por_stripe_que_entro_por_hotmart_sugiere_cambiar_el_metodo(db):
    v = venta(db, 250, datetime(2026, 9, 28, 18, 57), 'greta1@prueba.com', 'Greta Castro')
    subir(stripe(('2026-09-10 15:00:00', 100, 'Ana Prueba', 'ana@prueba.com')))
    subir(CABECERA_HOTMART
          + '28/09/2026 21:15:12,Greta Estefania Castro Gallo,228.93,250,21.07,9.20%,greta2@prueba.com\n',
          'hotmart.csv')

    r = conciliar()

    sin_ingreso, sin_reportar = fila_de(r, 'sin_ingreso'), fila_de(r, 'sin_reportar', 'Greta')
    assert sin_ingreso['sugerencia'] == {'venta_id': v.id, 'metodo_pago': 'Hotmart'}
    assert sin_reportar['sugerencia'] == {'venta_id': v.id, 'metodo_pago': 'Hotmart'}
    assert sin_ingreso['candidatos'][0]['motivo'] == 'otra_pasarela'

    # Corregido el método, la venta coincide en Hotmart.
    v.metodo_pago = 'Hotmart'
    db.session.commit()
    assert fila_de(conciliar(), 'coincide', 'Greta')['pasarela'] == 'hotmart'


def test_a_una_fila_sola_se_le_ofrece_lo_del_mismo_monto_que_tambien_quedo_solo(db):
    venta(db, 925, datetime(2026, 9, 7, 18, 17), 'juanita@prueba.com', 'Juanita Prueba')
    subir(stripe(('2026-09-09 0:07:08', 925, 'Pagadora Distinta', 'otra@prueba.com')))

    r = conciliar()

    candidato = fila_de(r, 'sin_ingreso')['candidatos'][0]
    assert (candidato['motivo'], candidato['monto'], candidato['ocupado']) == ('mismo_monto', 925.0, False)


def test_una_pasarela_sin_csv_en_el_periodo_no_se_concilia(db):
    venta(db, 100, datetime(2026, 9, 10), 'ana@prueba.com', metodo='Hotmart')
    venta(db, 50, datetime(2026, 9, 10), 'beto@prueba.com')
    subir(stripe(('2026-09-10 15:00:00', 50, 'Beto', 'beto@prueba.com')))

    r = conciliar()

    assert [f['pasarela'] for f in r['filas']] == ['stripe']
    assert r['pasarelas']['hotmart']['con_csv'] is False
    assert (r['kpis']['hotmart']['reportado'], r['kpis']['hotmart']['ingresado']) == (100.0, None)
    # «Todas» suma solo lo que se pudo conciliar, y dice de qué pasarelas es.
    assert (r['kpis']['todas']['reportado'], r['kpis']['todas']['pasarelas']) == (50.0, ['stripe'])


def test_sin_ningun_csv_lo_reportado_suma_las_dos_y_no_hay_con_que_compararlo(db):
    venta(db, 100, datetime(2026, 9, 10), 'ana@prueba.com', metodo='Hotmart')
    venta(db, 50, datetime(2026, 9, 10), 'beto@prueba.com')

    todas = conciliar()['kpis']['todas']

    assert (todas['reportado'], todas['ventas'], todas['con_csv']) == (150.0, 2, False)
    assert (todas['ingresado'], todas['diferencia'], todas['pendientes']['total']) == (None, None, 0)
    assert conciliar()['filas'] == []


# --- KPIs -----------------------------------------------------------------------------------------

def test_los_kpis_suman_lo_del_periodo_y_la_diferencia_se_explica_por_sus_filas(db):
    venta(db, 100, datetime(2026, 9, 9), 'ana@prueba.com', 'Ana Prueba')
    venta(db, 207, datetime(2026, 9, 26), 'cami@prueba.com', 'Cami Prueba')
    venta(db, 90, datetime(2026, 10, 2), 'fuera@prueba.com', 'De Octubre')
    subir(stripe(('2026-09-10 15:00:00', 100, 'Ana Prueba', 'ana@prueba.com'),
                 ('2026-09-27 3:58:16', 200, 'Cami Prueba', 'cami@prueba.com'),
                 ('2026-09-15 15:00:00', 40, 'Sin Reporte', 'nadie@prueba.com')))

    r = conciliar()
    kpis = r['kpis']['stripe']

    # La venta de octubre ni se ve ni suma.
    assert [f['venta']['nombre'] for f in r['filas'] if f['venta']] == ['Cami Prueba', 'Ana Prueba']
    assert (kpis['reportado'], kpis['ventas'], kpis['ingresado'], kpis['movimientos']) == (307.0, 2, 340.0, 3)
    assert kpis['diferencia'] == 33.0
    assert kpis['diferencia_por'] == {'pendientes': 33.0, 'revisadas': 0.0, 'otro_periodo': 0.0}
    assert kpis['pendientes'] == {'monto_distinto': 1, 'sin_reportar': 1, 'sin_ingreso': 0, 'total': 2}
    assert kpis['coinciden'] == 1
    # La comisión real del CSV y la que Finanzas estima (4,5 % de Stripe sobre lo reportado).
    assert kpis['comision'] == pytest.approx(15.3)
    assert kpis['comision_estimada'] == pytest.approx(13.815, abs=0.006)
    assert r['kpis']['todas']['diferencia'] == 33.0


def test_una_pareja_entre_dos_periodos_explica_su_parte_de_la_diferencia(db):
    # Reportada el 31/08 y cobrada el 01/09 (09:00 en UTC−3): coincide, pero cada mitad en su mes.
    venta(db, 250, datetime(2026, 8, 31, 18, 0), 'alberto@prueba.com', 'Alberto Prueba')
    subir(stripe(('2026-09-01 12:00:00', 250, 'Alberto Prueba', 'alberto@prueba.com')))

    r = conciliar()
    fila, kpis = r['filas'][0], r['kpis']['todas']

    assert (fila['estado'], fila['venta']['en_periodo'], fila['aporte']) == ('coincide', False, 250.0)
    assert (kpis['reportado'], kpis['ingresado'], kpis['diferencia']) == (0.0, 250.0, 250.0)
    assert kpis['diferencia_por'] == {'pendientes': 0.0, 'revisadas': 0.0, 'otro_periodo': 250.0}


def test_todas_suma_las_transferencias_a_lo_reportado_y_a_lo_ingresado(db):
    """Pedido del 09/10/2026: «falta contar lo que ingresó por transferencia para que las cuentas
    cuadren». No vienen en ningún CSV ni se concilian: lo reportado es lo que entró, así que suman
    a los dos lados (bruto y neto, sin comisión) y la diferencia no cambia. Las pasarelas sueltas no
    las llevan, ni una transferencia cancelada o de otro mes."""
    venta(db, 100, datetime(2026, 9, 9), 'ana@prueba.com', 'Ana Prueba')
    venta(db, 150, datetime(2026, 9, 9), nombre='Israel Prueba', metodo='Transferencia Bancaria',
          transferido_a='jean_carlo')
    venta(db, 80, datetime(2026, 9, 20), nombre='Sin Marcar', metodo='Transferencia')
    venta(db, 500, datetime(2026, 9, 20), nombre='Cancelada', metodo='Transferencia', estado='Cancelada')
    venta(db, 70, datetime(2026, 10, 2), nombre='De Octubre', metodo='Transferencia')
    subir(stripe(('2026-09-10 15:00:00', 90, 'Ana Prueba', 'ana@prueba.com')))

    kpis = conciliar()['kpis']
    todas, stripe_ = kpis['todas'], kpis['stripe']

    assert todas['transferencias'] == {'total': 230.0, 'ventas': 2}
    assert (todas['reportado'], todas['ventas']) == (330.0, 3)
    assert (todas['ingresado'], todas['neto']) == (320.0, pytest.approx(85.95 + 230.0))
    assert todas['comision'] == pytest.approx(4.05)
    assert todas['diferencia'] == stripe_['diferencia'] == -10.0
    assert (stripe_['reportado'], stripe_['ingresado']) == (100.0, 90.0)
    assert 'transferencias' not in stripe_


def test_sin_ningun_csv_las_transferencias_suman_a_lo_reportado(db):
    venta(db, 100, datetime(2026, 9, 10), 'ana@prueba.com', metodo='Hotmart')
    venta(db, 150, datetime(2026, 9, 10), nombre='Israel Prueba', metodo='Transferencia Bancaria')

    todas = conciliar()['kpis']['todas']

    assert (todas['reportado'], todas['ventas'], todas['transferencias']['total']) == (250.0, 2, 150.0)
    assert (todas['ingresado'], todas['neto'], todas['diferencia']) == (None, None, None)


# --- Revisadas ------------------------------------------------------------------------------------

def test_marcar_revisada_saca_la_fila_de_pendientes_y_queda_quien_y_cuando(db, make_user):
    kerwin = make_user(role='admin', username='kerwin')
    venta(db, 480, datetime(2026, 9, 26), 'k@prueba.com', 'Kervin Prueba')
    subir(stripe(('2026-09-27 2:29:57', 480.77, 'Kervin Prueba', 'k@prueba.com')))
    fila = conciliar()['filas'][0]

    conc.marcar_revisada(fila['clave'], kerwin, estado=fila['estado'], nota='redondeo')
    r = conciliar()

    revisada = r['filas'][0]['revisada']
    assert (revisada['por'], revisada['nota']) == ('kerwin', 'redondeo')
    assert r['kpis']['todas']['pendientes']['total'] == 0
    assert r['kpis']['todas']['revisadas'] == 1
    assert r['kpis']['todas']['diferencia_por'] == {'pendientes': 0.0, 'revisadas': 0.77, 'otro_periodo': 0.0}

    conc.marcar_revisada(fila['clave'], kerwin, revisada=False)
    assert conciliar()['filas'][0]['revisada'] is None


def test_si_cambia_la_fila_la_revision_ya_no_aplica(db, make_user):
    kerwin = make_user(role='admin')
    v = venta(db, 207, datetime(2026, 9, 26), 'cami@prueba.com', 'Cami Prueba')
    subir(stripe(('2026-09-27 3:58:16', 200, 'Cami Prueba', 'cami@prueba.com')))
    conc.marcar_revisada(conciliar()['filas'][0]['clave'], kerwin)
    # Otro cobro de la misma persona en la ráfaga cambia la fila: vuelve a pendientes.
    subir(stripe(('2026-09-27 4:10:00', 5, 'Cami Prueba', 'cami@prueba.com')))

    fila = conciliar()['filas'][0]

    assert (fila['venta']['id'], fila['estado'], fila['revisada']) == (v.id, 'monto_distinto', None)


def test_una_revision_sobrevive_a_borrar_la_carga_y_volver_a_subirla(db, make_user):
    kerwin = make_user(role='admin')
    texto = stripe(('2026-09-05 23:41:05', 100, 'Eze Prueba', 'eze@prueba.com'))
    carga = subir(texto)['carga']
    conc.marcar_revisada(conciliar()['filas'][0]['clave'], kerwin)

    conc.borrar_carga(carga)
    subir(texto)

    assert conciliar()['filas'][0]['revisada'] is not None


@pytest.mark.parametrize('clave', ['', 'x1', 'v12+v13', "v1'; drop table", 'm123'])
def test_una_clave_que_no_es_de_una_fila_no_se_marca(db, clave):
    with pytest.raises(ValueError):
        conc.marcar_revisada(clave, None)
