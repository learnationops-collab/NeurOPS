// La lista no salta cuando escribe el equipo (Paula y Elías, 27/11/2026: «mando el seguimiento y se me va arriba de
// todo; voy haciendo 20 y me pierdo»). Mientras no cambie `clave` (filtro, orden, búsqueda), lo que ya estaba en la
// lista queda en su lugar; se reacomodan solo las que entran nuevas y las que tienen un mensaje nuevo del lead.
import { useRef } from 'react';

export default function useOrdenEstable(visibles, clave) {
    const antes = useRef({ clave: null, pos: new Map() });
    const prev = antes.current.clave === clave ? antes.current.pos : new Map();
    const libre = (c) => {
        const p = prev.get(c.id);
        return !p || (c.ultimo_de === 'lead' && c.ultimo_en !== p.en);
    };
    // Las libres van donde las pone el orden; las fijas llenan los huecos en el orden que tenían.
    const salida = new Array(visibles.length);
    visibles.forEach((c, i) => { if (libre(c)) salida[i] = c; });
    const fijas = visibles.filter((c) => !libre(c)).sort((a, b) => prev.get(a.id).i - prev.get(b.id).i);
    let k = 0;
    for (let i = 0; i < salida.length; i += 1) if (!salida[i]) salida[i] = fijas[k++];
    antes.current = { clave, pos: new Map(salida.map((c, i) => [c.id, { i, en: c.ultimo_en }])) };
    return salida;
}
