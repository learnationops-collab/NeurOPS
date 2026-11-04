"""La Momentum con un closer bajo el mismo criterio que el link de Thalamus: después de la sesión queda
el margen del closer (el de su Sesión de Aceleración), y para ver si choca se mira que los bloques
(sesión + margen) se pisen, no solo que empiecen a la misma hora. Lo usa app/api/external/agenda.py."""

from app import db
from app.agendas_v2 import servicio
from app.agendas_v2.nucleo.disponibilidad import se_solapa

LEIDO_ANTES_MS = 4 * 3600000  # una agenda que empezó hasta 4 h antes todavía puede ocupar


def margen_de(user):
    """Los minutos que el closer deja libres después de una llamada de closing (0 si no está en Team)."""
    from app.agendas_v2.a_triage import sesion_closing_de

    return int((sesion_closing_de(user) or {}).get('margen_min') or 0)


def ocupado_en_work(user, desde_ms, franjas, libres):
    """[{inicio, fin}] (ms) de sus agendas vigentes en Work, con el margen de cada una. `franjas`: lo leído
    de su Google (o None). `libres`: [(id, inicio, fin)] de las C/D que la Momentum puede tomar (no cuentan)."""
    agendas = servicio._agendas_de_operacion(
        {user.id: user.id}, servicio.ms_a_dt(desde_ms), {user.id: franjas}, leido_desde=desde_ms,
        excluir={i for i, _, _ in libres})
    return [{'inicio': a['inicio_ms'], 'fin': a['fin_ms'] + int(a['margen_min'] or 0) * 60000} for a in agendas]


def choca(user, inicio_ms, fin_ms, libres):
    """Si [inicio, fin) (ms, sesión + margen) se pisa con otra agenda vigente suya en Work, sin contar las
    C/D `libres`: lo mismo que se le ofreció como libre en /horarios. Deja al closer bloqueado hasta el
    próximo commit, para que dos reservas a la vez no tomen el mismo hueco."""
    from app.models import User

    desde = inicio_ms - LEIDO_ANTES_MS
    franjas = servicio._franjas_google(user.id, desde, fin_ms)  # antes del bloqueo: leer Google puede hacer commit
    db.session.query(User).filter_by(id=user.id).with_for_update().first()
    return se_solapa(ocupado_en_work(user, desde, franjas, libres), inicio_ms, (fin_ms - inicio_ms) // 60000)
