"""Cómo se le encuentra la conversación de ManyChat a una persona (`cruce_conversaciones`, 17/10/2026),
y el cobrado que no llega a ninguna palabra clave en el tablero de Marketing.

Kerwin: «dice que hay $5.138 reunidos en los últimos 30 días, lo cual me parece poco». En producción el
período tenía $17.059: el resto era workshop, VSL, renovaciones y ventas de setting cuyo Instagram no
coincidía con el de ManyChat («luis.rinnegan» / «luis_rinnegan», «Greta Castro» / «Greta Castro Gallo»).
"""
import itertools
from datetime import date, datetime

import pytest

from app.models import Client, FinancialSale, LeadAnswer, ManychatLead
from app.services import anuncios_service as servicio
from app.services.cruce_conversaciones import Cruce, clave_de_nombre, compacto, leads_por_nombre

_n = itertools.count(1)


def conversacion(db, ig=None, nombre='Lead', keyword=None, cuando=datetime(2026, 10, 1)):
    lead = ManychatLead(manychat_id=f'cx-{next(_n)}', name=nombre, ig=ig)
    db.session.add(lead)
    db.session.commit()
    if keyword:
        db.session.add(LeadAnswer(lead_id=lead.id, keyword=keyword, created_at=cuando, updated_at=cuando))
        db.session.commit()
    return lead


def venta(db, ig, nombre, monto=500, tipo='AL - Completo'):
    c = Client(full_name=nombre, email=f'{next(_n)}@test.local', instagram=ig)
    db.session.add(c)
    db.session.commit()
    db.session.add(FinancialSale(client_id=c.id, instagram=ig, tipo_pago=tipo, monto=monto,
                                 estado='Completada', date=datetime(2026, 10, 10)))
    db.session.commit()


@pytest.mark.parametrize('ig, esperado', [
    ('luis.rinnegan', 'luisrinnegan'),
    ('@Luis_Rinnegan', 'luisrinnegan'),
    ('greta castro gallo', 'gretacastrogallo'),
    ('ana', None),  # corto: se parece a demasiados
    (None, None),
])
def test_el_instagram_compacto(ig, esperado):
    assert compacto(ig) == esperado


def test_un_instagram_con_otro_separador_lleva_a_la_misma_conversacion(db):
    lead = conversacion(db, ig='luis_rinnegan')
    cruce = Cruce({'luis.rinnegan'})
    assert list(cruce.candidatos('luis.rinnegan')) == [(), [lead.id], ()]


def test_el_nombre_contenido_en_el_de_una_sola_conversacion(db):
    greta = conversacion(db, nombre='Greta Castro Gallo')
    conversacion(db, nombre='Ana María López')
    conversacion(db, nombre='Ana Lucía López')

    encontrados = leads_por_nombre({clave_de_nombre('Greta Castro'), clave_de_nombre('Ana López')})

    # «Ana López» está en dos: no se elige ninguna.
    assert encontrados == {'greta castro': greta.id}


def test_la_primera_palabra_tiene_que_coincidir(db):
    conversacion(db, nombre='Castro Greta Perez')
    assert leads_por_nombre({clave_de_nombre('Greta Castro')}) == {}


def test_la_venta_con_el_instagram_mal_escrito_suma_a_su_palabra_clave(db):
    conversacion(db, ig='luis_rinnegan', keyword='APLICAR')
    conversacion(db, nombre='Greta Castro Gallo', keyword='GUIA PERU')
    venta(db, 'luis.rinnegan', 'Luis Espinosa', 250)
    venta(db, 'greta castro gallo', 'Greta Castro', 300)

    resultado = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))
    cobrado = {f['clave']: f['cobrado'] for f in resultado['filas']}

    assert (cobrado['APLICAR'], cobrado['GUIA PERU']) == (250.0, 300.0)


def test_lo_cobrado_sin_palabra_clave_se_reparte_por_procedencia(db):
    conversacion(db, ig='con_anuncio', keyword='APLICAR')
    venta(db, 'con_anuncio', 'Con Anuncio', 1000)
    venta(db, 'sin_manychat', 'Sin Manychat', 400, tipo='AL - Cuota')

    resultado = servicio.tablero(date(2026, 10, 1), date(2026, 10, 31))

    assert resultado['cobrado_periodo'] == 1400.0
    assert sum(p['monto'] for p in resultado['cobrado_fuera']) == 400.0
    assert all(p['cantidad'] > 0 for p in resultado['cobrado_fuera'])
    # Lo que muestra Revisar con esa Fuente: también lo de palabra clave de la misma procedencia.
    assert sum(p['monto_total'] for p in resultado['cobrado_fuera']) == 1400.0
