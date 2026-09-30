"""Las filas de Clientes y Ventas traen la foto de la Academia de su cliente.

Es lo que deja filtrar y ordenar esas tablas por lo que el alumno hace en la Academia. Se fija que
cada fila lleve la foto de SU cliente (tambien la venta sin `client_id`, que se cruza por contacto),
que se lea en una consulta y no en una por fila, y que el alcance de un closer no cambie: sus filas,
con sus fotos, y ninguna de otro.
"""
from datetime import date, datetime

import pytest
from sqlalchemy import event

from app.models import AcademySnapshot, Appointment, Client, FinancialSale, User
from app.services.comercial_service import ComercialService

DESDE, HASTA = date(2026, 9, 1), date(2026, 9, 30)
AHORA = datetime.utcnow()


@pytest.fixture()
def vendedores(make_user):
    return (make_user(role='closer', username='Marlon', email='marlon@neuro.com'),
            make_user(role='closer', username='Nerina', email='nerina@neuro.com'))


def comprador(db, closer, email, *, foto=None, con_id=True):
    cliente = Client(full_name=email.split('@')[0].title(), email=email)
    db.session.add(cliente)
    db.session.commit()
    db.session.add(FinancialSale(client_id=cliente.id if con_id else None, mail_cliente=email,
                                 tipo_pago='RR - Completo', monto=100.0, estado='Completada',
                                 date=datetime(2026, 9, 10), email_vendedor=closer.email))
    db.session.add(Appointment(closer_id=closer.id, client_id=cliente.id,
                               start_time=datetime(2026, 9, 9, 15, 0), closer_result='Show up',
                               closer_processed=True))
    if foto:
        db.session.add(AcademySnapshot(client_id=cliente.id, **foto))
    db.session.commit()
    return cliente


ACTIVO = {'resultado': 'vinculado', 'learnation_user_id': 87, 'horas_estudio': 12.0, 'ejecuciones': 67,
          'racha_dias': 3, 'synced_at': AHORA, 'intentado_at': AHORA, 'actividad_vista_at': AHORA}


def test_la_fila_del_cliente_lleva_su_foto(db, vendedores):
    marlon, _ = vendedores
    con_foto = comprador(db, marlon, 'ana@x.com', foto=ACTIVO)
    sin_foto = comprador(db, marlon, 'beto@x.com')

    filas = {f['client_id']: f for f in ComercialService.clientes()}

    assert filas[con_foto.id]['academia']['estado']['key'] == 'activo'
    assert (filas[con_foto.id]['academia']['horas'], filas[con_foto.id]['academia']['ejecuciones']) == (12, 67)
    assert filas[sin_foto.id]['academia']['estado']['key'] == 'sin_datos'


def test_la_venta_sin_client_id_lleva_la_foto_del_cliente_con_el_que_se_cruza(db, vendedores):
    marlon, _ = vendedores
    comprador(db, marlon, 'ana@x.com', foto=ACTIVO, con_id=False)
    db.session.add(FinancialSale(mail_cliente='nadie@x.com', tipo_pago='RR - Completo', monto=50.0,
                                 estado='Completada', date=datetime(2026, 9, 11),
                                 email_vendedor=marlon.email))
    db.session.commit()

    filas = {f['email']: f for f in ComercialService.ventas(DESDE, HASTA)}

    assert filas['ana@x.com']['academia']['racha'] == 3
    # Sin cliente no hay alumno que buscar: ni siquiera "sin datos todavia".
    assert filas['nadie@x.com']['client_id'] is None and filas['nadie@x.com']['academia'] is None


def test_un_closer_ve_sus_clientes_con_sus_fotos_y_ninguno_de_otro(db, vendedores):
    marlon, nerina = vendedores
    suyo = comprador(db, marlon, 'ana@x.com', foto=ACTIVO)
    comprador(db, nerina, 'otra@x.com', foto=ACTIVO)

    filas = ComercialService.clientes(closer_id=marlon.id)

    assert [(f['client_id'], f['academia']['estado']['key']) for f in filas] == [(suyo.id, 'activo')]


def test_la_tabla_ventas_lee_las_fotos_en_una_consulta_y_no_en_una_por_fila(db, vendedores):
    marlon_id = vendedores[0].id

    def vendedor():
        # Por id: medir vacia la sesion y deja suelto al usuario del fixture.
        return db.session.get(User, marlon_id)

    def consultas_de_la_tabla():
        # Una pasada antes de medir: la primera llena cachés (los nombres de los closers) que no
        # dependen de cuantas filas haya.
        ComercialService.ventas(DESDE, HASTA)
        db.session.expunge_all()
        contadas = []

        def anotar(*_a, **_k):
            contadas.append(1)

        motor = db.session.get_bind()
        event.listen(motor, 'before_cursor_execute', anotar)
        try:
            ComercialService.ventas(DESDE, HASTA)
        finally:
            event.remove(motor, 'before_cursor_execute', anotar)
        return len(contadas)

    for i in range(2):
        comprador(db, vendedor(), f'a{i}@x.com', foto=ACTIVO)
    pocas = consultas_de_la_tabla()
    for i in range(8):
        comprador(db, vendedor(), f'b{i}@x.com', foto=ACTIVO)
    muchas = consultas_de_la_tabla()

    assert muchas == pocas
