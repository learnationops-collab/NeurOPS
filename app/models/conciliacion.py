"""La conciliación de las pasarelas (09/10/2026): lo que entró de verdad por Stripe y Hotmart.

Pedido de Kerwin: «En /finanzas agregá una pestaña de Diferencias, para agregar CSVs con datos como
los de las hojas [Stripe y Hotmart], para revisar las diferencias entre lo reportado y lo ingresado
realmente». Lo REPORTADO son las ventas del sistema (`FinancialSale`); lo INGRESADO son los cobros
que dicen los exports de cada pasarela, que se suben como CSV y viven acá. El cruce de unos con
otros se calcula cada vez (`conciliacion_service.conciliar`): lo único que se guarda de él es qué
diferencias alguien ya miró y aceptó (`ConciliacionRevision`).
"""
from datetime import datetime

from app import db


class ConciliacionCarga(db.Model):
    """Un CSV subido: de qué pasarela, cómo se llamaba, quién y cuándo, y cuántas filas trajo.

    Borrar la carga se lleva los movimientos que entraron con ella. Las filas que el archivo repetía
    de otra carga anterior no se guardaron dos veces (`ConciliacionMovimiento.clave`): siguen siendo
    de aquella.
    """
    __tablename__ = 'conciliacion_cargas'
    id = db.Column(db.Integer, primary_key=True)
    pasarela = db.Column(db.String(20), nullable=False)          # 'stripe' | 'hotmart'
    archivo = db.Column(db.String(255), nullable=True)
    filas = db.Column(db.Integer, nullable=False, default=0)       # las que se pudieron leer
    nuevas = db.Column(db.Integer, nullable=False, default=0)      # las que se guardaron
    repetidas = db.Column(db.Integer, nullable=False, default=0)   # ya estaban (otra carga o el mismo archivo)
    omitidas = db.Column(db.Integer, nullable=False, default=0)    # sin fecha o sin monto, o un cobro fallido
    subido_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    subido_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    subido_por = db.relationship('User')
    movimientos = db.relationship('ConciliacionMovimiento', backref='carga', lazy='dynamic',
                                  cascade='all, delete-orphan')


class ConciliacionMovimiento(db.Model):
    """Un cobro de una pasarela, tal como lo dice su export.

    `fecha` es la hora de la pasarela en UTC−3 sin zona (ver `conciliacion_service.ZONA`). `bruto` es
    lo que pagó el cliente, `neto` lo que llegó y `comision` la diferencia. Una fila de Hotmart sin
    precio bruto se guarda con el bruto igual al neto y `bruto_desconocido`.

    `clave` es la clave natural (pasarela, fecha, correo y bruto): volver a subir el mismo archivo, o
    uno que se pisa con otro, no duplica nada.
    """
    __tablename__ = 'conciliacion_movimientos'
    id = db.Column(db.Integer, primary_key=True)
    carga_id = db.Column(db.Integer, db.ForeignKey('conciliacion_cargas.id', ondelete='CASCADE'),
                         nullable=False, index=True)
    pasarela = db.Column(db.String(20), nullable=False)
    fecha = db.Column(db.DateTime, nullable=False, index=True)
    nombre = db.Column(db.String(255), nullable=True)
    email = db.Column(db.String(255), nullable=True)
    bruto = db.Column(db.Float, nullable=False)
    comision = db.Column(db.Float, nullable=True)
    neto = db.Column(db.Float, nullable=True)
    bruto_desconocido = db.Column(db.Boolean, nullable=False, default=False, server_default='0')
    nota = db.Column(db.Text, nullable=True)
    clave = db.Column(db.String(400), nullable=False, unique=True)


class ConciliacionRevision(db.Model):
    """Una diferencia que alguien miró y aceptó (un redondeo, un cobro que no es una venta): sale de
    los pendientes y se sigue viendo como «revisada».

    `clave` es la de la fila de la conciliación (qué venta y qué movimientos la forman, ver
    `conciliacion_service`): si después cambia el cruce —se corrigió el monto, se subió otro CSV—, la
    fila es otra y vuelve a pendientes, que es lo correcto: lo que se aceptó ya no es lo que se ve.
    """
    __tablename__ = 'conciliacion_revisiones'
    id = db.Column(db.Integer, primary_key=True)
    clave = db.Column(db.String(200), nullable=False, unique=True)
    estado = db.Column(db.String(30), nullable=True)   # el estado de la fila cuando se revisó
    nota = db.Column(db.String(500), nullable=True)
    revisada_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    revisada_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    revisada_por = db.relationship('User')
