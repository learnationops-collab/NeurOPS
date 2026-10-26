"""La configuración de cada usuario (`user_settings`, docs/plan_notas_avisos_settings.md §2.4).

El catálogo es el único lugar donde se declara una clave: su valor por defecto. Leer una clave que el
usuario nunca guardó devuelve ese default, así que no hace falta crear filas para nadie.
"""
from copy import deepcopy

from app import db
from app.models import UserSetting

CATALOGO = {
    # Los widgets del dashboard del admin (app/api/analytics.py).
    'admin_dashboard': [
        {"id": "w1", "type": "stat", "metric": "agendas", "w": 1, "h": 2, "x": 0, "y": 0},
        {"id": "w2", "type": "stat", "metric": "sales", "w": 1, "h": 2, "x": 1, "y": 0},
        {"id": "w3", "type": "grafico", "metric": "cash_collect", "w": 3, "h": 2, "x": 2, "y": 0},
    ],
    # Por tipo de aviso, los canales elegidos: {"nota": ["centro"]}. Sin el tipo, vale el default del
    # catálogo de avisos (avisos_service.TIPOS).
    'avisos': {},
}


def _validar(clave):
    if clave not in CATALOGO:
        raise KeyError(f'Configuración desconocida: {clave}')


def leer(user_id, clave):
    _validar(clave)
    fila = UserSetting.query.filter_by(user_id=user_id, clave=clave).first()
    return fila.valor if fila and fila.valor is not None else deepcopy(CATALOGO[clave])


def guardar(user_id, clave, valor):
    """Guarda y hace commit."""
    _validar(clave)
    fila = UserSetting.query.filter_by(user_id=user_id, clave=clave).first()
    if fila:
        fila.valor = valor
    else:
        db.session.add(UserSetting(user_id=user_id, clave=clave, valor=valor))
    db.session.commit()
    return valor
