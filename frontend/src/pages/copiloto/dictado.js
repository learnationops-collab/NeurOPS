// Lógica pura del dictado (sin navegador), para poder testearla.

const ERRORES = {
    'not-allowed': 'Permití el micrófono en el navegador para dictar.',
    'service-not-allowed': 'Permití el micrófono en el navegador para dictar.',
    'audio-capture': 'No se encontró un micrófono.',
    'no-speech': 'No se escuchó nada. Probá de nuevo.',
    network: 'El dictado necesita conexión a internet.',
};

// null para los cortes que no son un error (el closer lo detuvo).
export function mensajeDeError(codigo) {
    if (codigo === 'aborted') return null;
    return ERRORES[codigo] || 'No se pudo dictar. Probá de nuevo.';
}

// Suma lo dictado a lo que ya estaba escrito: con un espacio en el medio y mayúscula al empezar
// una oración.
export function juntar(base, nuevo) {
    const limpio = (nuevo || '').trim();
    if (!limpio) return base;
    const empiezaOracion = !base.trim() || /[.!?]\s*$/.test(base);
    const texto = empiezaOracion ? limpio[0].toUpperCase() + limpio.slice(1) : limpio;
    if (!base) return texto;
    return /\s$/.test(base) ? base + texto : `${base} ${texto}`;
}

// Separa lo confirmado de lo provisorio en un evento `result` de SpeechRecognition.
export function leerResultados(evento) {
    let final = '';
    let parcial = '';
    for (let i = evento.resultIndex; i < evento.results.length; i += 1) {
        const resultado = evento.results[i];
        if (resultado.isFinal) final += resultado[0].transcript;
        else parcial += resultado[0].transcript;
    }
    return { final, parcial };
}
