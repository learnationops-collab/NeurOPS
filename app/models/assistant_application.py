"""Postulación al puesto de Asistente Administrativa y Personal.

Tabla propia, aparte de `job_applications` (Closer de ventas): el formulario es
otro, las preguntas no se parecen y la rúbrica de evaluación tampoco. Se
comparte el PATRÓN (upsert por `dedupe_key`, guardado progresivo, `completo`),
no la tabla.

Las respuestas de tipo radio se guardan con el texto literal de la opción que
eligió el candidato (no un enum codificado) — misma convención que
`JobApplication`: el formulario vive en otro repo (institute-site) y puede
cambiar la redacción de una opción sin que haga falta migrar nada acá.
"""
import unicodedata
from datetime import datetime
from app import db
from app.models.hiring_form import COLUMNA_DE_PREGUNTA, HiringForm

# Los bloques del formulario REAL (institute-site, vacante-assistant/formulario),
# en orden, con las columnas que guarda cada uno. Son 35 preguntas. Es la misma
# agrupación que ve el candidato (`bloque` en el PREGUNTAS del formulario) y la
# que usa el panel para mostrar la postulación entera sin que sea una lista
# plana. Ojo: el formulario manda la provincia/estado como `ciudad`; el
# endpoint público la guarda en la columna `provincia`.
BLOQUES = [
    ("Identificación", ['pais', 'provincia', 'nombre', 'email', 'whatsapp', 'edad']),
    ("Requisitos", ['equipo', 'disponibilidad', 'horario', 'empleo']),
    ("Remuneración", ['confirma', 'remuneracion']),
    ("Experiencia", ['experiencia', 'digital', 'remoto', 'dinero', 'pm', 'educacion', 'area']),
    ("Idiomas", ['idioma2', 'ingles']),
    ("Herramientas", [
        'sheets', 'ia_nivel', 'ia_avanzado', 'meta', 'meta_presupuesto',
        'notion', 'wa_tools', 'automatizacion_ejemplo',
    ]),
    ("Criterio", ['aporte']),
    ("Organización", ['pendientes']),
    ("Cómo resolvés", ['retraso']),
    ("Video y CV", ['video', 'video_verificado', 'cv']),
]

# Las 35 columnas que son una respuesta del formulario actual, en el orden en
# que se preguntan.
CAMPOS_FORMULARIO = [campo for _, campos in BLOQUES for campo in campos]

# Preguntas que NO penalizan la completitud (ver `completitud()`), según la
# lógica del formulario:
#   · `automatizacion_ejemplo` es opcional (`req: false`, «si nunca armaste una,
#     seguí de largo»): nunca se espera.
#   · `meta_presupuesto` solo se muestra (y entonces es obligatoria) si en
#     `meta` eligió la opción de quien gestionó cuentas publicitarias de forma
#     habitual: solo se espera en ese caso.
# El resto de las 35 son siempre obligatorias para terminar.
OPCIONALES = ('automatizacion_ejemplo',)
META_CON_PRESUPUESTO = 'Gestioné cuentas publicitarias de forma habitual'

# Cómo se llama cada pregunta en el panel (embudo del formulario). Corto y
# legible: no es el enunciado literal del formulario.
ETIQUETAS_PREGUNTA = {
    'pais': 'País', 'provincia': 'Provincia o estado', 'nombre': 'Nombre',
    'email': 'Email', 'whatsapp': 'WhatsApp', 'edad': 'Edad',
    'equipo': 'Equipo para trabajar', 'disponibilidad': 'Disponibilidad 4 h a 8 h',
    'horario': 'Sin horario fijo', 'empleo': 'Otro empleo',
    'confirma': 'Cómo arranca el puesto', 'remuneracion': 'Cuánto pide por mes',
    'experiencia': 'Años de experiencia', 'digital': 'Negocio digital',
    'remoto': 'Trabajo remoto', 'dinero': 'Manejo de dinero',
    'pm': 'Project manager', 'educacion': 'Nivel educativo', 'area': 'Área de formación',
    'idioma2': 'Portugués o español', 'ingles': 'Inglés',
    'sheets': 'Google Sheets', 'ia_nivel': 'ChatGPT y Claude',
    'ia_avanzado': 'Lo más avanzado con IA', 'meta': 'Meta Business Suite',
    'meta_presupuesto': 'Presupuesto en Meta', 'notion': 'Notion',
    'wa_tools': 'WhatsApp masivo', 'automatizacion_ejemplo': 'Automatización armada',
    'aporte': 'Qué aporta al equipo', 'pendientes': 'Cómo maneja pendientes',
    'retraso': 'Caso: entrega atrasada', 'video': 'Video de presentación',
    'video_verificado': 'Video verificado', 'cv': 'Link al CV',
}

