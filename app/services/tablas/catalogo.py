"""Las fuentes del motor: cada tabla de los modelos de Work (db.metadata), sin lo excluido (exclusion.py).

Una tabla nueva aparece sola. Las relaciones salen de las ForeignKey declaradas en los modelos, no de los
nombres. Campos de cada fila (mismas claves que la Academia):
  f.{col}          una columna propia
  p.{fk}.{col}     una columna de la fila a la que apunta {fk} (un nivel)
  n.{tabla}.{fk}   cuántas filas de {tabla} apuntan a esta
  l.{tabla}.{fk}   cuándo se creó la última de ellas (si {tabla} tiene created_at)
"""
from dataclasses import dataclass, field

from sqlalchemy import cast, func, literal, select, types

from app import db
from app.services.tablas import exclusion

LABEL_COLUMNS = ('full_name', 'name', 'nombre', 'title', 'titulo', 'username', 'email', 'slug')

COLUMN_LABELS = {
    'id': 'Número', 'created_at': 'Creado', 'updated_at': 'Actualizado', 'status': 'Estado', 'estado': 'Estado',
    'name': 'Nombre', 'full_name': 'Nombre', 'email': 'Email', 'phone': 'Teléfono', 'type': 'Tipo',
    'start_time': 'Inicio', 'end_time': 'Fin', 'date': 'Fecha', 'fecha': 'Fecha', 'amount': 'Monto',
    'username': 'Usuario', 'role': 'Rol', 'title': 'Título',
}

# Fuentes con nombre propio (categoría "Del sistema"), en este orden: tabla -> (nombre, descripción).
NAMED = {
    'people': ('Personas', 'Cada persona: lead, cliente o alumno. Su uuid es su id en todos los sistemas'),
    'clients': ('Clientes', 'El cliente comercial de cada persona: total a pagar, baja, objeciones'),
    'sales': ('Ventas', 'Cada venta (nueva, renovación o upsell), con su programa, closer y estado'),
    'financial_sales': ('Pagos', 'Cada pago registrado, con su venta y su persona'),
    'installment_plans': ('Planes de cuotas', 'El plan de cuotas de cada venta en cuotas'),
    'subscriptions': ('Suscripciones', 'Cada suscripción a un programa, con su vencimiento'),
    'appointments': ('Agendas', 'Cada llamada agendada con un closer'),
    'financial_agendas': ('Agendas (registro financiero)', 'Las agendas como las registra la planilla'),
    'conversations': ('Conversaciones', 'Cada conversación de un setter con un lead'),
    'enrollments': ('Inscripciones', 'Cada inscripción a un programa'),
    'workshop_leads': ('Leads del workshop', 'Cada inscripto a un workshop'),
}


@dataclass
class Campo:
    key: str
    label: str
    group: str
    kind: str  # text | number | date | instant | bool
    expr: object = field(repr=False)
    detail: str = ''


@dataclass
class Fuente:
    key: str
    label: str
    table: object = field(repr=False)
    pk: object = field(repr=False)
    label_expr: object = field(repr=False)
    # La persona de la fila (people.uuid), la clave para cruzar con la Academia. None si la tabla no apunta a una.
    person_expr: object = field(default=None, repr=False)
    fields: dict = field(default_factory=dict)
    category: str = 'Todas las tablas'
    description: str = ''


def kind_of(column):
    t = column.type
    if isinstance(t, types.Boolean):
        return 'bool'
    if isinstance(t, (types.Integer, types.Numeric)):
        return 'number'
    if isinstance(t, types.DateTime):
        return 'instant'
    if isinstance(t, types.Date):
        return 'date'
    if isinstance(t, (types.String, types.Text, types.Enum, types.Uuid)):
        return 'text'
    return None  # JSON, binarios, listas: no se listan


def column_label(name):
    return COLUMN_LABELS.get(name) or name.replace('_', ' ').strip().capitalize()


def _tables():
    return {name: t for name, t in db.metadata.tables.items() if exclusion.allowed_table(name)}


def _pk(table):
    cols = list(table.primary_key.columns)
    return cols[0] if len(cols) == 1 else None


def _parent_of(column, tables):
    """(tabla, columna) a la que apunta una FK hacia la clave primaria de otra tabla listable, o None."""
    for fk in column.foreign_keys:
        target = fk.column
        parent = tables.get(target.table.name)
        if parent is not None and _pk(parent) is not None and target.name == _pk(parent).name:
            return parent
    return None


def _children(table, tables):
    """[(tabla hija, columna fk)] de las tablas que apuntan a esta."""
    out = []
    for child in tables.values():
        for col in child.columns:
            parent = _parent_of(col, tables)
            if parent is not None and parent.name == table.name:
                out.append((child, col))
    return out


