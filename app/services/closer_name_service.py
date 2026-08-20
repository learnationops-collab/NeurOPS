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


def _indice():
    """{clave normalizada -> username} de los closers reales del sistema.

    Se cachea en `g` porque `resolver_nombre_closer` se llama una vez por venta
    dentro de bucles de miles de filas: sin cache serian miles de consultas.
    """
    if has_app_context() and hasattr(g, '_indice_closers'):
        return g._indice_closers

    from app.models import User, CloserAlias

    indice = {}

    def registrar(clave, username):
        clave = (clave or '').strip()
        if clave:
            indice.setdefault(clave, username)

    # Los closers primero: si un admin comparte correo con un closer, gana el closer.
    usuarios = (User.query.filter_by(role='closer').all()
                + User.query.filter(User.role != 'closer').all())
    for u in usuarios:
        if not u.username:
            continue
        registrar(normalizar(u.username), u.username)
        registrar(_sin_espacios(u.username), u.username)
        if u.email:
            registrar(normalizar(u.email), u.username)
            registrar(_sin_espacios(u.email.split('@')[0]), u.username)

    for alias in CloserAlias.query.all():
        if alias.user and alias.alias_name:
            registrar(normalizar(alias.alias_name), alias.user.username)
            registrar(_sin_espacios(alias.alias_name), alias.user.username)

    if has_app_context():
        g._indice_closers = indice
    return indice


def resolver_nombre_closer(email_o_nombre):
    """Nombre con el que se muestra y agrupa a un closer."""
    if not email_o_nombre or not str(email_o_nombre).strip():
        return SIN_CLOSER

    crudo = str(email_o_nombre).strip()
    indice = _indice()

    # 1. Coincidencia exacta (normalizada) contra usuario, correo o alias
    for clave in (normalizar(crudo), _sin_espacios(crudo)):
        if clave in indice:
            return indice[clave]

    # 2. Si es un correo, probar tambien con la parte local ('jeancarlo@x' -> 'jeancarlo')
    if '@' in crudo:
        local = crudo.split('@')[0]
        for clave in (normalizar(local), _sin_espacios(local)):
            if clave in indice:
                return indice[clave]

    # 3. Diccionario historico (gente sin usuario en el sistema)
    minusculas = crudo.lower()
    for nombre, valores in MAPEO_HISTORICO.items():
        for valor in valores:
            if valor in minusculas:
                return nombre

    # 4. Ultimo recurso: presentar el texto crudo lo mejor posible
    if '@' in crudo:
        return crudo.split('@')[0].replace('.', ' ').title()
    return crudo.title()


def closers_conocidos():
    """Nombres de los closers del sistema, para ofrecerlos siempre en el filtro.

    Sin esto, el desplegable solo lista a quienes tienen ventas dentro del rango
    elegido — justo lo que impide seleccionar a alguien ANTES de ver sus ventas.
    """
    from app.models import User

    return sorted({u.username for u in User.query.filter_by(role='closer').all() if u.username})
