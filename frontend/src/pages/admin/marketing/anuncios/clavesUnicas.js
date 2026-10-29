/**
 * Las claves de React de una lista de filas: la `id` de cada una y, si dos filas la comparten, la segunda
 * en adelante lleva un sufijo. Sin esto, dos filas con la misma clave (la misma palabra clave que llega dos
 * veces, o una fila sin clave más una llamada «__sin») salen repetidas en pantalla y React avisa.
 * La primera conserva su `id`, así elegirla o reordenar no remonta las filas.
 */
export const clavesUnicas = (filas, idDe) => {
    const vistos = new Map();
    return filas.map((f) => {
        const id = idDe(f);
        const veces = vistos.get(id) || 0;
        vistos.set(id, veces + 1);
        return veces ? `${id}#${veces}` : id;
    });
};

export default clavesUnicas;