# Preguntas de la versión anterior del formulario (41 preguntas) que el actual
# ya no hace. Las columnas se conservan: las postulaciones viejas siguen siendo
# consultables (y el score las usa), pero no cuentan para el embudo ni para la
# completitud. Salen en `to_dict(include_respuestas=True)`.
CAMPOS_LEGACY = [
    'ia_construido', 'ia_uso', 'automatizaciones', 'diseno', 'diseno_link',
    'instrucciones', 'monitor', 'martes',
]

# Los 4 excluyentes del bloque Requisitos: si la respuesta NO es la que se
# espera acá, el formulario cortó la postulación en el acto (`ko`). Se usa para
# distinguir un descarte automático (lo cortó el formulario) de uno manual.
EXCLUYENTES = {
    'equipo': 'Sí, las tres cosas',
    'disponibilidad': 'Sí, las 4 horas ahora y las 8 desde el tercer mes',
    'horario': 'Sí, me organizo sin problema',
}

VERIFICADO_OK = 'Sí, lo verifiqué'

# Las respuestas que tienen columna propia. Una pregunta del formulario
# editable con otro id se guarda en `respuestas_extra`.
COLUMNAS_DE_RESPUESTA = frozenset(CAMPOS_FORMULARIO + CAMPOS_LEGACY)


