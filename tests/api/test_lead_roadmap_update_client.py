"""POST /api/public/lead-roadmap/update-client: busqueda del cliente por Instagram.

`normalize_ig` devuelve None para un placeholder ('N/A', 'N/A ', '@'...). Comparar una columna con
None en SQLAlchemy genera `IS NULL`, que empata con el PRIMER cliente sin Instagram: el endpoint lo
"encontraba" y le pisaba nombre, mail y telefono con los de otra persona. Ahora solo se busca por
Instagram cuando hay un usuario real.
"""
import pytest

from app.models import Client

URL = '/api/public/lead-roadmap/update-client'


@pytest.fixture()
def cliente_sin_instagram(db):
    cliente = Client(full_name='Cliente Existente', email='existente@x.com', phone='111', instagram=None)
    db.session.add(cliente)
    db.session.commit()
    return cliente


@pytest.mark.parametrize('placeholder', ['N/A', 'n/a', 'N/A ', ' n/a', '@', '   '])
def test_un_instagram_placeholder_no_empata_con_un_cliente_sin_instagram(
        client, db, cliente_sin_instagram, placeholder):
    respuesta = client.post(URL, json={
        'instagram': placeholder, 'full_name': 'Persona Nueva', 'email': 'nueva@x.com',
    })

    assert respuesta.status_code == 200
    db.session.refresh(cliente_sin_instagram)
    assert (cliente_sin_instagram.full_name, cliente_sin_instagram.email, cliente_sin_instagram.phone) == \
        ('Cliente Existente', 'existente@x.com', '111')
    assert Client.query.count() == 2
    nuevo = Client.query.filter_by(email='nueva@x.com').one()
    assert nuevo.full_name == 'Persona Nueva'
    assert nuevo.instagram is None


def test_un_instagram_real_sigue_encontrando_al_cliente_por_su_usuario(client, db):
    db.session.add(Client(full_name='Ana', instagram='ana_g'))
    db.session.commit()

    respuesta = client.post(URL, json={'instagram': '@Ana_G ', 'full_name': 'Ana Gomez'})

    assert respuesta.status_code == 200
    assert Client.query.count() == 1
    assert Client.query.one().full_name == 'Ana Gomez'


def test_sin_instagram_util_ni_mail_conocido_pide_el_nombre_para_crear(client, db, cliente_sin_instagram):
    respuesta = client.post(URL, json={'instagram': 'N/A ', 'email': 'otro@x.com'})

    assert respuesta.status_code == 400
    assert Client.query.count() == 1
