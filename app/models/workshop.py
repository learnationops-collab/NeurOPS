from datetime import datetime
from app import db

class WorkshopEvent(db.Model):
    """Representa el registro consolidado de un taller o webinar con sus métricas manuales e integradas."""
    __tablename__ = 'workshop_events'
    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False, unique=True)
    name = db.Column(db.String(100), nullable=False)

    # Métricas Manuales
    inversion = db.Column(db.Float, default=0.0)
    cpm = db.Column(db.Float, default=0.0)
    cpc = db.Column(db.Float, default=0.0)
    clics = db.Column(db.Integer, default=0)
    leads = db.Column(db.Integer, default=0)
    whatsapp_leads = db.Column(db.Integer, default=0)
    show_up = db.Column(db.Integer, default=0)
    pitch_leads = db.Column(db.Integer, default=0)
    pitch_final_leads = db.Column(db.Integer, default=0)

    # Métricas Automáticas (Editables)
    aplicaciones_form = db.Column(db.Integer, default=0)
    agendas_exitosas = db.Column(db.Integer, default=0)
    show_up_sales_call = db.Column(db.Integer, default=0)
    sales = db.Column(db.Integer, default=0)
    cash_collected = db.Column(db.Float, default=0.0)

    # Base del show up de citas (24/10/2026): las personas con resultado de llamada (asistieron + no
    # show) y las que quedaron sin reportar. Null en los talleres anteriores a la columna hasta el
    # proximo recalculo; mientras, el panel divide por las agendas como antes. Ver `workshop_estados`.
    citas_reportadas = db.Column(db.Integer, nullable=True)
    citas_sin_reportar = db.Column(db.Integer, nullable=True)

    # Base del ticket promedio (02/10/2026): lo cobrado en ventas NUEVAS -- pago completo y
    # split pay, lo que acepta `_es_cierre` -- y cuantas filas de venta son. `cash_collected`
    # no sirve para el ticket porque incluye las señas (y debe: el ROAS las usa), y `sales`
    # cuenta personas, incluso a quien la hoja marca como cerrada sin la venta cargada. Null
    # en los talleres anteriores a la columna hasta que el listado de eventos los completa.
    cash_ventas = db.Column(db.Float, nullable=True)
    ventas_cobradas = db.Column(db.Integer, nullable=True)

    # Lo que dice Meta de los anuncios de embudo 'workshop' (`MetaAnuncio.embudo`) entre el
    # día siguiente al taller anterior y el día de este (15/10/2026, `workshop_meta_service`). Si
    # hay, reemplazan a la inversión, el CPM, el CPC y los clics cargados a mano (que quedan en sus
    # columnas, por si se desmarcan las campañas). `meta_impresiones` null con `meta_inversion`
    # cargada: días sincronizados antes de que se trajeran impresiones y clics; esos tres siguen a mano.
    meta_inversion = db.Column(db.Float, nullable=True)
    meta_impresiones = db.Column(db.Integer, nullable=True)
    meta_clics = db.Column(db.Integer, nullable=True)
    meta_clics_enlace = db.Column(db.Integer, nullable=True)
    # Los Leads de Meta de esos anuncios (16/10/2026): reemplazan a `leads` cargado a mano. Null si
    # algún día de la ventana se sincronizó antes de que se trajeran.
    meta_leads = db.Column(db.Integer, nullable=True)
    meta_actualizado_at = db.Column(db.DateTime, nullable=True)

    # Ultima vez que las 5 metricas automaticas de arriba se recalcularon desde
    # el sistema (agendas/ventas reales) -- ya sea por el hook de sincronizacion
    # en vivo (workshop_live_sync.py) o por un resync manual. Null si el evento
    # nunca se sincronizo (solo tiene los valores con los que se creo).
    synced_at = db.Column(db.DateTime, nullable=True)

    # Config del replay publico (institute-site/replay/) para este taller. El
    # endpoint publico /api/public/workshop-lead/replay-config sirve el ultimo
    # WorkshopEvent (por fecha) que tenga replay_loom_id cargado -- asi "el
    # replay activo" es siempre el ultimo que el director de marketing configuro,
    # sin necesitar un mecanismo de seleccion aparte (12/sep/2026).
    replay_loom_id = db.Column(db.String(64), nullable=True)
    replay_activo_desde = db.Column(db.DateTime, nullable=True)
    replay_vence_hasta = db.Column(db.DateTime, nullable=True)
    replay_info_segundos = db.Column(db.Integer, default=0)
    replay_oferta_segundos = db.Column(db.Integer, default=120)

    # La grabación completa del Meet en Google Drive (17/10/2026): el registro de lo que se dio.
    # Aparte del Loom, que es lo que muestra la landing; ver `workshop_grabaciones`.
    grabacion_url = db.Column(db.String(500), nullable=True)

    # Lo que antes vivia en workshops.csv de institute-site (15/10/2026): las landings leen
    # los proximos talleres de /api/public/workshops/proximos. `inicio_at` es el instante
    # exacto en UTC naive; el panel lo muestra y lo carga en la zona horaria de quien lo mira.
    # Sin hora cargada, el taller no aparece en las landings.
    inicio_at = db.Column(db.DateTime, nullable=True)
    meet_url = db.Column(db.String(300), nullable=True)
    whatsapp_url = db.Column(db.String(300), nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # --- Inversión, CPM, CPC y clics: de Meta si hay, si no los cargados a mano ---

    @property
    def inversion_de_meta(self):
        return self.meta_inversion is not None

    @property
    def clics_de_meta(self):
        return self.meta_inversion is not None and self.meta_impresiones is not None

    @property
    def inversion_real(self):
        return self.meta_inversion if self.inversion_de_meta else (self.inversion or 0.0)

    @property
    def cpm_real(self):
        if not self.clics_de_meta:
            return self.cpm or 0.0
        return self.meta_inversion / self.meta_impresiones * 1000 if self.meta_impresiones else 0.0

    @property
    def cpc_real(self):
        """Por clic en el ENLACE, como lo cargaba el equipo (los clics son todos los clics)."""
        if not self.clics_de_meta:
            return self.cpc or 0.0
        return self.meta_inversion / self.meta_clics_enlace if self.meta_clics_enlace else 0.0

    @property
    def leads_de_meta(self):
        return self.meta_inversion is not None and self.meta_leads is not None

    @property
    def leads_reales(self):
        return self.meta_leads if self.leads_de_meta else (self.leads or 0)

    @property
    def clics_reales(self):
        return self.meta_clics if self.clics_de_meta else (self.clics or 0)

    @property
    def impresiones(self):
        if self.clics_de_meta:
            return float(self.meta_impresiones)
        if self.cpm and self.cpm > 0:
            return (self.inversion_real / self.cpm) * 1000
        return 0.0

    @property
    def ctr(self):
        imp = self.impresiones
        if imp > 0:
            return (self.clics_reales / imp) * 100
        return 0.0

    @property
    def conversion_leads(self):
        if self.clics_reales > 0:
            return (self.leads_reales / self.clics_reales) * 100
        return 0.0

    @property
    def cpl(self):
        if self.leads_reales > 0:
            return self.inversion_real / self.leads_reales
        return 0.0

    @property
    def tx_entrada_whatsapp(self):
        if self.leads_reales > 0:
            return (self.whatsapp_leads / self.leads_reales) * 100
        return 0.0

    @property
    def show_up_rate(self):
        if self.whatsapp_leads and self.whatsapp_leads > 0:
            return (self.show_up / self.whatsapp_leads) * 100
        return 0.0

    @property
    def retencion_clase(self):
        if self.show_up and self.show_up > 0:
            return (self.pitch_leads / self.show_up) * 100
        return 0.0

    @property
    def retencion_pitch(self):
        if self.pitch_leads and self.pitch_leads > 0:
            return (self.pitch_final_leads / self.pitch_leads) * 100
        return 0.0

    @property
    def pct_aplicacion(self):
        if self.pitch_final_leads and self.pitch_final_leads > 0:
            return (self.aplicaciones_form / self.pitch_final_leads) * 100
        return 0.0

    @property
    def pct_aplicacion_agenda(self):
        if self.aplicaciones_form and self.aplicaciones_form > 0:
            return (self.agendas_exitosas / self.aplicaciones_form) * 100
        return 0.0

    @property
    def pct_conversion_agendas(self):
        if self.pitch_final_leads and self.pitch_final_leads > 0:
            return (self.agendas_exitosas / self.pitch_final_leads) * 100
        return 0.0

    @property
    def costo_por_agenda(self):
        if self.agendas_exitosas and self.agendas_exitosas > 0:
            return self.inversion_real / self.agendas_exitosas
        return 0.0

    @property
    def pct_show_up_sales_call(self):
        if self.aplicaciones_form and self.aplicaciones_form > 0:
            return (self.show_up_sales_call / self.aplicaciones_form) * 100
        return 0.0

    @property
    def pct_close_rate(self):
        if self.show_up_sales_call and self.show_up_sales_call > 0:
            return (self.sales / self.show_up_sales_call) * 100
        return 0.0

    @property
    def ticket_promedio(self):
        """Lo cobrado en ventas nuevas / cuantas son. Cuotas, señas, renovaciones y upsells
        nunca entran. None mientras el taller no tenga calculada la base (columnas nuevas en
        null): mejor no mostrar ticket que volver a la cuenta vieja, que salia inflada."""
        if self.ventas_cobradas is None:
            return None
        if self.ventas_cobradas > 0:
            return (self.cash_ventas or 0.0) / self.ventas_cobradas
        return 0.0

    @property
    def roas(self):
        if self.inversion_real > 0:
            return self.cash_collected / self.inversion_real
        return 0.0

    def to_dict(self):
        return {
            "id": self.id,
            "date": self.date.isoformat(),
            "name": self.name,
            # Los de Meta si hay (ver `meta_inversion`); los cargados a mano, aparte.
            "inversion": round(self.inversion_real, 2),
            "cpm": round(self.cpm_real, 2),
            "cpc": round(self.cpc_real, 2),
            "clics": self.clics_reales,
            "inversion_de_meta": self.inversion_de_meta,
            "clics_de_meta": self.clics_de_meta,
            "meta_actualizado_at": self.meta_actualizado_at.isoformat() if self.meta_actualizado_at else None,
            "leads_de_meta": self.leads_de_meta,
            "a_mano": {"inversion": self.inversion, "cpm": self.cpm, "cpc": self.cpc, "clics": self.clics,
                       "leads": self.leads},
            "leads": self.leads_reales,
            "whatsapp_leads": self.whatsapp_leads,
            "show_up": self.show_up,
            "pitch_leads": self.pitch_leads,
            "pitch_final_leads": self.pitch_final_leads,
            "aplicaciones_form": self.aplicaciones_form,
            "agendas_exitosas": self.agendas_exitosas,
            "show_up_sales_call": self.show_up_sales_call,
            "citas_reportadas": self.citas_reportadas,
            "citas_sin_reportar": self.citas_sin_reportar,
            "sales": self.sales,
            "cash_collected": self.cash_collected,
            "cash_ventas": self.cash_ventas,
            "ventas_cobradas": self.ventas_cobradas,
            "synced_at": self.synced_at.isoformat() if self.synced_at else None,

            "replay_loom_id": self.replay_loom_id,
            "replay_activo_desde": self.replay_activo_desde.isoformat() if self.replay_activo_desde else None,
            "replay_vence_hasta": self.replay_vence_hasta.isoformat() if self.replay_vence_hasta else None,
            "replay_info_segundos": self.replay_info_segundos,
            "replay_oferta_segundos": self.replay_oferta_segundos,
            "grabacion_url": self.grabacion_url,

            # Con 'Z': el panel lo pasa a la hora de cada navegador.
            "inicio_at": (self.inicio_at.isoformat() + 'Z') if self.inicio_at else None,
            "meet_url": self.meet_url,
            "whatsapp_url": self.whatsapp_url,

            # Calculadas
            "impresiones": round(self.impresiones, 2),
            "ctr": round(self.ctr, 2),
            "conversion_leads": round(self.conversion_leads, 2),
            "cpl": round(self.cpl, 2),
            "tx_entrada_whatsapp": round(self.tx_entrada_whatsapp, 2),
            "show_up_rate": round(self.show_up_rate, 2),
            "retencion_clase": round(self.retencion_clase, 2),
            "retencion_pitch": round(self.retencion_pitch, 2),
            "pct_aplicacion": round(self.pct_aplicacion, 2),
            "pct_aplicacion_agenda": round(self.pct_aplicacion_agenda, 2),
            "pct_conversion_agendas": round(self.pct_conversion_agendas, 2),
            "costo_por_agenda": round(self.costo_por_agenda, 2),
            "pct_show_up_sales_call": round(self.pct_show_up_sales_call, 2),
            "pct_close_rate": round(self.pct_close_rate, 2),
            "ticket_promedio": round(self.ticket_promedio, 2) if self.ticket_promedio is not None else None,
            "roas": round(self.roas, 2),
            "created_at": self.created_at.isoformat() if self.created_at else None
        }


class WorkshopGoals(db.Model):
    """Metas del sistema para las 8 etapas del embudo de un workshop (fila única,
    patrón singleton) — usadas por el Diagnóstico, el Simulador y el Plan de
    Acciones del dashboard para calcular la "fuga principal" y el impacto
    estimado de cada mejora. Valores por defecto calcados de las metas que ya
    aparecían hardcodeadas en el detalle de evento (`meta 70.0%`, etc.)."""
    __tablename__ = 'workshop_goals'
    id = db.Column(db.Integer, primary_key=True)
    meta_whatsapp = db.Column(db.Float, default=70.0)
    meta_asistencia = db.Column(db.Float, default=30.0)
    meta_retencion_clase = db.Column(db.Float, default=70.0)
    meta_retencion_pitch = db.Column(db.Float, default=50.0)
    meta_conversion_form = db.Column(db.Float, default=60.0)
    meta_agendamiento = db.Column(db.Float, default=85.0)
    meta_show_up_citas = db.Column(db.Float, default=60.0)
    meta_close_rate = db.Column(db.Float, default=20.0)
    # Cuántos puntos porcentuales por debajo de la meta todavía cuentan como
    # "al límite" en vez de "fuga" — evita que un embudo saludable con ruido
    # normal se pinte todo en rojo.
    banda_limite = db.Column(db.Float, default=5.0)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            "meta_whatsapp": self.meta_whatsapp,
            "meta_asistencia": self.meta_asistencia,
            "meta_retencion_clase": self.meta_retencion_clase,
            "meta_retencion_pitch": self.meta_retencion_pitch,
            "meta_conversion_form": self.meta_conversion_form,
            "meta_agendamiento": self.meta_agendamiento,
            "meta_show_up_citas": self.meta_show_up_citas,
            "meta_close_rate": self.meta_close_rate,
            "banda_limite": self.banda_limite,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }


