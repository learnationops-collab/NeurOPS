// Hasta cuándo se le puede escribir al lead (espejo de `escribir.ventana` del backend): 24 h normal,
// hasta 7 días como respuesta humana (HUMAN_AGENT), después Instagram no deja.
const HORA = 3600 * 1000;

export function ventanaDe(ultimoEntrante, ahora = Date.now()) {
    if (!ultimoEntrante) return { estado: 'cerrada', aviso: 'El lead todavía no escribió: Instagram no deja mandarle nada' };
    const pasado = ahora - new Date(ultimoEntrante).getTime();
    if (pasado < 24 * HORA) return { estado: 'abierta', aviso: null };
    if (pasado < 7 * 24 * HORA) return { estado: 'humana', aviso: 'Pasaron más de 24 h: sale como respuesta de una persona (vale hasta 7 días)' };
    return { estado: 'cerrada', aviso: 'Pasaron más de 7 días: Instagram no deja escribirle hasta que vuelva a escribir' };
}
