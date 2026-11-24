// Hasta cuándo se le puede escribir al lead (espejo de `escribir.ventana` del backend): 24 h normal,
// hasta 7 días como respuesta humana (HUMAN_AGENT), después Instagram no deja.
const HORA = 3600 * 1000;

// `whatsapp`: WhatsApp no tiene la respuesta humana; pasadas las 24 h solo sale una plantilla aprobada.
export function ventanaDe(ultimoEntrante, ahora = Date.now(), whatsapp = false) {
    const red = whatsapp ? 'WhatsApp' : 'Instagram';
    if (!ultimoEntrante) return { estado: 'cerrada', aviso: `El lead todavía no escribió: ${red} no deja mandarle nada` };
    const pasado = ahora - new Date(ultimoEntrante).getTime();
    if (pasado < 24 * HORA) return { estado: 'abierta', aviso: null };
    if (whatsapp) return { estado: 'cerrada', aviso: 'Pasaron más de 24 h: WhatsApp solo deja escribirle con una plantilla aprobada' };
    if (pasado < 7 * 24 * HORA) return { estado: 'humana', aviso: 'Pasaron más de 24 h: sale como respuesta de una persona (vale hasta 7 días)' };
    return { estado: 'cerrada', aviso: 'Pasaron más de 7 días: Instagram no deja escribirle hasta que vuelva a escribir' };
}