def _label_expr(table, alias=None):
    t = alias if alias is not None else table
    for name in LABEL_COLUMNS:
        if name in t.c and exclusion.allowed_column(name):
            return t.c[name]
    pk = _pk(table)
    return literal('#', types.String) + cast(t.c[pk.name], types.String) if pk is not None else literal(None)


def _visible(user, column, kind):
    if not exclusion.allowed_column(column.name) or kind is None:
        return False
    return not exclusion.is_amount(column.name, kind) or exclusion.sees_amounts(user)


def alumno_expr(person):
    """El id del alumno en la Academia (`alumno_id` de sus filas): la identidad learnation_user_id de la persona."""
    ids = db.metadata.tables['person_identities']
    return (select(ids.c.value)
            .where(ids.c.person_uuid == person, ids.c.kind == 'learnation_user_id', ids.c.retired_at.is_(None))
            .order_by(ids.c.is_primary.desc(), ids.c.id.desc()).limit(1).scalar_subquery())


def build(user, table, tables, with_fields=True):
    pk = _pk(table)
    person = pk if table.name == 'people' else table.c.get('person_uuid')
    named = NAMED.get(table.name)
    fuente = Fuente(key=table.name, label=named[0] if named else column_label(table.name), table=table, pk=pk,
                    label_expr=_label_expr(table), person_expr=person,
                    category='Del sistema' if named else 'Todas las tablas',
                    description=named[1] if named else f'Cada fila de la tabla {table.name}')
    if not with_fields:
        return fuente

    for col in table.columns:
        kind = kind_of(col)
        if _visible(user, col, kind):
            detail = ('Solo admin y director comercial. ' if exclusion.is_amount(col.name, kind) else '') + \
                f'Columna {col.name} de {table.name}'
            fuente.fields[f'f.{col.name}'] = Campo(f'f.{col.name}', column_label(col.name), 'Datos', kind, col, detail)

    for col in table.columns:
        parent = _parent_of(col, tables)
        if parent is None or not exclusion.sees_table(user, parent.name):
            continue
        alias = parent.alias(f'p_{col.name}')
        ppk = alias.c[_pk(parent).name]
        group = f'De {column_label(col.name).lower()}'
        allowed = exclusion.USER_PARENT_COLUMNS if parent.name == 'users' else None
        for pcol in parent.columns:
            kind = kind_of(pcol)
            if pcol.primary_key or (allowed and pcol.name not in allowed) or not _visible(user, pcol, kind):
                continue
            expr = select(alias.c[pcol.name]).where(ppk == col).scalar_subquery()
            key = f'p.{col.name}.{pcol.name}'
            label = f'{column_label(col.name)}: {column_label(pcol.name).lower()}'
            detail = f'{pcol.name} de la fila de {parent.name} en {col.name}'
            fuente.fields[key] = Campo(key, label, group, kind, expr, detail)

    if pk is not None:
        children = _children(table, tables)
        repeated = {c.name for c, _ in children if sum(1 for o, _ in children if o.name == c.name) > 1}
        for child, fk in children:
            if not exclusion.sees_table(user, child.name):
                continue
            alias = child.alias(f'n_{child.name}_{fk.name}')
            # Si la hija apunta a esta por dos columnas (closer_id y setter_id), se aclara cuál.
            name = column_label(child.name) + (f' ({fk.name})' if child.name in repeated else '')
            key = f'n.{child.name}.{fk.name}'
            expr = select(func.count()).select_from(alias).where(alias.c[fk.name] == pk).scalar_subquery()
            fuente.fields[key] = Campo(key, f'Cantidad: {name}', 'Relacionados', 'number', expr,
                                       f'Filas de {child.name} que apuntan a esta por {fk.name}')
            if 'created_at' in alias.c:
                key = f'l.{child.name}.{fk.name}'
                expr = select(func.max(alias.c.created_at)).where(alias.c[fk.name] == pk).scalar_subquery()
                fuente.fields[key] = Campo(key, f'Última: {name}', 'Relacionados', 'instant', expr,
                                           f'Cuándo se creó la última fila de {child.name} que apunta a esta')
    return fuente


def sources(user):
    """{clave: Fuente} de lo que este usuario puede consultar, sin sus campos (para listarlas). Primero las de
    nombre propio, en el orden de NAMED; después el resto por nombre. `users` no es fuente."""
    tables = _tables()
    order = list(NAMED)
    listables = (n for n, t in tables.items() if n != 'users' and _pk(t) is not None and exclusion.sees_table(user, n))
    keys = sorted(listables, key=lambda n: (n not in NAMED, order.index(n) if n in NAMED else 0, n))
    return {n: build(user, tables[n], tables, with_fields=False) for n in keys}


def source(user, key):
    tables = _tables()
    t = tables.get(key)
    if t is None or key == 'users' or _pk(t) is None or not exclusion.sees_table(user, key):
        return None
    return build(user, t, tables)
