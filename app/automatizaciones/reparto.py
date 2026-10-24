"""A qué setter le toca cada entrada de una campaña (19/10/2026). Reemplaza al reparto de ManyChat.

  · **Continuidad**: si la persona ya tuvo un setter (en cualquier campaña) y sigue siendo un setter
    activo, se queda con ese: no se le corta la conversación que ya lleva en Kommo.
  · **Distribuido**: si no, al participante al que más le falta para su parte de las entradas de la
    campaña en las últimas 24 h (cuenta personas nuevas, no reingresos). Cada uno tiene un peso (70 y 30: 70 % y 30 %; todos en 1: parejo) y
    se elige al de menor (entradas + 1) / peso; desempata el que hace más que no recibe. Así un setter
    que se suma a mitad del día se pone al día.
  · **Sin reparto**: nadie; el lead lo ve todo el equipo, como los que ManyChat todavía no repartió.

Participan los setters elegidos en la campaña o, si no eligió ninguno, todos los activos.

«Solo entre conectados» todavía no filtra: no hay presencia hasta que los setters trabajen en la
bandeja propia del Inbox. `conectados()` es el punto donde se va a enchufar; mientras devuelva None, la
opción queda guardada sin efecto (la pantalla lo avisa).
"""
from datetime import timedelta
from fractions import Fraction

from app import db
from app.automatizaciones.modelos import AutEjecucion
from app.models import User
from app.models.user import ROLE_SETTER

VENTANA = timedelta(hours=24)


def setters_activos():
    return User.query.filter(User.role == ROLE_SETTER, User.is_active.is_(True)).order_by(User.id).all()


def conectados():
    """Los ids de los setters conectados, o None si todavía no hay forma de saberlo."""
    return None


def _participantes(campana):
    activos = setters_activos()
    elegidos = {s.user_id for s in campana.setters}
    candidatos = [u for u in activos if u.id in elegidos] if elegidos else activos
    online = conectados() if campana.solo_conectados else None
    if online is not None:
        candidatos = [u for u in candidatos if u.id in online] or candidatos  # nadie conectado: entre todos
    return candidatos


def _anterior(contacto_id):
    """El último setter que tuvo la persona, si sigue activo."""
    setter_id = (db.session.query(AutEjecucion.setter_id)
                 .filter(AutEjecucion.contacto_id == contacto_id, AutEjecucion.setter_id.isnot(None))
                 .order_by(AutEjecucion.iniciada_en.desc(), AutEjecucion.id.desc()).limit(1).scalar())
    if setter_id is None:
        return None
    return next((u for u in setters_activos() if u.id == setter_id), None)


def elegir(campana, contacto_id, ahora):
    """El setter (User) para una entrada nueva de esa persona por esa campaña, o None."""
    if campana.reparto != 'distribuido':
        return None
    anterior = _anterior(contacto_id)
    if anterior:
        return anterior
    candidatos = _participantes(campana)
    if not candidatos:
        return None
    pesos = {s.user_id: max(s.peso or 1, 1) for s in campana.setters}
    desde = ahora - VENTANA
    previa = db.aliased(AutEjecucion)
    # Solo cuentan las asignaciones nuevas: quien vuelve y sigue con el mismo setter no consume su parte.
    continuidad = db.exists().where(previa.contacto_id == AutEjecucion.contacto_id,
                                    previa.setter_id == AutEjecucion.setter_id, previa.id < AutEjecucion.id)
    filas = (db.session.query(AutEjecucion.setter_id, db.func.count(AutEjecucion.id),
                              db.func.max(AutEjecucion.iniciada_en))
             .filter(AutEjecucion.campana_id == campana.id, AutEjecucion.setter_id.in_([u.id for u in candidatos]),
                     AutEjecucion.iniciada_en >= desde, ~continuidad)
             .group_by(AutEjecucion.setter_id).all())
    carga = {sid: (n, ultima) for sid, n, ultima in filas}

    def falta(u):
        n, ultima = carga.get(u.id, (0, desde))
        # Fracción exacta: 2/70 contra 3/105 tiene que empatar, no depender de decimales.
        return Fraction(n + 1, pesos.get(u.id, 1)), ultima, u.id

    # Quien iría más atrás con esta entrada; a igual proporción, el que hace más que no recibe.
    return min(candidatos, key=falta)
