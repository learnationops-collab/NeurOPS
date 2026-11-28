"""El buscador de la bandeja (ADR-W294): por usuario o nombre, o «#texto» en lo que el equipo ya le escribió
(Elías y Paula, 27/11/2026: «nos acordamos de una palabra de una devolución y queremos copiarla»).
Sin distinguir tildes ni mayúsculas."""
import unicodedata

from app import db
from app.automatizaciones.modelos import IgContacto, IgMensaje

_CON = 'áéíóúüàèìòùÁÉÍÓÚÜÀÈÌÒÙ'
_SIN = 'aeiouuaeiouaeiouuaeiou'


def _plano(texto):
    return ''.join(c for c in unicodedata.normalize('NFD', texto.lower()) if unicodedata.category(c) != 'Mn')


def _columna(col):
    return db.func.translate(db.func.lower(col), _CON, _SIN)


def filtrar(consulta, buscar):
    """La consulta de la bandeja, filtrada por lo buscado. Devuelve (consulta, patron de mensajes o None)."""
    buscar = (buscar or '').strip()
    if not buscar:
        return consulta, None
    if buscar.startswith('#'):
        patron = f'%{_plano(buscar[1:].strip())}%'
        if patron == '%%':
            return consulta, None
        return consulta.filter(IgContacto.id.in_(db.session.query(IgMensaje.contacto_id).filter(
            IgMensaje.direccion == IgMensaje.SALIENTE, _columna(IgMensaje.texto).like(patron)))), patron
    patron = f'%{_plano(buscar)}%'
    return consulta.filter(db.or_(_columna(IgContacto.username).like(patron), _columna(IgContacto.nombre).like(patron),
                                  IgContacto.igsid.like(patron))), None


def coincidencias(ids, patron):
    """{contacto_id: {id, texto, en}}: el último mensaje del equipo que coincide, para mostrarlo en la fila."""
    if not ids or not patron:
        return {}
    filas = (IgMensaje.query.filter(IgMensaje.contacto_id.in_(ids), IgMensaje.direccion == IgMensaje.SALIENTE,
                                    _columna(IgMensaje.texto).like(patron))
             .order_by(IgMensaje.enviado_en).all())
    return {m.contacto_id: {'id': m.id, 'texto': (m.texto or '')[:300],
                            'en': m.enviado_en.isoformat() + 'Z' if m.enviado_en else None} for m in filas}
