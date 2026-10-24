"""Lo suyo y el ranking (Learnito para todo el equipo, 24/10/2026). La dirección ve todo; el resto del equipo:

- Filas (listas y su total): solo las suyas. Una fila es suya si figura en ella (una columna que apunta a su
  usuario, como closer_id o setter_id, o el email o el nombre del closer en las tablas que lo guardan como texto)
  o si es de una persona con la que tuvo una agenda, como closer o como setter.
- Mediciones que agrupan: de todo el equipo (el show up de cada closer, las ventas por programa), salvo que agrupen
  por un dato personal (el email o el nombre de un cliente): esas, solo sobre sus filas. Una medición sin agrupar es
  un total, como el de las filas: solo lo suyo (si no, "mis agendas" contaba las de todos).

Lo usa el motor (motor.run), así que vale igual para Learnito, las habilidades y cualquier plan. Un solo lugar
para revisarlo, como exclusion.py.
"""
from sqlalchemy import String, false, func, or_, select

from app import db
from app.models.user import ROLE_ADMIN, ROLE_DIRECTOR_COMERCIAL, ROLE_OPERATOR

DIRECCION = {ROLE_ADMIN, ROLE_OPERATOR, ROLE_DIRECTOR_COMERCIAL}

# Tablas que guardan al closer como texto, no como usuario: (columna, dato del usuario).
CLOSER_TEXTO = {'closer_email': 'email', 'setter_email': 'email', 'closer': 'username'}

# Un dato es personal si su nombre tiene una de estas palabras (o es un id que no apunta a un usuario).
PERSONALES = ('email', 'phone', 'telefono', 'full_name', 'first_name', 'last_name', 'nombre', 'name', 'instagram',
              'whatsapp', 'dni', 'documento', 'uuid', 'direccion', 'address')


def completo(user):
    """La dirección y los sistemas de confianza (agentes pares de la Academia) ven todas las filas."""
    return getattr(user, 'role', None) in DIRECCION or bool(getattr(user, 'alcance_completo', False))


def _a_usuarios(col):
    return any(fk.column.table.name == 'users' for fk in col.foreign_keys)


def _personas_con_agenda(user_id):
    appts = db.metadata.tables['appointments']
    return (select(appts.c.person_uuid)
            .where(appts.c.person_uuid.isnot(None), or_(appts.c.closer_id == user_id, appts.c.setter_id == user_id)))


def filtro(user, fuente):
    """La condición de "sus filas" para esta fuente, o None si ve todo."""
    if completo(user):
        return None
    uid = getattr(user, 'id', None)
    if uid is None:
        return false()
    t = fuente.table
    partes = [col == uid for col in t.columns if _a_usuarios(col)]
    for nombre, dato in CLOSER_TEXTO.items():
        valor = getattr(user, dato, None)
        if nombre in t.c and valor and isinstance(t.c[nombre].type, String):
            partes.append(func.lower(t.c[nombre]) == str(valor).lower())
    if fuente.person_expr is not None:
        partes.append(fuente.person_expr.in_(_personas_con_agenda(uid)))
    return or_(*partes) if partes else false()


def personal(fuente, clave):
    """¿Agrupar por este dato muestra datos de clientes? Los datos de un usuario del equipo no son personales."""
    partes = (clave or '').split('.')
    if partes[0] == 'p' and len(partes) == 3 and partes[1] in fuente.table.c:
        if _a_usuarios(fuente.table.c[partes[1]]):
            return False
    nombre = partes[-1].lower()
    if any(p in nombre for p in PERSONALES):
        return True
    if partes[0] == 'f' and (nombre == 'id' or nombre.endswith('_id')):
        col = fuente.table.c.get(nombre)
        return col is None or not _a_usuarios(col)
    return False


def propia(fuente, agrupar_por):
    """¿La medición va solo sobre sus filas? Un total (sin agrupar) o un reparto por un dato personal."""
    return not agrupar_por or personal(fuente, agrupar_por)


def nota(medicion_propia):
    return ('Alcance: filas y total, solo las tuyas (donde figurás o de personas con las que tuviste una agenda). '
            + ('La medición también (es un total o agrupa por un dato personal).' if medicion_propia
               else 'La medición es de todo el equipo.'))
