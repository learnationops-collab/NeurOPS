// El link del CTA «Quiero sumarme a la clase»: el grupo de WhatsApp del próximo taller, el mismo que
// Marketing carga en Workshop › Próximos talleres y que las landings leen de /public/workshops/proximos
// ({eventos: [{inicio, meet, whatsapp}]}, con los links ya heredados del taller anterior).

import { useEffect, useState } from 'react';
import api from '../../../../services/api';

const DURACION_MS = 30 * 60 * 1000; // lo que dura el taller para las landings (admin/workshop/agendaTaller.js)

/** El grupo del primer taller que no terminó; si no queda ninguno, el del último. '' si no hay. */
export function linkDeLaClase(eventos, ahora = Date.now()) {
    const conLink = (eventos || []).filter((e) => e && e.inicio && e.whatsapp)
        .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
    const proximo = conLink.find((e) => new Date(e.inicio).getTime() + DURACION_MS > ahora);
    return (proximo || conLink[conLink.length - 1] || {}).whatsapp || '';
}

/** El link, o '' mientras carga o si falla (el CTA queda deshabilitado). */
export function useLinkDeLaClase() {
    const [link, setLink] = useState('');
    useEffect(() => {
        let vivo = true;
        api.get('/public/workshops/proximos', { timeout: 15000, skipBugReport: true, skipAuthError: true })
            .then(({ data }) => { if (vivo) setLink(linkDeLaClase(data && data.eventos)); })
            .catch((e) => console.error('[descalificados] No se pudo leer el próximo taller', e));
        return () => { vivo = false; };
    }, []);
    return link;
}
