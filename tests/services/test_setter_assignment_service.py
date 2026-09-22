"""A qué setter le toca cada lead de ManyChat: normalización de nombre y la bandeja visible de cada
rol. El nombre lo escribe ManyChat a mano (no es el `username` de la base), así que el emparejamiento
es por texto normalizado contra lo que de verdad existe en la tabla, nunca una igualdad literal.
"""
from types import SimpleNamespace

import pytest

from app.models import ManychatLead
from app.services.setter_assignment_service import (
    condicion_leads_visibles, debe_filtrar_por_setter, normalizar_nombre,
)


def lead(db, setter, manychat_id=None):
    contador = getattr(lead, '_contador', 0) + 1
    lead._contador = contador
    l = ManychatLead(manychat_id=manychat_id or f'mc-{contador}', setter=setter)
    db.session.add(l)
    db.session.commit()
    return l


def visibles(user):
    condicion = condicion_leads_visibles(user)
    query = ManychatLead.query if condicion is None else ManychatLead.query.filter(condicion)
    return {l.manychat_id for l in query.all()}


# --- normalizar_nombre ---------------------------------------------------------------------------

@pytest.mark.parametrize('nombre,esperado', [
    (None, ''), ('', ''), ('   ', ''),
    ('Ivan', 'ivan'), ('Iván', 'ivan'), ('IVÁN', 'ivan'),
    ('  Ana   Gomez ', 'ana gomez'),
    ('ÑANDÚ', 'nandu'),
])
def test_normalizar_nombre(nombre, esperado):
    assert normalizar_nombre(nombre) == esperado


# --- debe_filtrar_por_setter -----------------------------------------------------------------

def test_solo_el_rol_setter_se_filtra(make_user):
    assert debe_filtrar_por_setter(make_user(role='setter')) is True


@pytest.mark.parametrize('rol', ['admin', 'operator', 'closer', 'triage', 'director_comercial'])
def test_los_demas_roles_no_se_filtran(make_user, rol):
    assert debe_filtrar_por_setter(make_user(role=rol)) is False


def test_sin_usuario_no_se_filtra(db):
    assert debe_filtrar_por_setter(None) is False


def test_un_usuario_no_autenticado_no_se_filtra_aunque_diga_ser_setter():
    anonimo = SimpleNamespace(is_authenticated=False, role='setter', username='ivan')

    assert debe_filtrar_por_setter(anonimo) is False


# --- condicion_leads_visibles: quien no es setter ve todo --------------------------------------

@pytest.mark.parametrize('rol', ['admin', 'operator'])
def test_admin_y_operador_ven_todos_los_leads_sin_condicion(db, make_user, rol):
    lead(db, setter='Ivan')
    lead(db, setter=None)

    assert condicion_leads_visibles(make_user(role=rol)) is None


# --- condicion_leads_visibles: un setter ----------------------------------------------------------

def test_un_setter_sin_leads_asignados_todavia_ve_solo_los_sin_dueno(db, make_user):
    sin_dueno = lead(db, setter=None)
    vacio = lead(db, setter='')
    lead(db, setter='Otro Setter')

    ivan = make_user(role='setter', username='Ivan')

    assert visibles(ivan) == {sin_dueno.manychat_id, vacio.manychat_id}


def test_un_setter_ve_los_suyos_mas_los_sin_dueno(db, make_user):
    de_ivan = lead(db, setter='Ivan')
    sin_dueno = lead(db, setter=None)
    de_otro = lead(db, setter='Otro Setter')

    ivan = make_user(role='setter', username='Ivan')

    assert visibles(ivan) == {de_ivan.manychat_id, sin_dueno.manychat_id}
    assert de_otro.manychat_id not in visibles(ivan)


def test_el_match_ignora_mayusculas_acentos_y_espacios(db, make_user):
    # ManyChat guardo el nombre con acento y una mayuscula distinta a como esta en users.username.
    de_ivan = lead(db, setter='Iván')
    ivan = make_user(role='setter', username='ivan')

    assert visibles(ivan) == {de_ivan.manychat_id}


def test_dos_variantes_guardadas_del_mismo_setter_se_ven_ambas(db, make_user):
    variante_1 = lead(db, setter='Ivan')
    variante_2 = lead(db, setter='IVAN')  # ManyChat mando el nombre distinto en otra conversacion
    lead(db, setter='Otro')

    ivan = make_user(role='setter', username='ivan')

    assert visibles(ivan) == {variante_1.manychat_id, variante_2.manychat_id}


def test_el_username_no_empata_por_substring_sino_por_igualdad_normalizada(db, make_user):
    # 'Ivan' no debe traer los leads de 'Ivana': normalizar_nombre no es un prefijo/substring.
    de_otra_persona = lead(db, setter='Ivana')
    sin_dueno = lead(db, setter=None)

    ivan = make_user(role='setter', username='Ivan')

    assert de_otra_persona.manychat_id not in visibles(ivan)
    assert visibles(ivan) == {sin_dueno.manychat_id}
