"""El lead que antes no agendaba (opción que descalifica, «No califica», regla con otra página) agenda con el
triage, como los segmentos C y D: una regla lo manda al grupo «Triage» y a la «Sesión diagnóstica».

Sin grupo «Triage» el formulario queda como está (esos leads siguen sin agendar).
"""

import re

from app.agendas_v2.nucleo.catalogos import con_opciones
from app.agendas_v2.nucleo.datos import buscar
from app.agendas_v2.nucleo.formulario import NO_CALIFICA
from app.agendas_v2.nucleo.util import clonar, js_str

GRUPO_TRIAGE = 'ws-triage'
SESION_TRIAGE = 'sesion-diagnostica'


def grupo_triage(d):
    """El grupo de triage: el `ws-triage` o, si no, el primero cuyo nombre dice «triage»."""
    return buscar(d, 'grupos', GRUPO_TRIAGE) or next(
        (g for g in d.get('grupos') or [] if re.search('triage', js_str(g.get('nombre')), re.I)), None
    )


def con_triage(form, d):
    """El formulario publicado como lo ve el lead cuando hay grupo de triage: ya no corta.
    - Una opción que descalifica deja de cortar y una regla nueva (primera) manda al triage.
    - Una regla con otra página o con destino «No califica», y «Todo lo demás» en «No califica», mandan al triage.
    Las reglas de segmento (C/D) y el resto quedan igual."""
    g = grupo_triage(d)
    if not form or not g:
        return form
    extra = {'evento': SESION_TRIAGE} if buscar(d, 'eventos', SESION_TRIAGE) else {}
    f = clonar(form)
    nuevas = []
    for q in f.get('preguntas') or []:
        if not con_opciones(q.get('tipo')):
            continue
        ops = [o['id'] for o in q.get('opciones') or [] if o.get('descalifica')]
        for o in q.get('opciones') or []:
            o['descalifica'] = False
        if ops:
            nuevas.append({'id': 'triage-' + q['id'], 'grupo': g['id'], 'url': '', 'cond': [{'q': q['id'], 'ops': ops}], **extra})
    for r in f.get('reglas') or []:
        if r.get('url') or r.get('grupo') == NO_CALIFICA:
            r['grupo'], r['url'] = g['id'], ''
            r.update(extra)
    f['reglas'] = nuevas + (f.get('reglas') or [])
    if f.get('resto') == NO_CALIFICA:
        f['resto'] = g['id']
    return f
