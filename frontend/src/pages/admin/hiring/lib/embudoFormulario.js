// Helpers puros del embudo del formulario (ver components/EmbudoFormulario.jsx).

// Cuántas preguntas se destacan.
export const TOP_ABANDONO = 3;

/** Los que se fueron por su cuenta: abandonaron y no los cortó un requisito excluyente. */
export const seFueronSolas = (e) => Math.max(0, (e.abandonaron_aca || 0) - (e.descartadas_aca || 0));

/** Los `n` campos donde más gente abandonó por su cuenta (solo si hay alguien). */
export const masAbandonadas = (items, n = TOP_ABANDONO) =>
    [...items]
        .filter((e) => seFueronSolas(e) > 0)
        .sort((a, b) => seFueronSolas(b) - seFueronSolas(a) || a.orden - b.orden)
        .slice(0, n)
        .map((e) => e.campo);

/** [{ bloque, items }] respetando el orden del formulario. */
export const agruparPorBloque = (items) => {
    const grupos = [];
    items.forEach((e) => {
        const ultimo = grupos[grupos.length - 1];
        if (ultimo && ultimo.bloque === e.bloque) ultimo.items.push(e);
        else grupos.push({ bloque: e.bloque, items: [e] });
    });
    return grupos;
};
