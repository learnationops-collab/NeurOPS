"""Como se guardan los datos de contacto de un cliente corregidos a mano.

La normalizacion vive suelta en `closer_service` porque la comparten dos puertas: el mazo
(`CloserService.update_client`, via `PATCH /closer/customers/<id>`) y la ficha del lead
(`PATCH /ficha/<id>/datos`). Estos tests fijan lo que las dos guardan para la misma entrada.
"""
import pytest

from app.models import Client
from app.services.closer_service import (
    CloserService, normalizar_email, normalizar_instagram, normalizar_telefono,
)


@pytest.mark.parametrize('entrada,esperado', [
    ('  Ana@X.com ', 'ana@x.com'),
    ('ana.sin.arroba', None),     # update_client lo vacia en silencio; la ficha lo rechaza
    ('N/A', None),
    ('', None),
    (None, None),
])
def test_el_correo_se_guarda_en_minusculas_y_sin_arroba_no_es_correo(entrada, esperado):
    assert normalizar_email(entrada) == esperado


@pytest.mark.parametrize('entrada,esperado', [
    ('@ana.g', 'ana.g'),
    (' ana.g@ ', 'ana.g'),
    ('Ana.G', 'Ana.G'),           # no se pasa a minusculas: el cruce ya compara sin mayusculas
    ('none', None),
    ('', None),
])
def test_el_instagram_se_guarda_sin_la_arroba(entrada, esperado):
    assert normalizar_instagram(entrada) == esperado


@pytest.mark.parametrize('entrada,esperado', [
    (' +591 7123 4567 ', '+591 7123 4567'),
    ('NULL', None),
    ('', None),
])
def test_el_telefono_se_guarda_tal_cual_sin_espacios_en_los_bordes(entrada, esperado):
    assert normalizar_telefono(entrada) == esperado


def test_update_client_guarda_lo_mismo_que_la_normalizacion_compartida(db):
    cliente = Client(full_name='Ana', email='ana@x.com', phone='111', instagram='ana')
    db.session.add(cliente)
    db.session.commit()

    CloserService.update_client(cliente.id, {'email': ' ANA@nuevo.com ', 'instagram': '@ana.g',
                                             'phone': ' 222 '})

    assert (cliente.email, cliente.instagram, cliente.phone) == ('ana@nuevo.com', 'ana.g', '222')


def test_update_client_vacia_un_correo_vacio_en_null_y_no_en_texto_vacio(db):
    """`email` es `unique`: dos clientes con '' chocarian, dos con NULL no."""
    cliente = Client(full_name='Ana', email='ana@x.com')
    db.session.add(cliente)
    db.session.commit()

    CloserService.update_client(cliente.id, {'email': ''})

    assert cliente.email is None
