// Las tarjetas de Available apiladas: en vez de un carril por closer, cada día pone todas las tarjetas (cada
// turno, llamada o evento, de cualquier closer, por separado) en una sola columna, y lo que se pisa queda
// encimado como cartas: lo que no está disponible atrás y los turnos libres adelante, cada una un poco corrida
// para que se vea. Sin React, para poder probarlo.

// Cómo se ve cada tipo: libre (verde, check), llamada (azul, teléfono), ocupado por otro evento (reloj),
// cancelada (tachada).
export const VISUAL = {
    libre: { icono: 'check', n: 'Libre' },
    hueco: { icono: 'check', n: 'Libre' },
    llamada: { icono: 'llamada', n: 'Llamada' },
    margen: { icono: null, n: 'Margen' },
    ocupado: { icono: 'clock', n: 'Ocupado' },
    cancelada: { icono: 'x', n: 'Cancelada' },
};

// De atrás para adelante: lo que no está disponible al fondo y los turnos libres al frente.
export const CAPA = { ocupado: 0, margen: 1, llamada: 2, cancelada: 3, hueco: 4, libre: 5 };

export const primerNombre = (nombre) => (nombre || '').trim().split(/\s+/)[0] || '';

/**
 * Apila las piezas de un día ({tipo, m0, m1 (minutos del día), ...}). Se dibujan de atrás para adelante (por
 * CAPA y, dentro de cada una, por hora): lo que se dibuja después queda encima. Cada pieza se corre lo justo
 * para no taparle el borde a las que ya están debajo y se le pisan: `capa` es el primer lugar que ninguna de
 * ellas usa (0 = sin correr), así lo corrido no crece más que lo que se pisa a la vez. Devuelve las mismas
 * piezas en el orden en que se dibujan.
 */
export function apilar(piezas) {
    const puestas = [];
    piezas.slice().sort((x, y) => (CAPA[x.tipo] ?? 0) - (CAPA[y.tipo] ?? 0) || x.m0 - y.m0 || x.m1 - y.m1).forEach(z => {
        const usadas = new Set(puestas.filter(w => w.m0 < z.m1 && z.m0 < w.m1).map(w => w.capa));
        let k = 0;
        while (usadas.has(k)) k++;
        z.capa = k;
        puestas.push(z);
    });
    return puestas;
}
