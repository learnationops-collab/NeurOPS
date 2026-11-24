"""Las fases del setting (ADR-W184, estructura de setting de Mario, 20/11/2026). Subdividen las tres etapas
de `progreso.py`: la automática es la 1 (Apertura); la manual, de la 2 a la 6; el agendamiento, la 7 y la 8.
Dos salidas fuera del embudo: No lead e In-abrible. El guión de cada fase vive en el frontend
(`pages/inbox/conversaciones/fasesSetting.js`); acá solo los ids, el orden y el historial.

La fase la marca el setter («Adelantar» o el desplegable). Sin marcar, sale de lo que pasó, y nunca queda
detrás de lo que ya pasó (si agendó, está en Confirmación aunque haya quedado marcada en Dolor). Cada cambio
queda en `ig_fases`, con quién y cuándo: el reporte del día sale de ahí. La sub-etapa vieja (`etapa`) se
sigue llenando a partir de la fase, para lo que todavía la lee.
"""
from app import db
from app.automatizaciones.modelos import IgFase

EMBUDO = ('apertura', 'conexion', 'dolor', 'consecuencia', 'compromiso', 'propuesta', 'link', 'confirmacion')
SALIDAS = ('nolead', 'inabrible')
TODAS = EMBUDO + SALIDAS
NOMBRES = {
    'apertura': 'Apertura', 'conexion': 'Conexión', 'dolor': 'Dolor', 'consecuencia': 'Consecuencia',
    'compromiso': 'Compromiso', 'propuesta': 'Propuesta de agenda', 'link': 'Link', 'confirmacion': 'Confirmación',
    'nolead': 'No lead', 'inabrible': 'In-abrible',
}
# Las cuatro etapas del reporte del setter (Entrantes, Dolor, Oferta, Link) y la agenda.
DEL_REPORTE = {'apertura': 'entrantes', 'conexion': 'entrantes', 'dolor': 'dolor', 'consecuencia': 'dolor',
               'compromiso': 'dolor', 'propuesta': 'oferta', 'link': 'link', 'confirmacion': 'agenda'}
# La sub-etapa vieja que corresponde a cada fase.
_SUBETAPA = {'apertura': 'con_bot', 'link': 'link', 'confirmacion': 'agendo'}
CANALES = ('anuncios', 'inbound', 'bienvenida')


def derivada(avance):
    """La fase que dice lo que pasó: agendó → Confirmación; link enviado → Link; habló el equipo → Conexión."""
    etapas = avance.get('etapas') or {}
    if etapas.get('agenda') == 'completada':
        return 'confirmacion'
    if etapas.get('agenda') == 'progreso':
        return 'link'
    return 'conexion' if etapas.get('manual') not in (None, 'pendiente') else 'apertura'


def efectiva(contacto, avance):
    """La marcada, salvo que lo que pasó vaya más adelante. Las salidas (No lead, In-abrible) mandan."""
    sugerida = derivada(avance)
    if contacto.fase in SALIDAS:
        return contacto.fase
    if getattr(contacto, 'embudo_id', None):  # otro embudo (ADR-W204): su fase es la marcada
        return contacto.fase or sugerida
    if contacto.fase not in EMBUDO:
        return sugerida
    return max(contacto.fase, sugerida, key=EMBUDO.index)


def canal(contacto, asignado):
    """El marcado o, sin marcar: entró por una campaña → Anuncios; si no, Inbound."""
    if contacto.canal in CANALES:
        return contacto.canal
    return 'anuncios' if (asignado or {}).get('campana') else 'inbound'


def mover(contacto, fase, usuario_id, desde=None):
    """Marca la fase, deja el cambio en el historial y acomoda la sub-etapa vieja."""
    db.session.add(IgFase(contacto_id=contacto.id, fase=fase, desde=desde, user_id=usuario_id))
    contacto.fase = fase
    contacto.etapa = _SUBETAPA.get(fase, 'conversando' if fase in EMBUDO else contacto.etapa)


def historial(contacto_id, limite=30):
    filas = (IgFase.query.filter_by(contacto_id=contacto_id).order_by(IgFase.en.desc(), IgFase.id.desc())
             .limit(limite).all())
    return [{'fase': f.fase, 'desde': f.desde, 'por': f.usuario.username if f.usuario else None,
             'en': f.en.isoformat() + 'Z'} for f in filas]
