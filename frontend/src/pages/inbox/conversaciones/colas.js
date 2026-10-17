// Las colas de la bandeja y cómo se ordena cada una. Una conversación «espera» cuando lo último lo
// escribió el lead: la espera corre desde ese mensaje.

const HORA = 60;

export function esperaMin(c, ahora) {
    if (c.ultimo_de !== 'lead' || !c.ultimo_en) return null;
    return Math.max(0, Math.floor((ahora - new Date(c.ultimo_en)) / 60000));
}

export function textoEspera(min) {
    if (min == null) return '';
    if (min < HORA) return `${min} min`;
    if (min < 24 * HORA) return `${Math.floor(min / HORA)} h ${min % HORA ? `${min % HORA} min` : ''}`.trim();
    return `${Math.floor(min / (24 * HORA))} d`;
}

// Ámbar desde la media hora, rojo desde las 3 h: a esa altura el lead ya se enfrió.
export function colorEspera(min) {
    if (min == null) return undefined;
    if (min >= 3 * HORA) return 'var(--error)';
    if (min >= 30) return 'var(--warning)';
    return 'var(--text-muted)';
}

export const COLAS = [
    { value: 'esperan', label: 'Esperan respuesta', cumple: (c, ahora) => esperaMin(c, ahora) != null, porEspera: true },
    { value: 'esperan_hora', label: 'Esperan más de 1 h', cumple: (c, ahora) => esperaMin(c, ahora) >= HORA, porEspera: true },
    { value: 'bot_pausado', label: 'Bot pausado', cumple: (c) => c.bot_pausado },
    { value: 'califican', label: 'Califican', cumple: (c) => c.califica === true },
    { value: 'no_califican', label: 'No califican', cumple: (c) => c.califica === false },
    { value: 'todas', label: 'Todas', cumple: () => true },
];

// «ENARM 2027», «enarm» y «Enarm.» son el mismo examen para filtrar.
export function examenDe(c) {
    const primera = String(c.examen || '').trim().split(/[\s.,;]+/)[0];
    return primera ? primera.toUpperCase().slice(0, 12) : null;
}

export function examenes(lista) {
    const cuenta = new Map();
    lista.forEach((c) => {
        const e = examenDe(c);
        if (e) cuenta.set(e, (cuenta.get(e) || 0) + 1);
    });
    return [...cuenta].sort((a, b) => b[1] - a[1]);
}

// Las colas de espera van de la que más espera a la que menos; las demás, por el último mensaje.
export function filtrar(lista, { cola, examen, ahora }) {
    const def = COLAS.find((x) => x.value === cola) || COLAS[0];
    const salida = lista.filter((c) => def.cumple(c, ahora) && (!examen || examenDe(c) === examen));
    if (def.porEspera) salida.sort((a, b) => esperaMin(b, ahora) - esperaMin(a, ahora));
    return salida;
}

export function quien(c) {
    return c.username ? `@${c.username}` : c.nombre || 'Sin usuario';
}
