// Un color por closer en el Triage de Dirección (02/11/2026): el mismo en el embudo y en «Por closer», estable aunque
// se filtre por persona (se reparte por el orden del id entre todos los closers del período).

const PALETA = ['#38bdf8', '#f472b6', '#a3e635', '#fbbf24', '#a78bfa', '#fb923c', '#2dd4bf', '#f87171'];

/** `{ [closer_id]: color }` de los closers de `por_closer` (todas las personas de triage). */
export function coloresDe(filas = []) {
    const ids = [...new Set(filas.map((f) => f.closer_id))].sort((a, b) => a - b);
    return Object.fromEntries(ids.map((id, i) => [id, PALETA[i % PALETA.length]]));
}
