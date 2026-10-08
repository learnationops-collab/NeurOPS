"""Formularios de postulación editables desde el panel de Hiring.

Hasta ahora el formulario público de Asistente era HTML estático en otro repo
(institute-site) con las preguntas escritas en un array `PREGUNTAS`. Acá se
guarda ese mismo array como JSON, con el MISMO esquema de pregunta (claves `id`,
`tipo`, `t`, `h`, `o`, `req`, `si`…), para que el editor del panel lo cambie y
el formulario público lo lea de la API. Las preguntas no se interpretan acá más
de lo necesario: lo que el backend no entiende lo guarda tal cual (ver
`app/services/hiring_forms.py`).

Puede haber varios formularios (borradores, copias), pero uno solo `activo`: es
el que sirve el endpoint público.
"""
from datetime import datetime

from app import db

# Defaults de la configuración de la búsqueda cuando todavía nadie la guardó. La
# tasa es la misma referencia USD -> BRL que usa hoy el formulario público
# (`TASA_BRL`), con la que le muestra a quien vive en Brasil cuánto son sus
# dólares en reales.
PUESTO_DEFAULT = 'Asistente Administrativa y Personal'
PRESUPUESTO_MIN_DEFAULT = 200
PRESUPUESTO_MAX_DEFAULT = 400
TASA_BRL_DEFAULT = 5.4

# El formulario manda la provincia/estado como `ciudad`; la columna de
# `AssistantApplication` se llama `provincia` (ver ALIAS en el endpoint público).
COLUMNA_DE_PREGUNTA = {'ciudad': 'provincia'}


class HiringForm(db.Model):
    __tablename__ = 'hiring_forms'

    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(120), nullable=False)
    # A lo sumo uno en True: lo garantizan los endpoints de activar (no hay un
    # índice parcial para no depender del motor).
    activo = db.Column(db.Boolean, nullable=False, default=False)
    # Lista de preguntas con el esquema del `PREGUNTAS` del formulario público,
    # más dos claves del editor: `on` (si se pregunta) y `base` (si es una de
    # las 35 originales, que se pueden apagar pero no borrar).
    preguntas = db.Column(db.JSON, nullable=False, default=list)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # ------------------------------------------------------------------ #

    def _derivados(self):
        """Lo que se calcula de las preguntas y se consulta por CADA postulación
        (completitud, score): se arma una vez por lista de preguntas. La clave es
        la identidad de la lista: un PUT asigna una lista nueva y lo invalida."""
        cache = self.__dict__.get('_cache_derivados')
        if cache is not None and cache[0] is self.preguntas:
            return cache[1]
        preguntas = [p for p in (self.preguntas or []) if isinstance(p, dict)]
        derivados = {
            'por_id': {p.get('id'): p for p in preguntas},
            # Columnas de las preguntas apagadas (para el score).
            'apagadas': frozenset(
                COLUMNA_DE_PREGUNTA.get(p.get('id'), p.get('id'))
                for p in preguntas if p.get('on') is False
            ),
            # Las que cuentan para la completitud antes de mirar condiciones.
            'obligatorias': [
                p for p in preguntas
                if p.get('on') is not False and p.get('req', True) and p.get('tipo') != 'intro'
            ],
            # {id de pregunta prendida: textos de sus opciones excluyentes}. Una opción sin
            # marcas viene como texto suelto (no puede ser excluyente).
            'excluyentes': {
                p.get('id'): frozenset(
                    str(o.get('t') or '').strip() for o in (p.get('o') or [])
                    if isinstance(o, dict) and o.get('ko')
                )
                for p in preguntas
                if p.get('on') is not False and any(isinstance(o, dict) and o.get('ko') for o in (p.get('o') or []))
            },
        }
        self.__dict__['_cache_derivados'] = (self.preguntas, derivados)
        return derivados

    def pregunta(self, pregunta_id):
        return self._derivados()['por_id'].get(pregunta_id)

    def condicion(self, pregunta):
        """La condición `si` de una pregunta. Si es una de las base y el editor
        la mandó SIN la clave `si` (no con null), vale la original, igual que en
        el formulario público (`HEREDABLES`)."""
        if 'si' in pregunta:
            return pregunta['si']
        from app.services.hiring_forms import PREGUNTAS_BASE_POR_ID
        base = PREGUNTAS_BASE_POR_ID.get(pregunta.get('id'))
        return base.get('si') if base and base.get('tipo') == pregunta.get('tipo') else None

    def campos_apagados(self):
        return self._derivados()['apagadas']

    def excluyentes(self):
        """{id de pregunta: textos de las opciones que cortan la postulación}, solo
        de las preguntas prendidas. Es lo que el formulario público usa para mandar
        a la pantalla de descarte."""
        return self._derivados()['excluyentes']

    def preguntas_obligatorias(self):
        return self._derivados()['obligatorias']

    def __repr__(self):
        return f'<HiringForm {self.id} {self.nombre}{" (activo)" if self.activo else ""}>'


class HiringConfig(db.Model):
    """Datos de la búsqueda que se muestran en el formulario público y en el
    panel. Una sola fila: si no existe, valen los defaults de arriba."""
    __tablename__ = 'hiring_config'

    id = db.Column(db.Integer, primary_key=True)
    puesto = db.Column(db.String(160), nullable=False, default=PUESTO_DEFAULT)
    cierre = db.Column(db.Date, nullable=True)
    presupuesto_min = db.Column(db.Integer, nullable=False, default=PRESUPUESTO_MIN_DEFAULT)
    presupuesto_max = db.Column(db.Integer, nullable=False, default=PRESUPUESTO_MAX_DEFAULT)
    tasa_brl = db.Column(db.Float, nullable=False, default=TASA_BRL_DEFAULT)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @staticmethod
    def vigente():
        """La fila guardada, o una sin guardar con los defaults."""
        return HiringConfig.query.order_by(HiringConfig.id).first() or HiringConfig(
            puesto=PUESTO_DEFAULT, cierre=None,
            presupuesto_min=PRESUPUESTO_MIN_DEFAULT, presupuesto_max=PRESUPUESTO_MAX_DEFAULT,
            tasa_brl=TASA_BRL_DEFAULT,
        )

    def to_dict(self):
        return {
            "puesto": self.puesto,
            "cierre": self.cierre.isoformat() if self.cierre else None,
            "presupuesto_min": self.presupuesto_min,
            "presupuesto_max": self.presupuesto_max,
            "tasa_brl": self.tasa_brl,
        }
