"""Postulación al puesto de Asistente Administrativa y Personal.

Tabla propia, aparte de `job_applications` (Closer de ventas): el formulario es
otro, las 41 preguntas no se parecen y la rúbrica de evaluación tampoco. Se
comparte el PATRÓN (upsert por `dedupe_key`, guardado progresivo, `completo`),
no la tabla.

Las respuestas de tipo radio se guardan con el texto literal de la opción que
eligió el candidato (no un enum codificado) — misma convención que
`JobApplication`: el formulario vive en otro repo (institute-site) y puede
cambiar la redacción de una opción sin que haga falta migrar nada acá.
"""
from datetime import datetime
from app import db

# Los 9 bloques del formulario, en orden, con las `id` de pregunta que le
# corresponden a cada uno. Es la misma agrupación que ve el candidato
# (`bloque` en el PREGUNTAS del formulario) y la que usa el panel para mostrar
# la postulación entera sin que sea una lista plana de 41 respuestas.
BLOQUES = [
    ("Identificación", ['pais', 'nombre', 'email', 'whatsapp', 'edad']),
    ("Requisitos", ['equipo', 'disponibilidad', 'horario', 'empleo']),
    ("Remuneración", ['confirma', 'remuneracion']),
    ("Experiencia", ['experiencia', 'digital', 'remoto', 'dinero', 'pm', 'educacion', 'area']),
    ("Idiomas", ['idioma2', 'ingles']),
    ("Herramientas", [
        'sheets', 'ia_nivel', 'ia_avanzado', 'ia_construido', 'ia_uso', 'meta',
        'meta_presupuesto', 'notion', 'wa_tools', 'automatizaciones',
        'automatizacion_ejemplo', 'diseno', 'diseno_link',
    ]),
    ("Organización", ['pendientes', 'instrucciones']),
    ("Cómo resolvés", ['retraso', 'monitor', 'martes']),
    ("Video y CV", ['video', 'video_verificado', 'cv']),
]

# Las 41 columnas que son una respuesta del formulario, en el orden en que se
# preguntan. Sirve para contar cuántas contestó alguien que no terminó sin
# depender de qué preguntas condicionales le tocaron ver (`ia_construido`,
# `ia_uso`, `meta_presupuesto`, `automatizacion_ejemplo` y `diseno_link` solo
# aparecen según respuestas anteriores) — es una cuenta aproximada.
CAMPOS_FORMULARIO = [campo for _, campos in BLOQUES for campo in campos]

# Los 4 excluyentes del bloque Requisitos: si la respuesta NO es la que se
# espera acá, el formulario cortó la postulación en el acto (`ko`). Se usa para
# distinguir un descarte automático (lo cortó el formulario) de uno manual.
EXCLUYENTES = {
    'equipo': 'Sí, las tres cosas',
    'disponibilidad': 'Sí, las 4 horas ahora y las 8 desde el tercer mes',
    'horario': 'Sí, me organizo sin problema',
}

VERIFICADO_OK = 'Sí, lo verifiqué'


