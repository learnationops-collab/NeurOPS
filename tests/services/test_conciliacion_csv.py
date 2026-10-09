"""Leer los CSV de Stripe y Hotmart de la pestaña Diferencias (09/10/2026).

Los dos formatos de la planilla de Kerwin, con datos inventados y la misma forma; los encabezados de
los exports crudos (alias); montos con punto o coma decimal, «%» y celdas vacías; la hora de Stripe
en UTC pasada a UTC−3; y la pasarela reconocida por los encabezados o elegida a mano.
"""
from datetime import datetime

import pytest

from app.services import conciliacion_csv as lector

STRIPE = (
    'Created date (UTC),Amount,Fee,Total,Card Name,Customer Email,Notas\n'
    '2026-09-27 23:10:31,20,1.18,18.82,Ana Prueba,ana@prueba.com,\n'
    '2026-09-25 3:36:46,25,1.4,23.6,beto prueba,BETO@Prueba.com ,\n'
    '2026-09-05 23:41:05,100,4.7,95.3,Caro Prueba,caro@prueba.com,No esta en los reportes \n'
    '2026-10-01 0:25:29,"1,400.50",61.9,1338.6,Dani Prueba,dani@prueba.com,\n'
)

HOTMART = (
    'Fecha de venta,Nombre,Precio de la Oferta,precio bruto,comision,porcentaje de comision,Email\n'
    '29/09/2026 20:29:55,Eva Prueba Alberto,1837.12,2000,162.88,8.87%,eva@prueba.com\n'
    '30/09/2026 19:53:14,Fede Prueba,103.03,132,28.97,28.12%,fede@prueba.com\n'
    '12/09/2026 23:40:35,Gabi Prueba,16.14,,-16.14,-100.00%,gabi@prueba.com\n'
)


def test_stripe_lee_bruto_comision_y_neto_y_pasa_la_hora_de_utc_a_utc_menos_3():
    leido = lector.leer(STRIPE.encode(), 'stripe.csv')

    assert leido['pasarela'] == 'stripe' and leido['detectada'] is True
    primera, segunda, tercera, cuarta = leido['filas']
    assert (primera['bruto'], primera['comision'], primera['neto']) == (20.0, 1.18, 18.82)
    # 23:10 UTC del 27 son las 20:10 del 27 en UTC−3; 3:36 del 25 (sin el cero) son las 0:36.
    assert primera['fecha'] == datetime(2026, 9, 27, 20, 10, 31)
    assert segunda['fecha'] == datetime(2026, 9, 25, 0, 36, 46)
    # El correo queda en minúsculas y sin espacios; la nota a mano, sin el espacio del final.
    assert segunda['email'] == 'beto@prueba.com'
    assert tercera['nota'] == 'No esta en los reportes'
    # El 01/10 a las 00:25 UTC todavía es el 30/09 en UTC−3: entra en septiembre.
    assert cuarta['fecha'] == datetime(2026, 9, 30, 21, 25, 29)
    assert cuarta['bruto'] == 1400.50


def test_hotmart_el_bruto_es_el_precio_bruto_y_el_neto_el_precio_de_la_oferta():
    leido = lector.leer(HOTMART.encode(), 'export.csv')

    assert leido['pasarela'] == 'hotmart'
    eva, fede, gabi = leido['filas']
    assert (eva['bruto'], eva['neto'], eva['comision']) == (2000.0, 1837.12, 162.88)
    assert (fede['bruto'], fede['neto'], fede['comision']) == (132.0, 103.03, 28.97)
    # Día/mes/año, y la hora tal cual (Hotmart ya exporta en UTC−3).
    assert eva['fecha'] == datetime(2026, 9, 29, 20, 29, 55)
    assert eva['bruto_desconocido'] is False


def test_hotmart_sin_precio_bruto_es_un_ingreso_con_el_bruto_igual_al_neto_y_marcado():
    gabi = lector.leer(HOTMART.encode())['filas'][2]

    assert (gabi['bruto'], gabi['neto'], gabi['comision'], gabi['bruto_desconocido']) == (16.14, 16.14, None, True)


@pytest.mark.parametrize('texto,valor', [
    ('1400', 1400.0), ('1400.50', 1400.5), ('1400,50', 1400.5), ('1,400.50', 1400.5), ('1.400,50', 1400.5),
    ('1,400', 1400.0), ('1.400', 1400.0), ('$ 1,400.00', 1400.0), ('US$100', 100.0), ('28.12%', 28.12),
    ('-16.14', -16.14), ('16,1', 16.1), ('', None), ('   ', None), ('n/a', None), (None, None),
])
def test_los_montos_con_punto_o_coma_decimal(texto, valor):
    assert lector.monto(texto) == valor


