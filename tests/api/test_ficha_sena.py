"""La ficha no llama venta a una seña (pedido del 30/09/2026, misma regla que el close rate).

Venta es un pago completo o un split pay (`REAL_SALE_TIPOS`). El dashboard comercial ya mostraba
«Seña» en la agenda de quien solo reservó; la ficha del mismo lead seguía diciendo «Venta» en el
resultado, «Venta cerrada» en el stepper y «Venta · con deuda» en la cabecera.
"""
from datetime import date, datetime, timedelta

import pytest

from app.models import Appointment, Client, Enrollment, FinancialSale, Payment, Program

URL = '/api/ficha/lead'


@pytest.fixture()
def equipo(make_user):
    return {
        'director': make_user(role='director_comercial', username='direccion', email='dir@neuro.com'),
        'closer': make_user(role='closer', username='vendedor', email='vendedor@neuro.com'),
    }


def _pago(db, tipo, monto, fecha=datetime(2026, 9, 1), mail='sofi@x.com'):
    db.session.add(FinancialSale(mail_cliente=mail, nombre_cliente='Sofi Rey', tipo_pago=tipo,
                                 monto=monto, estado='Completada', date=fecha,
                                 email_vendedor='vendedor@neuro.com'))
    db.session.commit()


@pytest.fixture()
def reservo(db, equipo):
    """Asistió y dejó una seña de $100 sobre $1.000: debe $900 y todavía no compró."""
    programa = Program(name='Residency Roadmap', price=1000.0)
    cliente = Client(full_name='Sofi Rey', email='sofi@x.com', total_amount=1000.0)
    db.session.add_all([programa, cliente])
    db.session.commit()
    inscripcion = Enrollment(client_id=cliente.id, program_id=programa.id,
                             closer_id=equipo['closer'].id, enrollment_date=date(2026, 9, 1))
    db.session.add(inscripcion)
    db.session.commit()
    db.session.add_all([
        Payment(enrollment_id=inscripcion.id, amount=100.0, date=date(2026, 9, 1),
                payment_type='deposit', status='completed'),
        Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                    start_time=datetime.utcnow() - timedelta(days=5), closer_result='Show up',
                    closer_processed=True, seguimiento_realizado=True),
    ])
    db.session.commit()
    _pago(db, 'RR - Seña', 100.0)
    return cliente


def _ficha(client, auth_headers, usuario, cliente):
    r = client.get(f'{URL}?client_id={cliente.id}', headers=auth_headers(usuario))
    assert r.status_code == 200
    return r.get_json()


def _hitos(ficha):
    return {h['clave']: h for h in ficha['resultado']['hitos']}


def test_quien_solo_dejo_sena_no_tiene_una_venta_en_la_ficha(client, db, reservo, equipo,
                                                              auth_headers):
    ficha = _ficha(client, auth_headers, equipo['director'], reservo)

    assert ficha['resultado']['post_call']['key'] == 'sena'
    assert ficha['resultado']['post_call']['label'] == 'Seña'
    hitos = _hitos(ficha)
    # Asistió: el hito de resultado está hecho, con el nombre de lo que pasó.
    assert (hitos['resultado']['sub'], hitos['resultado']['estado']) == ('Seña', 'hecho')
    assert (hitos['cierre']['sub'], hitos['cierre']['estado']) == ('Seña · falta completar', 'actual')
    # Debe el resto de la seña: eso sí es deuda.
    assert (hitos['deuda']['sub'], hitos['deuda']['estado']) == ('Con deuda', 'alerta')


def test_la_cabecera_dice_sena_y_abre_donde_se_cobra_el_resto(client, db, reservo, equipo,
                                                              auth_headers):
    estado = _ficha(client, auth_headers, equipo['director'], reservo)['estado']

    assert (estado['clave'], estado['etiqueta']) == ('sena', 'Seña · falta completar')
    assert estado['pestana_por_defecto'] == 'acciones'
    # Sigue siendo alguien a quien cobrarle y que puede tener acceso con seña a la Academia.
    assert {'acciones', 'ful'} <= set(estado['pestanas'])


def test_cuando_completa_el_pago_es_una_venta(client, db, reservo, equipo, auth_headers):
    _pago(db, 'RR - Parcial', 400.0, fecha=datetime(2026, 9, 10))

    ficha = _ficha(client, auth_headers, equipo['director'], reservo)

    assert ficha['resultado']['post_call']['key'] == 'venta'
    assert _hitos(ficha)['cierre']['sub'] == 'Venta cerrada'
    assert ficha['estado']['clave'] == 'venta_con_deuda'


def test_una_sena_anulada_no_cuenta_para_nada(client, db, reservo, equipo, auth_headers):
    FinancialSale.query.update({'estado': 'Anulada'})
    db.session.commit()

    ficha = _ficha(client, auth_headers, equipo['director'], reservo)

    # Asistió, sin pagos vigentes y sin nada programado: se muestra «Seguimiento» (antes «Presentó,
    # no cerró», 09/10/2026), pero el cierre de esa llamada sigue siendo «No cerró».
    assert ficha['resultado']['post_call']['key'] == 'seguimiento'
    hitos = _hitos(ficha)
    assert (hitos['resultado']['sub'], hitos['resultado']['estado']) == ('Seguimiento', 'hecho')
    assert (hitos['cierre']['sub'], hitos['cierre']['estado']) == ('No cerró', 'alerta')


def test_con_un_seguimiento_abierto_el_cierre_sigue_pendiente(client, db, reservo, equipo,
                                                               auth_headers):
    # El mismo «Seguimiento» en el post call, pero con algo programado la venta está en curso: el
    # cierre no es «No cerró».
    FinancialSale.query.update({'estado': 'Anulada'})
    Appointment.query.update({'seguimiento_realizado': False, 'seguimiento_tipo': 'llamada'})
    db.session.commit()

    ficha = _ficha(client, auth_headers, equipo['director'], reservo)

    assert ficha['resultado']['post_call']['key'] == 'seguimiento'
    hitos = _hitos(ficha)
    assert (hitos['cierre']['sub'], hitos['cierre']['estado']) == ('Pendiente', 'actual')


def test_una_sena_sin_total_cargado_no_figura_saldada(client, db, equipo, auth_headers):
    # Sin inscripción ni total no hay deuda calculada: eso no es «Sin deuda» en verde.
    cliente = Client(full_name='Sofi Rey', email='sofi@x.com')
    db.session.add(cliente)
    db.session.commit()
    db.session.add(Appointment(closer_id=equipo['closer'].id, client_id=cliente.id,
                               start_time=datetime.utcnow() - timedelta(days=5),
                               closer_result='Show up', closer_processed=True,
                               seguimiento_realizado=True))
    db.session.commit()
    _pago(db, 'RR - Seña', 100.0)

    hitos = _hitos(_ficha(client, auth_headers, equipo['director'], cliente))

    assert (hitos['deuda']['sub'], hitos['deuda']['estado']) == ('Falta completar', 'pendiente')