class AssistantApplication(db.Model):
    """Una fila por candidato. Se actualiza (no se duplica) por `dedupe_key`:
    el formulario hace POST en CADA pregunta respondida, no solo al final."""
    __tablename__ = 'assistant_applications'

    id = db.Column(db.Integer, primary_key=True)
    dedupe_key = db.Column(db.String(64), index=True, unique=True, nullable=True)

    # --- Bloque 1 · Identificación ---
    pais = db.Column(db.String(60), nullable=True)
    # Provincia/estado (según el país). La manda el formulario público (otro
    # repo, institute-site) solo para decidir modalidad — ver `modalidad()`.
    provincia = db.Column(db.String(80), nullable=True)
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
    # Multi-select: el endpoint público guarda las opciones marcadas unidas con
    # " | " (cada opción es una frase larga, por eso Text y no String(300)).
    ia_avanzado = db.Column(db.Text, nullable=True)
    # ia_construido, ia_uso, automatizaciones, diseno, diseno_link, instrucciones,
    # monitor y martes: ya no se preguntan (ver CAMPOS_LEGACY).
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

    # --- Bloque 7 · Criterio ---
    aporte = db.Column(db.Text, nullable=True)

    # --- Bloque 8 · Organización y escritura ---
    # Ojo con el nombre: es la pregunta "¿cómo manejás tus pendientes?", NO
    # tiene nada que ver con la pestaña "Pendientes" del panel.
    pendientes = db.Column(db.String(200), nullable=True)
    instrucciones = db.Column(db.Text, nullable=True)

    # --- Bloque 9 · Cómo resolvés ---
    retraso = db.Column(db.Text, nullable=True)
    monitor = db.Column(db.String(300), nullable=True)
    martes = db.Column(db.Text, nullable=True)

    # --- Bloque 10 · Video y CV ---
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

    # Con qué formulario editable (HiringForm) se contestó. None en las que
    # llegaron antes de que existieran los formularios editables y no se
    # asignaron todavía (ver `asegurar_semilla` en app/services/hiring_forms.py).
    form_id = db.Column(
        db.Integer, db.ForeignKey('hiring_forms.id', ondelete='SET NULL'), nullable=True, index=True)
    # Respuestas a preguntas agregadas desde el editor, que no tienen columna
    # propia: {id de la pregunta: texto}. Siempre se reasigna el dict entero
    # (db.JSON no detecta cambios hechos adentro).
    respuestas_extra = db.Column(db.JSON, nullable=True)

    revisado_por = db.relationship('User', foreign_keys=[revisado_por_id])
    # Many-to-one: SQLAlchemy lo resuelve por el identity map, así que listar
    # cientos de postulaciones del mismo formulario hace UNA consulta, no una
    # por fila.
    form = db.relationship('HiringForm', foreign_keys=[form_id])

    # ------------------------------------------------------------------ #

    def respondidas(self):
        return sum(1 for campo in CAMPOS_FORMULARIO if not _vacio(getattr(self, campo)))

    def ultima_contestada(self):
        """Posición (en CAMPOS_FORMULARIO) de la pregunta más avanzada que
        tiene respuesta, o -1 si no hay ninguna. Se mide por «la última» y no
        por «cuáles contestó» porque las opcionales y condicionales se saltean:
        quien dejó en blanco `meta_presupuesto` pero contestó `cv` igual llegó
        hasta el final."""
        for pos in range(len(CAMPOS_FORMULARIO) - 1, -1, -1):
            if not _vacio(getattr(self, CAMPOS_FORMULARIO[pos])):
                return pos
        return -1

    def formulario(self):
        """El HiringForm con el que contestó, o None. Pasa por el identity map
        de la sesión: cientos de postulaciones del mismo formulario lo leen una
        sola vez (también las recién creadas, que todavía no lo tienen cargado)."""
        if self.form_id is None:
            return None
        return self.form or db.session.get(HiringForm, self.form_id)

    def respuesta(self, pregunta_id):
        """La respuesta a una pregunta, venga de su columna o de
        `respuestas_extra`. Acepta el id del formulario (`ciudad`) o la columna
        (`provincia`)."""
        columna = COLUMNA_DE_PREGUNTA.get(pregunta_id, pregunta_id)
        if columna in COLUMNAS_DE_RESPUESTA:
            return getattr(self, columna)
        return (self.respuestas_extra or {}).get(pregunta_id)

    def campos_apagados(self):
        """Columnas de las preguntas que su formulario tiene apagadas (no se le
        preguntaron): el score no las cuenta en contra (ver `aplica` en
        app/services/assistant_clarity.py)."""
        form = self.formulario()
        return form.campos_apagados() if form is not None else frozenset()

    def preguntas_esperadas(self):
        """Lo que el formulario le pide de verdad a ESTA postulación.

        Con formulario editable: sus preguntas prendidas y obligatorias (sin la
        intro) cuya condición `si` se cumple, con `ciudad` como `provincia`.
        Sin formulario (las de antes de que existieran): las 35 menos la
        opcional y menos la condicional que no le tocó ver."""
        form = self.formulario()
        if form is not None:
            return [
                COLUMNA_DE_PREGUNTA.get(p['id'], p['id'])
                for p in form.preguntas_obligatorias()
                if _cumple_condicion(self, form, p)
            ]
        esperadas = []
        for campo in CAMPOS_FORMULARIO:
            if campo in OPCIONALES:
                continue
            if campo == 'meta_presupuesto' and self.meta != META_CON_PRESUPUESTO:
                continue
            esperadas.append(campo)
        return esperadas

    def completitud(self):
        """Porcentaje entero 0-100 de las preguntas del formulario contestadas.

        Denominador: `preguntas_esperadas()` (con el formulario base, 33
        siempre y 34 si gestionó cuentas de Meta). Así una opcional salteada,
        una condicional que no le apareció o una pregunta apagada no baja el
        porcentaje de nadie. Si `completo` es True, 100 (terminó el formulario,
        aunque falte alguna). Mientras no esté completa, tope 99: llegar a 100
        es terminar.
        """
        if self.completo:
            return 100
        esperadas = self.preguntas_esperadas()
        if not esperadas:
            return 0
        contestadas = sum(1 for campo in esperadas if not _vacio(self.respuesta(campo)))
        return min(99, round(100 * contestadas / len(esperadas)))

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

    def modalidad(self):
        """Híbrido si vive en una provincia/estado desde donde puede ir a la
        oficina (Salta en Argentina, Paraná en Brasil); todo lo demás —
        incluido no tener `provincia` todavía— es online."""
        provincia = _normaliza(self.provincia)
        if not provincia:
            return 'online'
        pais = pais_limpio(self.pais)
        if pais == 'Argentina' and provincia == 'salta':
            return 'hibrido'
        if pais == 'Brasil' and provincia == 'parana':
            return 'hibrido'
        return 'online'

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
            "pais": pais_limpio(self.pais),
            "provincia": self.provincia,
            "modalidad": self.modalidad(),
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
            "completitud": self.completitud(),
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
            # De acá sale el ícono de automatizaciones (Zapier) de la tabla.
            "automatizacion_ejemplo": self.automatizacion_ejemplo,
            "video": self.video,
            "video_verificado": self.video_verificado,
            "video_ok": self.video_ok(),
            "cv": self.cv,
            "form_id": self.form_id,
        }
        if include_respuestas:
            for campo in CAMPOS_FORMULARIO + CAMPOS_LEGACY:
                data.setdefault(campo, getattr(self, campo))
            data["respuestas_extra"] = dict(self.respuestas_extra or {})
        return data

    def preguntas_extra(self):
        """Cómo rotular cada respuesta de `respuestas_extra`: [{id, t, bloque}],
        en el orden de su formulario. Si la pregunta ya no está (o no hay
        formulario), el rótulo es el propio id."""
        extras = self.respuestas_extra or {}
        if not extras:
            return []
        form = self.formulario()
        salida = []
        if form is not None:
            for p in form.preguntas or []:
                if isinstance(p, dict) and p.get('id') in extras:
                    salida.append({"id": p['id'], "t": p.get('t') or p['id'], "bloque": p.get('bloque')})
        ya = {e['id'] for e in salida}
        salida += [{"id": pid, "t": pid, "bloque": None} for pid in extras if pid not in ya]
        return salida

    def __repr__(self):
        return f'<AssistantApplication {self.nombre} · {self.pais}>'


