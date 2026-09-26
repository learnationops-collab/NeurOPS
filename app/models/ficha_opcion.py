from datetime import datetime

from app import db


class FichaOpcion(db.Model):
    """Una opcion de vocabulario que el equipo creo a mano desde la ficha del lead.

    Los grupos "Otros" de «Cómo viene», «Dolores», «Motivos de descarte» y «Motivos de baja» nacen
    vacios a proposito: el vocabulario real lo va escribiendo el equipo mientras trabaja, y una
    opcion que alguien agrega tiene que aparecerle a todos en la lectura siguiente. Por eso la
    tabla es global (no por usuario) y no hay un modelo existente que sirva: `UserViewSetting`
    guarda preferencias de UNA persona e `Integration` es el registro de servicios externos.

    Minima a proposito: no hay orden, ni activo/inactivo, ni jerarquia de grupos. El grupo y el
    tono de las opciones de fabrica viven en codigo (`app/services/ficha_vocabulario.py`); aca solo
    se guardan las que no estaban previstas.
    """
    __tablename__ = 'ficha_opciones'

    id = db.Column(db.Integer, primary_key=True)
    # 'como_viene' | 'dolores' | 'motivos_descarte' | 'motivos_baja'
    grupo = db.Column(db.String(40), nullable=False, index=True)
    clave = db.Column(db.String(80), nullable=False)
    label = db.Column(db.String(120), nullable=False)
    creada_por_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    creada_por = db.relationship('User')

    __table_args__ = (
        # Volver a agregar la misma opcion no la duplica: la ficha la reusa.
        db.UniqueConstraint('grupo', 'clave', name='uq_ficha_opciones_grupo_clave'),
    )

    def to_dict(self):
        return {'clave': self.clave, 'label': self.label}
