"""Poner, sacar y listar etiquetas (`app/models/tag.py`), para cualquier `target_type`."""
from app import db
from app.models.tag import Tag, TagGroup

# Paleta categórica de Thalamus (--fc-*): cada grupo nuevo toma el color siguiente.
PALETA = ('#317DE9', '#C06F0A', '#D6459B', '#3B9555', '#7D63E6', '#13918B')
LARGO = 60


class EtiquetaInvalida(ValueError):
    pass


def _dict(tag):
    grupo = tag.group
    return {'id': tag.id, 'name': tag.name, 'group_id': tag.tag_group_id,
            'group': grupo.name if grupo else None, 'color': grupo.color if grupo else None}


def de(target_type, target_ids):
    """{target_id: [etiquetas]} de varios a la vez, en una consulta."""
    ids = [str(i) for i in target_ids]
    if not ids:
        return {}
    salida = {}
    filas = (Tag.query.filter(Tag.target_type == target_type, Tag.target_id.in_(ids))
             .order_by(Tag.tag_group_id, Tag.name).all())
    for tag in filas:
        salida.setdefault(tag.target_id, []).append(_dict(tag))
    return salida


def catalogo(target_type):
    """Los grupos con las etiquetas que ya se usaron en cada uno (y cuántas veces), y las sueltas."""
    usos = (db.session.query(Tag.tag_group_id, Tag.name, db.func.count(Tag.id))
            .filter(Tag.target_type == target_type).group_by(Tag.tag_group_id, Tag.name).all())
    por_grupo = {}
    for grupo_id, nombre, n in usos:
        por_grupo.setdefault(grupo_id, []).append({'name': nombre, 'n': n})
    grupos = [{'id': g.id, 'name': g.name, 'color': g.color, 'exclusive': g.exclusive,
               'tags': sorted(por_grupo.get(g.id, []), key=lambda t: t['name'].lower())}
              for g in TagGroup.query.order_by(TagGroup.name).all()]
    return {'grupos': grupos, 'sueltas': sorted(por_grupo.get(None, []), key=lambda t: t['name'].lower())}


def crear_grupo(nombre, exclusive, usuario_id, color=None):
    nombre = (nombre or '').strip()[:LARGO]
    if not nombre:
        raise EtiquetaInvalida('El grupo necesita un nombre')
    if TagGroup.query.filter(db.func.lower(TagGroup.name) == nombre.lower()).first():
        raise EtiquetaInvalida('Ya hay un grupo con ese nombre')
    grupo = TagGroup(name=nombre, exclusive=bool(exclusive), created_by=usuario_id,
                     color=color or PALETA[TagGroup.query.count() % len(PALETA)])
    db.session.add(grupo)
    db.session.flush()
    return grupo


def poner(target_type, target_id, grupo_id, nombre, usuario_id):
    """Pone la etiqueta (si ya la tenía, no duplica). En un grupo exclusivo, saca las otras del grupo."""
    nombre = (nombre or '').strip()[:LARGO]
    if not nombre:
        raise EtiquetaInvalida('La etiqueta necesita un nombre')
    grupo = db.session.get(TagGroup, grupo_id) if grupo_id else None
    if grupo_id and grupo is None:
        raise EtiquetaInvalida('Ese grupo no existe')
    del_target = Tag.query.filter_by(target_type=target_type, target_id=str(target_id), tag_group_id=grupo_id)
    # Mismo nombre sin importar mayúsculas: «caliente» es la «Caliente» que ya existe en el grupo.
    existente = (db.session.query(Tag.name).filter(Tag.tag_group_id == grupo_id, db.func.lower(Tag.name) == nombre.lower())
                 .limit(1).scalar())
    nombre = existente or nombre
    ya = del_target.filter(Tag.name == nombre).first()
    if ya:
        return ya
    if grupo and grupo.exclusive:
        del_target.delete(synchronize_session=False)
    tag = Tag(tag_group_id=grupo_id, name=nombre, target_type=target_type, target_id=str(target_id), created_by=usuario_id)
    db.session.add(tag)
    db.session.flush()
    return tag


def sacar(target_type, target_id, tag_id):
    tag = Tag.query.filter_by(id=tag_id, target_type=target_type, target_id=str(target_id)).first()
    if tag:
        db.session.delete(tag)


def editar_grupo(grupo, datos):
    if 'name' in datos:
        nombre = (datos.get('name') or '').strip()[:LARGO]
        if not nombre:
            raise EtiquetaInvalida('El grupo necesita un nombre')
        grupo.name = nombre
    if 'color' in datos and datos['color']:
        grupo.color = str(datos['color'])[:20]
    if 'exclusive' in datos:
        grupo.exclusive = bool(datos['exclusive'])


def borrar_etiqueta(target_type, grupo_id, nombre):
    """Saca esa etiqueta de todo lo que la tiene (la etiqueta deja de existir)."""
    Tag.query.filter_by(target_type=target_type, tag_group_id=grupo_id, name=nombre).delete(synchronize_session=False)
