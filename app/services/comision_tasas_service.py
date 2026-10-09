"""Los porcentajes de comisión de la nómina, editables y con vigencia (08/10/2026).

Antes vivían en el código: setters 8%, closers 10%, Marlon 5% como director y la tabla de
Fulfillment. Ahora se editan desde Payroll —admin o dirección comercial con «ver finanzas»— y cada
juego vale DESDE el mes que se elige (`ComisionTasas.vigente_desde`): el de un mes es el de la fila
más reciente que no empieza después de él. Sin ninguna fila que lo cubra valen los de fábrica, que
son los que había en el código, así que nada cambia hasta que alguien guarda un juego nuevo.

Todo en puntos porcentuales (8 = 8%). La forma del juego:

    {'setters': {'elias': 8, ...}, 'closers': {'jeancarlo': 10, ...}, 'director': {'marlon': 5},
     'fulfillment': {'andy': {'AL': [renovación, upsell, conversión, cuota], 'RR': [...], 'SI': [...]}, ...}}
"""
import copy
from datetime import datetime

from app import db

PROGRAMAS = ('AL', 'RR', 'SI')
FUENTES = ('renovacion', 'upsell', 'conversion', 'cuota')

# Quiénes cobran y cómo se llaman en pantalla: el orden es el de los tiles de Payroll.
PERSONAS = {
    'setters': [('elias', 'Elias'), ('paula', 'Paula')],
    'closers': [('jeancarlo', 'Jean Carlo'), ('facundo', 'Facundo'), ('nerina', 'Nerina'), ('gabriel', 'Gabriel'),
                ('marlon', 'Marlon')],
    'director': [('marlon', 'Marlon')],
    'fulfillment': [('andy', 'Andy'), ('dari', 'Dari'), ('santi', 'Santi'), ('belu', 'Belu'), ('pedro', 'Pedro')],
}

TASAS_DE_FABRICA = {
    'setters': {'elias': 8, 'paula': 8},
    # Nerina, Gabriel y Marlon (sus ventas propias) desde el 08/10/2026: un juego guardado antes los
    # completa con estos. El de Marlon como director es aparte, sobre las ventas de los otros.
    'closers': {'jeancarlo': 10, 'facundo': 10, 'nerina': 10, 'gabriel': 10, 'marlon': 10},
    'director': {'marlon': 5},
    # PDF «Comisiones por programa» de Fulfillment, de prueba desde septiembre de 2026.
    'fulfillment': {
        'andy': {'AL': [2, 2, 2, 1], 'RR': [2, 2, 2, 2], 'SI': [5, 5, 3, 5]},
        'dari': {'AL': [2, 2, 2, 1], 'RR': [2, 2, 2, 1], 'SI': [2, 2, 2, 1]},
        'santi': {'AL': [1, 1, 1, 1], 'RR': [1, 1, 1, 1], 'SI': [1, 1, 1, 1]},
        'belu': {'AL': [0, 1, 1, 0], 'RR': [2, 2, 2, 2], 'SI': [2, 2, 2, 2]},
        'pedro': {'AL': [0, 0, 0, 0], 'RR': [0, 1, 1, 0], 'SI': [0, 1, 1, 0]},
    },
}


class TasasInvalidas(ValueError):
    pass


def _porcentaje(valor, donde):
    try:
        n = float(valor)
    except (TypeError, ValueError):
        raise TasasInvalidas(f'{donde}: «{valor}» no es un número')
    if not 0 <= n <= 100:
        raise TasasInvalidas(f'{donde}: el porcentaje va de 0 a 100')
    return int(n) if n == int(n) else n


def normalizar(tasas):
    """Un juego completo y validado: lo que falte se completa con los de fábrica (una persona
    nueva en el código no rompe un juego guardado antes de que existiera)."""
    tasas = tasas or {}
    base = copy.deepcopy(TASAS_DE_FABRICA)
    for grupo in ('setters', 'closers', 'director'):
        for clave, _ in PERSONAS[grupo]:
            if clave in (tasas.get(grupo) or {}):
                base[grupo][clave] = _porcentaje(tasas[grupo][clave], clave)
    for clave, _ in PERSONAS['fulfillment']:
        for programa in PROGRAMAS:
            fila = ((tasas.get('fulfillment') or {}).get(clave) or {}).get(programa)
            if fila is None:
                continue
            if not isinstance(fila, list) or len(fila) != len(FUENTES):
                raise TasasInvalidas(f'{clave} · {programa}: van {len(FUENTES)} porcentajes')
            base['fulfillment'][clave][programa] = [
                _porcentaje(v, f'{clave} · {programa} · {f}') for v, f in zip(fila, FUENTES)]
    return base


def _valida_mes(mes):
    try:
        datetime.strptime(mes or '', '%Y-%m')
    except ValueError:
        raise TasasInvalidas('El mes va como YYYY-MM')
    return mes


def vigentes(mes):
    """(tasas, vigente_desde) del mes 'YYYY-MM'. `vigente_desde` es None con los de fábrica."""
    from app.models.financial import ComisionTasas

    fila = (ComisionTasas.query.filter(ComisionTasas.vigente_desde <= mes)
            .order_by(ComisionTasas.vigente_desde.desc()).first())
    if not fila:
        return copy.deepcopy(TASAS_DE_FABRICA), None
    return normalizar(fila.tasas), fila.vigente_desde


def por_mes():
    """Una función mes -> tasas que pide cada mes a la base una sola vez (la nómina de un rango
    pregunta por venta)."""
    cache = {}

    def tasas_de(mes):
        if mes not in cache:
            cache[mes] = vigentes(mes)[0]
        return cache[mes]
    return tasas_de


def guardar(vigente_desde, tasas, usuario=None):
    """Guarda (o reemplaza) el juego que vale desde `vigente_desde`. Devuelve el juego normalizado."""
    from app.models.financial import ComisionTasas

    _valida_mes(vigente_desde)
    juego = normalizar(tasas)
    fila = ComisionTasas.query.filter_by(vigente_desde=vigente_desde).first()
    if not fila:
        fila = ComisionTasas(vigente_desde=vigente_desde)
        db.session.add(fila)
    fila.tasas = juego
    fila.editado_por_id = getattr(usuario, 'id', None)
    fila.updated_at = datetime.utcnow()
    db.session.commit()
    return juego


def historial():
    """Los juegos guardados, del más nuevo al más viejo, con quién los tocó por última vez."""
    from app.models import User
    from app.models.financial import ComisionTasas

    filas = ComisionTasas.query.order_by(ComisionTasas.vigente_desde.desc()).all()
    nombres = {u.id: u.username for u in User.query.filter(
        User.id.in_([f.editado_por_id for f in filas if f.editado_por_id])).all()} if filas else {}
    return [{'vigente_desde': f.vigente_desde, 'editado_por': nombres.get(f.editado_por_id),
             'actualizado': f.updated_at.isoformat() if f.updated_at else None} for f in filas]
