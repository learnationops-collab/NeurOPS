// El link de Fathom de una agenda (pedido del 02/10/2026): la grabación y la transcripción de la
// llamada, en una sola página. Lo usan la pestaña Resultado, que lo edita, y la cabecera, que lo abre.
//
// Qué se acepta lo decide el backend (`ficha_grabacion_service`): cualquier link http(s). Acá solo
// se mira si es de Fathom, para avisar —no para bloquear— cuando alguien pega otra cosa.

/** El host de lo que escribió la persona, con o sin `https://` adelante, o '' si no se entiende. */
const hostDe = (texto) => {
    const limpio = String(texto || '').trim();
    if (!limpio) return '';
    try {
        return new URL(limpio.includes('://') ? limpio : `https://${limpio}`).hostname.toLowerCase();
    } catch {
        return '';
    }
};

/** True si el link es de fathom.video (o de un subdominio suyo). */
export const esDeFathom = (texto) => {
    const host = hostDe(texto);
    return host === 'fathom.video' || host.endsWith('.fathom.video');
};