class WorkshopAction(db.Model):
    """Ítem del plan de acciones del dashboard de Workshop — una mejora concreta
    atada (opcionalmente) a una de las 8 etapas del embudo, priorizada con un
    puntaje ICE-like (Valor/Velocidad/Simplicidad/Urgencia, 1-5 cada uno)."""
    __tablename__ = 'workshop_actions'
    id = db.Column(db.Integer, primary_key=True)
    stage_key = db.Column(db.String(40), nullable=True)
    title = db.Column(db.String(200), nullable=False)
    note = db.Column(db.Text, nullable=True)
    value_score = db.Column(db.Integer, default=3)
    speed_score = db.Column(db.Integer, default=3)
    simplicity_score = db.Column(db.Integer, default=3)
    urgency_score = db.Column(db.Integer, default=3)
    # Cuántos puntos porcentuales apunta a mover la etapa si se ejecuta —
    # alimenta la estimación de impacto en ventas/cash (mismo modelo lineal
    # que el Simulador).
    target_delta_pp = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default='pending')  # pending | done
    # Taller en el que hay que cumplirla (Planificar: una acción asignada a un próximo taller).
    # Opcional: las acciones de antes no tienen y se ven aparte. Al borrar el taller, queda sin.
    event_id = db.Column(db.Integer, db.ForeignKey('workshop_events.id', ondelete='SET NULL'),
                         nullable=True, index=True)
    created_by_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)

    creator = db.relationship('User', foreign_keys=[created_by_id])

    def to_dict(self):
        scores = [self.value_score, self.speed_score, self.simplicity_score, self.urgency_score]
        return {
            "id": self.id,
            "stage_key": self.stage_key,
            "title": self.title,
            "note": self.note,
            "value_score": self.value_score,
            "speed_score": self.speed_score,
            "simplicity_score": self.simplicity_score,
            "urgency_score": self.urgency_score,
            # Heurística propia de priorización (promedio simple de los 4 puntajes) —
            # no busca replicar el "score" de ninguna otra herramienta, sirve solo
            # para ordenar, no es una predicción.
            "score": round(sum(scores) / len(scores), 1),
            "target_delta_pp": self.target_delta_pp,
            "status": self.status,
            "event_id": self.event_id,
            "created_by": self.creator.username if self.creator else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None
        }