@pytest.mark.parametrize('texto,en_utc,esperada', [
    ('2026-09-27 23:10:31', False, datetime(2026, 9, 27, 23, 10, 31)),
    ('2026-09-27 23:10:31', True, datetime(2026, 9, 27, 20, 10, 31)),
    ('2026-09-27T23:10:31Z', False, datetime(2026, 9, 27, 20, 10, 31)),
    ('30/09/2026 19:53:14', False, datetime(2026, 9, 30, 19, 53, 14)),
    ('30/09/2026', False, datetime(2026, 9, 30)),
    ('09/30/2026 7:53 pm', False, datetime(2026, 9, 30, 19, 53)),
    ('ayer', False, None), ('', False, None),
])
def test_las_fechas(texto, en_utc, esperada):
    assert lector.fecha(texto, en_utc=en_utc) == esperada


def test_acepta_los_encabezados_de_los_exports_crudos_sin_importar_mayusculas_ni_tildes():
    crudo_stripe = ('id;Created (UTC);Converted Amount;Fee;Customer Email;Card Name;Status\n'
                    'ch_1;2026-09-02 19:53:44;75,00;3,60;kathy@prueba.com;Kathy Prueba;Paid\n'
                    'ch_2;2026-09-03 10:00:00;50,00;2,50;otro@prueba.com;Otro Prueba;Failed\n')
    crudo_hotmart = ('Código de transacción\tNOMBRE DEL COMPRADOR\tEmail del comprador\tFecha de Venta\t'
                     'Valor de compra con impuestos\tMi Comisión\tEstado\n'
                     'HP1\tLuz Prueba\tluz@prueba.com\t07/09/2026 20:20:30\t1.000,00\t770,07\tAprobado\n')

    stripe = lector.leer(crudo_stripe.encode('utf-8'))
    hotmart = lector.leer(crudo_hotmart.encode('cp1252'))

    assert stripe['pasarela'] == 'stripe'
    assert [(f['bruto'], f['comision'], f['neto']) for f in stripe['filas']] == [(75.0, 3.6, 71.4)]
    # El cobro fallido no es ingreso: se omite y se cuenta.
    assert stripe['omitidas'] == [{'fila': 3, 'motivo': 'estado «Failed»'}]
    assert hotmart['pasarela'] == 'hotmart'
    assert [(f['bruto'], f['neto'], f['comision'], f['email']) for f in hotmart['filas']] == [
        (1000.0, 770.07, 229.93, 'luz@prueba.com')]


def test_sin_encabezados_que_la_delaten_la_pasarela_sale_del_nombre_del_archivo_o_se_elige():
    generico = 'Fecha,Monto,Email\n2026-09-02 10:00:00,75,a@prueba.com\n'

    assert lector.leer(generico.encode(), 'cobros_hotmart_septiembre.csv')['pasarela'] == 'hotmart'
    with pytest.raises(lector.CsvInvalido) as error:
        lector.leer(generico.encode(), 'cobros.csv')
    assert error.value.codigo == 'pasarela'
    assert error.value.columnas == ['Fecha', 'Monto', 'Email']
    elegida = lector.leer(generico.encode(), 'cobros.csv', pasarela='stripe')
    assert (elegida['pasarela'], elegida['detectada'], elegida['filas'][0]['bruto']) == ('stripe', False, 75.0)


def test_un_archivo_sin_fecha_o_sin_monto_dice_que_columna_falta():
    with pytest.raises(lector.CsvInvalido, match='la columna de fecha') as error:
        lector.leer('Amount,Customer Email\n10,a@b.com\n'.encode(), pasarela='stripe')
    assert error.value.codigo == 'columnas'
    with pytest.raises(lector.CsvInvalido, match='la columna de monto'):
        lector.leer('Fecha de venta,Email\n01/09/2026,a@b.com\n'.encode(), pasarela='hotmart')
    with pytest.raises(lector.CsvInvalido, match='vacío'):
        lector.leer(b'')


def test_se_omiten_las_filas_sin_fecha_sin_monto_o_negativas_y_las_vacias_no_cuentan():
    texto = ('Created date (UTC),Amount,Fee,Total,Card Name,Customer Email\n'
             ',20,1,19,Sin Fecha,a@b.com\n'
             '2026-09-01 10:00:00,,,,Sin Monto,b@b.com\n'
             '2026-09-01 11:00:00,-20,0,-20,Reembolso,c@b.com\n'
             ',,,,,\n'
             '2026-09-01 12:00:00,20,1,19,Bien,d@b.com\n')

    leido = lector.leer(texto.encode())

    assert [f['nombre'] for f in leido['filas']] == ['Bien']
    assert [o['motivo'] for o in leido['omitidas']] == [
        'sin fecha', 'sin monto', 'monto negativo o cero (reembolso o ajuste)']


def test_la_clave_natural_es_pasarela_fecha_correo_y_bruto():
    filas = lector.leer(STRIPE.encode())['filas']

    assert filas[0]['clave'] == 'stripe|2026-09-27T20:10:31|ana@prueba.com|20.00'
    # El mismo archivo leído de nuevo da las mismas claves: es lo que evita duplicar al resubirlo.
    assert [f['clave'] for f in lector.leer(STRIPE.encode())['filas']] == [f['clave'] for f in filas]
