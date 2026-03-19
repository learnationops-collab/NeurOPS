from app import db

class TriageTrackerReport(db.Model):
    """Reporte detallado de seguimiento (Tracker) del rol de Triage."""
    __tablename__ = 'triage_tracker_reports'

    id = db.Column(db.Integer, primary_key=True)
    triage_name = db.Column(db.String(100), nullable=False, default='Kerwin')
    date = db.Column(db.Date, nullable=False)

    # ==========================
    # Starting Process - 1st Call
    # ==========================
    starting_1st_call_agendas = db.Column(db.Integer, default=0)
    starting_1st_call_confirmando = db.Column(db.Integer, default=0)
    starting_1st_call_reprogramando = db.Column(db.Integer, default=0)
    starting_1st_call_confirmadas = db.Column(db.Integer, default=0)
    starting_1st_call_canceladas = db.Column(db.Integer, default=0)

    # ==========================
    # Starting Process - 2nd Call
    # ==========================
    starting_2nd_call_agendas = db.Column(db.Integer, default=0)
    starting_2nd_call_confirmando = db.Column(db.Integer, default=0)
    starting_2nd_call_reprogramando = db.Column(db.Integer, default=0)
    starting_2nd_call_confirmadas = db.Column(db.Integer, default=0)
    starting_2nd_call_canceladas = db.Column(db.Integer, default=0)

    # ==========================
    # All of Them - 1st Call
    # ==========================
    all_1st_call_agendas = db.Column(db.Integer, default=0)
    all_1st_call_confirmando = db.Column(db.Integer, default=0)
    all_1st_call_reprogramando = db.Column(db.Integer, default=0)
    all_1st_call_confirmadas = db.Column(db.Integer, default=0)
    all_1st_call_canceladas = db.Column(db.Integer, default=0)

    # ==========================
    # All of Them - 2nd Call
    # ==========================
    all_2nd_call_agendas = db.Column(db.Integer, default=0)
    all_2nd_call_confirmando = db.Column(db.Integer, default=0)
    all_2nd_call_reprogramando = db.Column(db.Integer, default=0)
    all_2nd_call_confirmadas = db.Column(db.Integer, default=0)
    all_2nd_call_canceladas = db.Column(db.Integer, default=0)

    # ==========================
    # Post Confirmation Process
    # ==========================
    post_hoy_confirmadas = db.Column(db.Integer, default=0)
    post_hoy_ppc_completo = db.Column(db.Integer, default=0)
    post_all_confirmadas = db.Column(db.Integer, default=0)
    post_all_ppc_completo = db.Column(db.Integer, default=0)

    # ==========================
    # Follow Up Process - Cold
    # ==========================
    fu_cold_personas_disp_fu = db.Column(db.Integer, default=0)
    fu_cold_mjes_realizados = db.Column(db.Integer, default=0)
    fu_cold_personas_realizados = db.Column(db.Integer, default=0)
    fu_cold_personas_respondidos = db.Column(db.Integer, default=0)

    # ==========================
    # Follow Up Process - Warm
    # ==========================
    fu_warm_personas_disp_fu = db.Column(db.Integer, default=0)
    fu_warm_mjes_realizados = db.Column(db.Integer, default=0)
    fu_warm_personas_realizados = db.Column(db.Integer, default=0)
    fu_warm_personas_respondidos = db.Column(db.Integer, default=0)

    # ==========================
    # Follow Up Process - Hot
    # ==========================
    fu_hot_personas_disp_fu = db.Column(db.Integer, default=0)
    fu_hot_mjes_realizados = db.Column(db.Integer, default=0)
    fu_hot_personas_realizados = db.Column(db.Integer, default=0)
    fu_hot_personas_respondidos = db.Column(db.Integer, default=0)

    __table_args__ = (db.UniqueConstraint('triage_name', 'date', name='_triage_tracker_date_uc'),)

    def to_dict(self):
        return {
            "id": self.id,
            "triage_name": self.triage_name,
            "date": self.date.isoformat() if self.date else None,
            
            "starting_1st_call_agendas": self.starting_1st_call_agendas,
            "starting_1st_call_confirmando": self.starting_1st_call_confirmando,
            "starting_1st_call_reprogramando": self.starting_1st_call_reprogramando,
            "starting_1st_call_confirmadas": self.starting_1st_call_confirmadas,
            "starting_1st_call_canceladas": self.starting_1st_call_canceladas,

            "starting_2nd_call_agendas": self.starting_2nd_call_agendas,
            "starting_2nd_call_confirmando": self.starting_2nd_call_confirmando,
            "starting_2nd_call_reprogramando": self.starting_2nd_call_reprogramando,
            "starting_2nd_call_confirmadas": self.starting_2nd_call_confirmadas,
            "starting_2nd_call_canceladas": self.starting_2nd_call_canceladas,

            "all_1st_call_agendas": self.all_1st_call_agendas,
            "all_1st_call_confirmando": self.all_1st_call_confirmando,
            "all_1st_call_reprogramando": self.all_1st_call_reprogramando,
            "all_1st_call_confirmadas": self.all_1st_call_confirmadas,
            "all_1st_call_canceladas": self.all_1st_call_canceladas,

            "all_2nd_call_agendas": self.all_2nd_call_agendas,
            "all_2nd_call_confirmando": self.all_2nd_call_confirmando,
            "all_2nd_call_reprogramando": self.all_2nd_call_reprogramando,
            "all_2nd_call_confirmadas": self.all_2nd_call_confirmadas,
            "all_2nd_call_canceladas": self.all_2nd_call_canceladas,

            "post_hoy_confirmadas": self.post_hoy_confirmadas,
            "post_hoy_ppc_completo": self.post_hoy_ppc_completo,
            "post_all_confirmadas": self.post_all_confirmadas,
            "post_all_ppc_completo": self.post_all_ppc_completo,

            "fu_cold_personas_disp_fu": self.fu_cold_personas_disp_fu,
            "fu_cold_mjes_realizados": self.fu_cold_mjes_realizados,
            "fu_cold_personas_realizados": self.fu_cold_personas_realizados,
            "fu_cold_personas_respondidos": self.fu_cold_personas_respondidos,

            "fu_warm_personas_disp_fu": self.fu_warm_personas_disp_fu,
            "fu_warm_mjes_realizados": self.fu_warm_mjes_realizados,
            "fu_warm_personas_realizados": self.fu_warm_personas_realizados,
            "fu_warm_personas_respondidos": self.fu_warm_personas_respondidos,

            "fu_hot_personas_disp_fu": self.fu_hot_personas_disp_fu,
            "fu_hot_mjes_realizados": self.fu_hot_mjes_realizados,
            "fu_hot_personas_realizados": self.fu_hot_personas_realizados,
            "fu_hot_personas_respondidos": self.fu_hot_personas_respondidos,
        }
