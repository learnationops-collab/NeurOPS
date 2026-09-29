"""Una venta atada a un cliente por id es suya aunque el contacto de la venta ya no coincida.

`_client_program_code` y `_client_has_sale` cruzaban solo por correo e instagram. Cuando a un
cliente se le corrige el correo desde la ficha, sus ventas se atan por id antes del cambio: si
estas dos funciones no miraran el id, el programa desapareceria de la cabecera de la ficha y el
cliente dejaria de contar como "ya compro" justo despues de arreglarle un dato.
"""
from datetime import datetime

from app.models import Client, FinancialSale
from app.services.closer_followup_service import CloserFollowUpService


def _venta(db, **campos):
    venta = FinancialSale(date=datetime(2026, 9, 1), monto=500, tipo_pago='RR - Parcial',
                          estado='Completada', **campos)
    db.session.add(venta)
    db.session.commit()
    return venta


def test_el_programa_sale_de_una_venta_atada_por_id_aunque_el_correo_sea_otro(db):
    cliente = Client(full_name='Ana', email='ana@nuevo.com')
    db.session.add(cliente)
    db.session.commit()
    _venta(db, mail_cliente='ana@viejo.com', client_id=cliente.id)

    assert CloserFollowUpService._client_program_code(cliente.id) == 'RR'
    assert CloserFollowUpService._client_has_sale(cliente) is True


def test_un_cliente_sin_guardar_no_se_queda_con_las_ventas_sueltas(db):
    """`client_id == None` seria `IS NULL`: juntaria todas las ventas que no tienen cliente."""
    _venta(db, mail_cliente='otra@x.com', client_id=None)

    assert CloserFollowUpService._client_has_sale(Client(full_name='Sin guardar')) is False