class AssistantApplication(db.Model):
    """Una fila por candidato. Se actualiza (no se duplica) por `dedupe_key`:
    el formulario hace POST en CADA pregunta respondida, no solo al final."""
    __tablename__ = 'assistant_applications'

    id = db.Column(db.Integer, primary_key=True)
    dedupe_key = db.Column(db.String(64), index=True, unique=True, nullable=True)

    # --- Bloque 1 · Identificación ---
    pais = db.Column(db.String(60), nullable=True)
    nombre = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(160), nullable=True)
    whatsapp = db.Column(db.String(40), nullable=True)
    edad = db.Column(db.String(40), nullable=True)

    # --- Bloque 2 · Requisitos (excluyentes) ---
    equipo = db.Column(db.String(200), nullable=True)
    disponibilidad = db.Column(db.String(200), nullable=True)
    horario = db.Column(db.String(200), nullable=True)
    empleo = db.Column(db.String(200), nullable=True)

    # --- Bloque 3 · Remuneración ---
    confirma = db.Column(db.String(200), nullable=True)
    # Número en USD por mes, guardado como texto tal cual lo manda el formulario.
    remuneracion = db.Column(db.String(40), nullable=True)

    # --- Bloque 4 · Experiencia ---
    experiencia = db.Column(db.String(120), nullable=True)
    digital = db.Column(db.String(120), nullable=True)
    remoto = db.Column(db.String(120), nullable=True)
    dinero = db.Column(db.String(200), nullable=True)
    pm = db.Column(db.String(120), nullable=True)
    educacion = db.Column(db.String(120), nullable=True)
    area = db.Column(db.String(200), nullable=True)

    # --- Bloque 5 · Idiomas ---
    # `idioma2` es portugués o español según el país (ver el formulario).
    idioma2 = db.Column(db.String(60), nullable=True)
    ingles = db.Column(db.String(60), nullable=True)

    # --- Bloque 6 · Herramientas ---
    sheets = db.Column(db.String(120), nullable=True)
    ia_nivel = db.Column(db.String(120), nullable=True)
    ia_avanzado = db.Column(db.String(300), nullable=True)
    ia_construido = db.Column(db.Text, nullable=True)
    ia_uso = db.Column(db.Text, nullable=True)
    meta = db.Column(db.String(200), nullable=True)
    meta_presupuesto = db.Column(db.Text, nullable=True)
    notion = db.Column(db.String(200), nullable=True)
    wa_tools = db.Column(db.String(200), nullable=True)
    automatizaciones = db.Column(db.String(200), nullable=True)
    automatizacion_ejemplo = db.Column(db.Text, nullable=True)
    diseno = db.Column(db.String(300), nullable=True)
    diseno_link = db.Column(db.String(500), nullable=True)

    # --- Bloque 7 · Organización y escritura ---
    # Ojo con el nombre: es la pregunta "¿cómo manejás tus pendientes?", NO
    # tiene nada que ver con la pestaña "Pendientes" del panel.
    pendientes = db.Column(db.String(200), nullable=True)
    instrucciones = db.Column(db.Text, nullable=True)

    # --- Bloque 8 · Cómo resolvés ---
    retraso = db.Column(db.Text, nullable=True)
    monitor = db.Column(db.String(300), nullable=True)
    martes = db.Column(db.Text, nullable=True)

    # --- Bloque 9 · Video y CV ---
    video = db.Column(db.String(500), nullable=True)
    video_verificado = db.Column(db.String(60), nullable=True)
    cv = db.Column(db.String(500), nullable=True)

    # A diferencia del formulario del Closer, este tiene ramas de descarte duro
    # (`ko`): cuatro preguntas del bloque Requisitos cortan la postulación en el
    # acto. Se guarda el hecho Y el motivo para poder ver POR QUÉ alguien se
    # cayó del embudo, no solo que no terminó.
    descartado = db.Column(db.Boolean, nullable=False, default=False)
    motivo_descarte = db.Column(db.Text, nullable=True)

    # False mientras el candidato sigue respondiendo (guardado progresivo).
    completo = db.Column(db.Boolean, nullable=False, default=False)

    # Veredicto del revisor. None mientras nadie la analizó.
    # Ver `ESTADOS` más abajo.
    estado = db.Column(db.String(20), nullable=True)
    estado_motivo = db.Column(db.Text, nullable=True)
    revisado_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    revisado_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow, index=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    revisado_por = db.relationship('User', foreign_keys=[revisado_por_id])

    # ------------------------------------------------------------------ #

    def respondidas(self):
        return sum(1 for campo in CAMPOS_FORMULARIO if not _vacio(getattr(self, campo)))

    def auto_ko(self):
        """True si alguna respuesta del bloque Requisitos es excluyente. Es lo
        que distingue "lo cortó el formulario" de "lo descartó un revisor"."""
        for campo, esperado in EXCLUYENTES.items():
            valor = getattr(self, campo)
            if valor and valor != esperado:
                return True
        if self.empleo and self.empleo.startswith('Sí, tiempo completo'):
            return True
        return False

    def video_ok(self):
        return bool(self.video) and self.video_verificado == VERIFICADO_OK

    def veredicto(self):
        """Estado que ve el panel. `descartado` (del propio formulario) pisa
        todo: esa postulación ni siquiera llegó a hacerse."""
        if self.estado:
            return self.estado
        if self.descartado or self.auto_ko():
            return 'descartado'
        if not self.completo:
            return 'incompleta'
        return 'sin_analizar'

    def to_dict(self, include_respuestas=True, criterios=None):
        from app.services import assistant_clarity

        data = {
            "id": self.id,
            "dedupe_key": self.dedupe_key,
            "nombre": self.nombre,
            "email": self.email,
            "whatsapp": self.whatsapp,
            "pais": self.pais,
            "edad": self.edad,
            "veredicto": self.veredicto(),
            "estado": self.estado,
            "estado_motivo": self.estado_motivo,
            "revisado_por": self.revisado_por.username if self.revisado_por else None,
            "revisado_at": self.revisado_at.isoformat() if self.revisado_at else None,
            "descartado": bool(self.descartado),
            "motivo_descarte": self.motivo_descarte,
            "auto_ko": self.auto_ko(),
            "completo": self.completo,
            "respondidas": self.respondidas(),
            "total_preguntas": len(CAMPOS_FORMULARIO),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "score": assistant_clarity.score_de(self, criterios),
            # Columnas de señal que la tabla del inbox muestra siempre, aunque
            # no se pidan todas las respuestas.
            "remuneracion": self.remuneracion,
            "experiencia": self.experiencia,
            "ia_nivel": self.ia_nivel,
            "ia_avanzado": self.ia_avanzado,
            "sheets": self.sheets,
            "ingles": self.ingles,
            "idioma2": self.idioma2,
            "notion": self.notion,
            "meta": self.meta,
            "wa_tools": self.wa_tools,
            "automatizaciones": self.automatizaciones,
            "video": self.video,
            "video_verificado": self.video_verificado,
            "video_ok": self.video_ok(),
            "cv": self.cv,
        }
        if include_respuestas:
            for campo in CAMPOS_FORMULARIO:
                data.setdefault(campo, getattr(self, campo))
        return data

    def __repr__(self):
        return f'<AssistantApplication {self.nombre} · {self.pais}>'


def _vacio(v):
    return v is None or v == '' or v == []


# Veredictos manuales que puede poner un revisor desde el panel. Mismo criterio
# que el mockup de referencia: seleccionar / reserva / testeo / descartar /
# baja. 'descartado' acá es manual; el automático sale de `descartado` (columna)
# o de `auto_ko()`.
ESTADOS = ('seleccionada', 'en_reserva', 'testeo', 'descartado', 'baja')


class AssistantClarityWeight(db.Model):
    """Peso editable por criterio del score. Tabla propia (no se comparte con
    la del Closer): los criterios son otros. Sembrada por la migración con los
    defaults de `assistant_clarity.CLARITY_CRITERIA`."""
    __tablename__ = 'assistant_application_clarity_weights'

    id = db.Column(db.Integer, primary_key=True)
    criterion = db.Column(db.String(40), unique=True, nullable=False)
    label = db.Column(db.String(160), nullable=False)
    weight = db.Column(db.Integer, nullable=False)
    default_weight = db.Column(db.Integer, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "criterion": self.criterion,
            "label": self.label,
            "weight": self.weight,
            "default_weight": self.default_weight,
        }
