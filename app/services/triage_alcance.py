"""Lo que ve una triage de las métricas del equipo (`triage_service.metricas`): lo suyo entero y, para
compararse, las cifras de cada compañera en `por_persona`, sin sus leads (pedido de Marlon, 09/11/2026)."""


def solo_de(datos, triage_id):
    """Las métricas del equipo acotadas a `triage_id`: su total, sus días, sus pases y sus leads."""
    from app.services.triage_service import _vacias

    yo = next((p for p in datos['por_persona'] if p['id'] == triage_id), None)
    nombre = yo['nombre'] if yo else None
    return {
        **datos,
        'total': {k: v for k, v in yo.items() if k not in ('id', 'nombre')} if yo else _vacias(),
        'por_dia': [d for d in datos['por_dia'] if d['id'] == triage_id],
        'por_closer': [f for f in datos['por_closer'] if f['triage_id'] == triage_id],
        'leads': [l for l in datos['leads'] if nombre and l['triage'] == nombre],
        'yo': triage_id,
    }
