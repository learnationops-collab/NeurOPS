"""Aplicaciones de Agendas 2.0 que no llegaron a agendar (24/10/2026).

En Agendas 2.0 el formulario de un lead se guarda recien cuando AGENDA (`formulario_payload`). Quien
lo llena y no agenda queda como `SchedIntento` (se borra si despues agenda). Sin sumarlos, "Aplicaron"
era casi igual a "Agendaron": el agendamiento daba 81-91% por construccion, no por rendimiento.

Cuentan como aplicacion los intentos del funnel `workshop` que COMPLETARON el formulario: los
descalificados (respondieron y el formulario los corto) y los que llegaron al calendario sin agendar.
Los que dejaron solo el contacto o contestaron una parte no. "Llego al calendario" es el paso mas alto
que alcanzo algun intento del evento (n preguntas + 2): el paso no se guarda como numero de preguntas.
"""
from sqlalchemy import func

FUNNEL_WORKSHOP = 'workshop'


def contar_intentos(inicio, fin, emails_contados):
    """Cuantos intentos del funnel workshop completaron el formulario entre `inicio` y `fin` (UTC naive).

    `emails_contados` son los correos (minuscula) de los clientes que ya cuentan como aplicacion: quien
    ya tiene su formulario guardado no se cuenta dos veces. Un correo, una vez.
    """
    # Import local: Agendas 2.0 es un modulo aparte que importa servicios de la operacion.
    from app import db
    from app.agendas_v2.modelos import SchedIntento

    filas = SchedIntento.query.filter(
        SchedIntento.funnel_id == FUNNEL_WORKSHOP,
        SchedIntento.creado_en >= inicio, SchedIntento.creado_en <= fin,
    ).all()
    if not filas:
        return 0
    tope = dict(db.session.query(SchedIntento.evento_id, func.max(SchedIntento.paso))
                .filter(SchedIntento.funnel_id == FUNNEL_WORKSHOP)
                .group_by(SchedIntento.evento_id).all())
    completos = {
        (i.email or '').strip().lower() for i in filas
        if i.estado == 'descalificada' or (i.paso or 0) >= tope.get(i.evento_id, 0)
    }
    completos.discard('')
    return len(completos - set(emails_contados))
