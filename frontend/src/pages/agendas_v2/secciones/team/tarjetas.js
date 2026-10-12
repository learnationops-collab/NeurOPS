// Las tarjetas de Available agrupadas: en vez de un carril por closer, cada día junta en una tarjeta lo del
// mismo tipo que se pisa o se toca (de cualquier closer), con el primer nombre de cada uno y el detalle al
// pasar el mouse. Sin React, para poder probarlo.

import { columnas } from './cobertura';

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

// Al agrupar, el margen va con su llamada y el tiempo libre donde no entra una sesión, con los turnos.
const GRUPO_DE = { libre: 'libre', hueco: 'libre', llamada: 'llamada', margen: 'llamada', ocupado: 'ocupado', cancelada: 'cancelada' };
// Lo del mismo tipo a menos de esto se junta (los turnos encadenados con su margen quedan en una).
export const JUNTAR_MS = 15 * 60000;

export const primerNombre = (nombre) => (nombre || '').trim().split(/\s+/)[0] || '';

// Los primeros nombres de un grupo: «Ana», «Ana, Beto» o «Ana +2».
export function nombresTxt(ps) {
    const ns = [...new Set(ps.map(p => primerNombre(p.nombre)))];
    return ns.length <= 2 ? ns.join(', ') : ns[0] + ' +' + (ns.length - 1);
}

/**
 * Agrupa las piezas de un día ({tipo, m0, m1 (minutos del día), p, ...}): las de un mismo grupo (GRUPO_DE)
 * que se pisan o quedan a menos de JUNTAR_MS van juntas. [{tipo, m0, m1, piezas, personas, col, ncols}],
 * lado a lado si se pisan (columnas).
 */
export function agrupar(piezas, juntarMin = JUNTAR_MS / 60000) {
    const abiertos = {}, out = [];
    piezas.slice().sort((x, y) => x.m0 - y.m0 || x.m1 - y.m1).forEach(pz => {
        const tipo = GRUPO_DE[pz.tipo] || pz.tipo;
        const u = abiertos[tipo];
        if (u && pz.m0 <= u.m1 + juntarMin) {
            u.m1 = Math.max(u.m1, pz.m1);
            u.piezas.push(pz);
        } else {
            abiertos[tipo] = { tipo, m0: pz.m0, m1: pz.m1, piezas: [pz] };
            out.push(abiertos[tipo]);
        }
    });
    out.forEach(g => { g.personas = [...new Map(g.piezas.map(pz => [pz.p.id, pz.p])).values()]; });
    return columnas(out.map(g => Object.assign(g, { a: g.m0, b: g.m1 })));
}

// Lo que dice debajo del nombre en una tarjeta agrupada: cuántos turnos o llamadas junta.
export function resumenGrupo(g) {
    const n = (t) => g.piezas.filter(pz => pz.tipo === t).length;
    if (g.tipo === 'libre') {
        const t = n('libre');
        return t ? t + (t === 1 ? ' turno' : ' turnos') : 'sin turno completo';
    }
    if (g.tipo === 'llamada') { const t = n('llamada'); return t > 1 ? t + ' llamadas' : ''; }
    if (g.tipo === 'ocupado') { const t = n('ocupado'); return t > 1 ? t + ' eventos' : ''; }
    const t = g.piezas.length;
    return t > 1 ? t + ' canceladas' : '';
}