def _vacio(v):
    return v is None or v == '' or v == []


# Cómo puede llamarse el valor esperado de una condición `si`, en el orden en
# que lo busca el formulario público (`cumpleSi`).
CLAVES_DE_CONDICION = ('es', 'igual', 'valor', 'en', 'valores')


def _cumple_condicion(app_row, form, pregunta, profundidad=0):
    """Si a esta postulación le tocó ver `pregunta`, con la misma regla que el
    formulario público (`cumpleSi`): `si: {id, es}` la muestra solo si la
    respuesta a `id` es `es` (o una de la lista; en una de opción múltiple
    alcanza con que esté marcada). Sin valor esperado, alcanza con que `id`
    tenga respuesta. Si la pregunta de la que depende está apagada (o tampoco
    le tocó verla), esta tampoco."""
    si = form.condicion(pregunta)
    if not isinstance(si, dict) or not si.get('id'):
        return True
    padre = form.pregunta(si['id'])
    if padre is None or padre.get('on') is False or profundidad > 8:
        return False
    if not _cumple_condicion(app_row, form, padre, profundidad + 1):
        return False

    valor = app_row.respuesta(si['id'])
    clave = next((c for c in CLAVES_DE_CONDICION if c in si), None)
    esperado = si[clave] if clave else None
    if esperado is None:
        return not _vacio(valor)
    if _vacio(valor):
        return False
    esperados = {str(e).strip() for e in (esperado if isinstance(esperado, list) else [esperado])}
    # Una de opción múltiple llega con las marcadas unidas por « | ».
    dados = {str(valor).strip()} | {v.strip() for v in str(valor).split('|')}
    return bool(esperados & dados)


def pais_limpio(texto):
    """El país sin la bandera: el formulario manda la opción tal cual se ve
    («🇦🇷  Argentina») y hay filas guardadas así. Se descarta todo lo que va
    antes de la primera letra y se juntan los espacios: «Argentina». Las filas
    viejas no se migran; se limpian al leerlas (y las nuevas, al guardarlas)."""
    if not texto:
        return texto
    texto = str(texto)
    for pos, caracter in enumerate(texto):
        if caracter.isalpha():
            return ' '.join(texto[pos:].split())
    return None


def _normaliza(texto):
    """minúsculas y sin acentos, para comparar 'Paraná'/'Parana' sin líos."""
    if not texto:
        return ''
    sin_acentos = unicodedata.normalize('NFKD', texto).encode('ascii', 'ignore').decode('ascii')
    return sin_acentos.strip().lower()


# Veredictos manuales que puede poner un revisor desde el panel. Mismo criterio
# que el mockup de referencia: seleccionar / reserva / testeo / descartar /
# baja — más 'winner'/'top_tier', los dos sub-estados de Finalistas que se
# deciden ya adentro de 'testeo' (quién quedó, quién es el backup rankeado).
ESTADOS = ('seleccionada', 'en_reserva', 'testeo', 'descartado', 'baja', 'winner', 'top_tier')


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
