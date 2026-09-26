/**
 * Agrupa filas por una dimensión y calcula el subtotal de cada grupo.
 *
 * Función pura, sin React y sin nada del dominio: la dimensión llega como `{ key, label, de }`
 * —igual que una faceta— así que agrupar por closer, por fuente o por estado es la misma llamada
 * con otro argumento. Es lo que pide la especificación: "dejar la agrupación preparada para otros
 * criterios sin rehacer el componente".
 *
 * ## El subtotal
 *
 * Cada grupo trae `cantidad` y `monto`. El monto se saca de `campoMonto` (por defecto `monto`, que
 * es lo que traen las filas de ventas) y las filas sin ese campo suman 0 sin romper: una agenda no
 * tiene monto y el encabezado de su grupo muestra solo la cantidad. `deuda` se suma aparte cuando
 * existe, para el encabezado de la cartera.
 *
 * ## Las filas sin valor en la dimensión
 *
 * No se descartan: van a un grupo propio con la etiqueta `sinValor` (por defecto "Sin asignar").
 * Descartarlas haría que la suma de los subtotales no diera el total de la lista, que es
 * exactamente el error que estas vistas tienen que evitar.
 *
 * ## El orden
 *
 * Estable y determinista: los grupos salen en el orden en el que su PRIMERA fila aparece en la
 * lista, y dentro de cada grupo las filas conservan el orden que traían. La lista llega ya ordenada
 * por el backend (lo vencido primero, lo más reciente primero, según la tabla) y reordenar acá
 * perdería ese criterio. El grupo de "sin valor" va último, porque no es un grupo: es el resto.
 */

export const SIN_VALOR = 'Sin asignar';

const numero = (valor) => (typeof valor === 'number' && Number.isFinite(valor) ? valor : 0);

/** Redondeo a dos decimales: sumar flotantes deja subtotales como 1499.9999999999998. */
const centavos = (valor) => Math.round(valor * 100) / 100;

export const agruparPor = (filas, dimension, opciones = {}) => {
    const { campoMonto = 'monto', campoDeuda = 'deuda', sinValor = SIN_VALOR } = opciones;
    const de = typeof dimension === 'function' ? dimension : dimension?.de;

    if (!de) return [];

    const porClave = new Map();

    (filas || []).forEach(fila => {
        const crudo = de(fila);
        const vacio = crudo === null || crudo === undefined || crudo === '';
        const clave = vacio ? sinValor : String(crudo);

        if (!porClave.has(clave)) {
            porClave.set(clave, {
                clave, label: clave, esSinValor: vacio,
                filas: [], cantidad: 0, monto: 0, deuda: 0, tieneMonto: false, tieneDeuda: false,
            });
        }
        const grupo = porClave.get(clave);
        grupo.filas.push(fila);
        grupo.cantidad += 1;
        if (fila && campoMonto in fila) {
            grupo.tieneMonto = true;
            grupo.monto += numero(fila[campoMonto]);
        }
        if (fila && campoDeuda in fila) {
            grupo.tieneDeuda = true;
            grupo.deuda += numero(fila[campoDeuda]);
        }
    });

    const grupos = [...porClave.values()];
    grupos.forEach(g => { g.monto = centavos(g.monto); g.deuda = centavos(g.deuda); });

    // El resto va último. `sort` de JS es estable desde ES2019, así que el resto de los grupos
    // conserva el orden de aparición.
    return grupos.sort((a, b) => Number(a.esSinValor) - Number(b.esSinValor));
};

/** Los totales de todos los grupos juntos, para verificar que cierran con la lista. */
export const totalDeGrupos = (grupos) => (grupos || []).reduce((acumulado, g) => ({
    cantidad: acumulado.cantidad + g.cantidad,
    monto: centavos(acumulado.monto + g.monto),
    deuda: centavos(acumulado.deuda + g.deuda),
}), { cantidad: 0, monto: 0, deuda: 0 });

export default agruparPor;
