// Hasta cuándo se le puede escribir al lead (espejo de `escribir.ventana` del backend): 24 h normal,
// hasta 7 días como respuesta humana (HUMAN_AGENT) si Meta aprobó la función, después Instagram no deja.
// Sin la aprobación (ADR-W281), pasadas las 24 h solo se le puede escribir desde la app de Instagram.
const HORA = 3600 * 1000;

// Lo dice el backend con la bandeja (`human_agent` de GET /inbox/conversaciones).
let humanAgent = false;
export const setHumanAgent = (valor) => { humanAgent = Boolean(valor); };

// Horas que Work puede escribirle desde su último mensaje.
export const horasDeVentana = (whatsapp = false) => (!whatsapp && humanAgent ? 7 * 24 : 24);

export const linkInstagram = (contacto) => (contacto?.username ? `https://ig.me/m/${encodeURIComponent(contacto.username)}` : null);

// `whatsapp`: WhatsApp no tiene la respuesta humana; pasadas las 24 h solo sale una plantilla aprobada.
// `enInstagram`: Work no puede, pero desde la app de Instagram sí (hasta que Meta apruebe HUMAN_AGENT).
export function ventanaDe(ultimoEntrante, ahora = Date.now(), whatsapp = false) {
    const red = whatsapp ? 'WhatsApp' : 'Instagram';
    if (!ultimoEntrante) return { estado: 'cerrada', aviso: `El lead todavía no escribió: ${red} no deja mandarle nada` };
    const pasado = ahora - new Date(ultimoEntrante).getTime();
    if (pasado < 24 * HORA) return { estado: 'abierta', aviso: null };
    if (whatsapp) return { estado: 'cerrada', aviso: 'Pasaron más de 24 h: WhatsApp solo deja escribirle con una plantilla aprobada' };
    if (pasado >= 7 * 24 * HORA) return { estado: 'cerrada', aviso: 'Pasaron más de 7 días: Instagram no deja escribirle hasta que vuelva a escribir' };
    if (humanAgent) return { estado: 'humana', aviso: 'Pasaron más de 24 h: sale como respuesta de una persona (vale hasta 7 días)' };
    return { estado: 'cerrada', enInstagram: true, aviso: 'Pasaron más de 24 h desde su último mensaje: desde Work ya no sale. Mandalo desde Instagram y marcalo como seguimiento.' };
}
