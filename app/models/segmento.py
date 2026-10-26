from app import db


class ConSegmento:
    """El segmento A/B/C/D del lead (docs/plan_segmentos_triage.md §8): en el cliente, el de su último
    formulario; en la agenda, el del formulario con el que agendó. Lo escribe `segmento_service`."""

    segmento = db.Column(db.String(1), nullable=True, index=True)
    # Desde la versión 2026-12, la suma de los puntos del segmento (entero, puede ser negativo). Antes, de 0 a 1:
    # puntos obtenidos sobre el máximo de las preguntas del segmento que respondió.
    segmento_puntos = db.Column(db.Float, nullable=True)
    segmento_preguntas = db.Column(db.Integer, nullable=True)
    # Probabilidad de que el lead esté de verdad en ese segmento (baja cerca de un corte).
    segmento_confianza = db.Column(db.Float, nullable=True)
    segmento_version = db.Column(db.String(20), nullable=True)
