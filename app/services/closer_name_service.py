"""Nombre canonico del closer de una venta.

`FinancialSale.email_vendedor` es texto libre que viene de la hoja de ventas, y
la misma persona aparece escrita de varias formas segun quien cargo la fila:
'jeancarlo@thelearnation.com', 'jeancarlo', 'Jean Carlo', 'jeancarlo@gmail.com'.

Antes esto se resolvia con un diccionario a mano por cada correo conocido, asi
que cualquier variante que no estuviera listada caia en un fallback que hacia
`.title()` sobre el texto crudo. Resultado: el MISMO closer se partia en dos
opciones distintas del filtro ('Jean Carlo' y 'Jeancarlo'), y al filtrar por una
de ellas se perdian silenciosamente las ventas de la otra.

Ahora se resuelve primero contra los datos reales del sistema — los usuarios con
rol closer y la tabla `CloserAlias`, que existe justamente para esto — y recien
despues se cae al diccionario historico, que se conserva para la gente que ya no
tiene usuario.
"""
from flask import g, has_app_context

from app.services.fuente_service import normalizar

SIN_CLOSER = 'Sin Closer'

# Gente que ya no tiene usuario en el sistema pero sigue apareciendo en ventas
# historicas. Ojo: varias entradas son fragmentos y se comparan por substring,
# asi que este diccionario se consulta DESPUES de la resolucion exacta.
MAPEO_HISTORICO = {
    'Jean Carlo': ['jeancarlo@thelearnation.com'],
    'Marlon': ['marlon@thelearnation.com', 'marlongarcia27948@gmail.com'],
    'Guillermo': ['guillermo@thelearnation.com'],
    'Tomas': ['tomas@thelearnation.com', 'tomaszetaaa@gmail.com'],
    'Mario': ['mario@neurocogniciones.com', 'mario@thelearnation.com'],
    'Mercari': ['mercaricc@gmail.com', 'mírcari', 'mircari', 'mercari'],
    'Iñaki': ['iñaki', 'inaki'],
    'Rafael': ['rafael'],
    'Mateo': ['mateo'],
    'Belén': ['mbelenamerise@gmail.com', 'belen'],
    'Valery': ['valeryjohana.cabrera@gmail.com', 'valery'],
    'Gabriel': ['gabriel@thelearnation.com', 'gabriel'],
}


def _sin_espacios(texto):
    return normalizar(texto).replace(' ', '')


def _claves_de(texto):
    """Las formas normalizadas con las que se puede reconocer un texto.

    Para un correo se indexa tambien la parte local, que es lo que hace que
    'jeancarlo@thelearnation.com', 'jeancarlo@gmail.com', 'jeancarlo' y
    'Jean Carlo' terminen todos en la misma clave 'jeancarlo'.
    """
    claves = {normalizar(texto), _sin_espacios(texto)}
    if '@' in str(texto):
        local = str(texto).split('@')[0]
        claves |= {normalizar(local), _sin_espacios(local)}
    return {c for c in claves if c}


def _indice_historico():
    """{clave normalizada -> nombre} del diccionario de gente sin usuario.

    Se indexa por clave exacta (incluida la parte local de cada correo y el
    propio nombre sin espacios) en vez de compararlo por substring: asi las
    variantes de una misma persona colapsan en un solo nombre aunque no tenga
    usuario en el sistema, que es el caso de los closers que ya no estan.
    """
    indice = {}
    for nombre, valores in MAPEO_HISTORICO.items():
        for clave in _claves_de(nombre):
            indice.setdefault(clave, nombre)
        for valor in valores:
            for clave in _claves_de(valor):
                indice.setdefault(clave, nombre)
    return indice


def _indice():
    """{clave normalizada -> nombre canonico} de todos los closers reconocibles.

    Se cachea en `g` porque `resolver_nombre_closer` se llama una vez por venta
    dentro de bucles de miles de filas: sin cache serian miles de consultas.
    """
    if has_app_context() and hasattr(g, '_indice_closers'):
        return g._indice_closers

    from app.models import User, CloserAlias

    indice = {}

    def registrar(claves, nombre):
        for clave in claves:
            indice.setdefault(clave, nombre)

    # Los closers primero: si un admin comparte correo con un closer, gana el closer.
    usuarios = (User.query.filter_by(role='closer').all()
                + User.query.filter(User.role != 'closer').all())
    for u in usuarios:
        if not u.username:
            continue
        registrar(_claves_de(u.username), u.username)
        if u.email:
            registrar(_claves_de(u.email), u.username)

    for alias in CloserAlias.query.all():
        if alias.user and alias.alias_name:
            registrar(_claves_de(alias.alias_name), alias.user.username)

    # El diccionario historico va ultimo: los datos reales del sistema mandan.
    for clave, nombre in _indice_historico().items():
        indice.setdefault(clave, nombre)

    if has_app_context():
        g._indice_closers = indice
    return indice


def resolver_nombre_closer(email_o_nombre):
    """Nombre con el que se muestra y agrupa a un closer."""
    if not email_o_nombre or not str(email_o_nombre).strip():
        return SIN_CLOSER

    crudo = str(email_o_nombre).strip()
    indice = _indice()

    # 1. Coincidencia exacta contra usuario, correo, alias o diccionario historico
    for clave in _claves_de(crudo):
        if clave in indice:
            return indice[clave]

    # 2. Substring del diccionario historico, para correos con nombre y apellido
    #    ('rafael.perez@...' no coincide exacto con 'rafael' pero es la misma persona)
    minusculas = crudo.lower()
    for nombre, valores in MAPEO_HISTORICO.items():
        for valor in valores:
            if valor in minusculas:
                return nombre

    # 3. Ultimo recurso: presentar el texto crudo lo mejor posible
    if '@' in crudo:
        return crudo.split('@')[0].replace('.', ' ').title()
    return crudo.title()


def closers_conocidos():
    """Todos los closers que se pueden elegir en el filtro, sin importar el rango.

    Son dos fuentes, y hacen falta las dos:

      · Los usuarios con rol closer — incluye a los que todavia no vendieron.
      · Los que aparecen en el historial de ventas (DISTINCT sobre
        `email_vendedor`, resuelto a nombre canonico) — incluye a quien ya no
        tiene usuario, o lo tiene con otro rol, pero vendio en su momento.

    Sin la segunda, alguien que dejo de ser closer desaparecia del filtro y no
    habia forma de exportar sus ventas historicas. Sin ninguna de las dos, el
    desplegable solo listaba a quien tuviera ventas dentro del rango elegido, que
    es justo lo que impide seleccionar a alguien ANTES de ver sus ventas.
    """
    from app.models import User
    from app.models.financial import FinancialSale
    from app import db

    nombres = {u.username for u in User.query.filter_by(role='closer').all() if u.username}

    vendedores = db.session.query(FinancialSale.email_vendedor).distinct().all()
    for (valor,) in vendedores:
        if not valor or not str(valor).strip():
            continue
        nombre = resolver_nombre_closer(valor)
        if nombre and nombre != SIN_CLOSER:
            nombres.add(nombre)

    return sorted(nombres)
