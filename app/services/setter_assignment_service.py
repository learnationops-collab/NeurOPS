"""A que setter le toca cada lead entrante de ManyChat.

ManyChat reparte los leads entre los setters y manda el nombre del asignado en
la variable `setter` del webhook, que se guarda en `ManychatLead.setter`. Antes
la bandeja se acotaba por el anuncio (`Event.setter_id`), que era un proxy: si
el anuncio no tenia evento o setter dueño, todos veian todo.

Dos detalles del formato que obligan a no comparar textos a secas:

  · Los 2 primeros JSON de cada conversacion traen `setter` vacio, asi que hay
    leads sin dueño todavia. Esos los ve todo el mundo hasta que ManyChat los
    reparta (si no, quedarian invisibles justo cuando recien entran).

  · El nombre lo escribe ManyChat a mano, no es el `username` de la base. Ya
    conviven variantes de mayusculas y acentos ('Ivan' / 'Iván'), asi que el
    match se hace normalizado contra los valores que existen realmente en la
    tabla, no con una igualdad literal en SQL.
"""
import re
import unicodedata

from app import db


def normalizar_nombre(nombre):
    """Minusculas, sin acentos y sin espacios repetidos."""
    if not nombre:
        return ''
    t = unicodedata.normalize('NFKD', str(nombre))
    t = ''.join(c for c in t if not unicodedata.combining(c))
    return re.sub(r'\s+', ' ', t.lower()).strip()


def _variantes_guardadas(nombre):
    """Valores tal cual estan en la tabla que corresponden a este setter."""
    from app.models import ManychatLead

    buscado = normalizar_nombre(nombre)
    if not buscado:
        return []

    guardados = db.session.query(ManychatLead.setter).distinct().all()
    return [fila[0] for fila in guardados
            if fila[0] and normalizar_nombre(fila[0]) == buscado]


def debe_filtrar_por_setter(user):
    """True solo para los setters: admin y operador ven la bandeja completa."""
    from app.models import ROLE_SETTER

    return bool(user and getattr(user, 'is_authenticated', False)
                and user.role == ROLE_SETTER)


def condicion_leads_visibles(user):
    """Condicion SQLAlchemy sobre ManychatLead para la bandeja de este usuario.

    Devuelve None cuando no hay que acotar nada (admin, operador, o cualquiera
    que no sea setter). Para un setter: sus leads mas los que todavia no tienen
    dueño asignado.
    """
    from sqlalchemy import or_

    from app.models import ManychatLead

    if not debe_filtrar_por_setter(user):
        return None

    sin_asignar = or_(ManychatLead.setter == None, ManychatLead.setter == '')  # noqa: E711
    variantes = _variantes_guardadas(user.username)
    if not variantes:
        return sin_asignar

    return or_(ManychatLead.setter.in_(variantes), sin_asignar)
