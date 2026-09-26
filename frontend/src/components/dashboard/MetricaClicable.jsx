import React from 'react';
import './drill.css';

/**
 * Cualquier número del dashboard, convertido en un botón que abre la lista ya filtrada de los
 * registros que lo componen.
 *
 * ## El contrato del destino
 *
 * ```js
 * { tabla: 'agendas', filtro: { asistio: 'Sí' }, de: 'Show up', aviso: '…' }
 * ```
 *
 * - `tabla` es una de las del libro de registros (ver `tablasDef.js`).
 * - `filtro` mapea **clave de faceta → etiqueta**. Etiqueta y no `key`: el filtrado compara
 *   contra lo que devuelve `faceta.de(fila)`, que es la etiqueta. Un array de etiquetas en la
 *   misma clave es un OR (así se pide "pago completo o split pay" con una sola faceta).
 * - `de` es el nombre del número del que viene el clic. No es decorativo: es lo que la lista
 *   muestra para que se vea de dónde salió el filtro y se pueda quitar.
 * - `aviso` (opcional) es la advertencia que la lista tiene que mostrar cuando el destino NO
 *   cierra exactamente con el número — distinta atribución, otro denominador, etc.
 *
 * ## Por qué un botón y no un div con onClick
 *
 * Porque es navegación: tiene que entrar en el orden de tabulación, activarse con Enter y con
 * espacio, y decir a dónde lleva antes de que alguien lo toque. `aria-label` se arma con el
 * detalle (`"Ver las 34 agendas que asistieron"`) y no con el número solo, que fuera de contexto
 * no dice nada.
 *
 * **Un 0 también es cliqueable.** Llevar a una lista vacía es información: dice que el número es
 * cero de verdad y no que el filtro esté mal. Se marca con menos peso visual, no se desactiva.
 *
 * Sin `destino` o sin `irA` devuelve el contenido pelado, para que quien lo usa no tenga que
 * duplicar el marcado cuando una métrica no se puede cortar igual que como se calculó.
 */
/**
 * La carga que viaja al drill-down: las condiciones más los metadatos que la lista necesita para
 * decir de dónde vino el filtro. Las claves `__` no son facetas, Revisar las separa al absorberlas.
 */
export const cargaDe = (destino) => ({
    ...destino.filtro, __de: destino.de, __aviso: destino.aviso || null,
});

/**
 * El `onClick` de un destino, para las piezas que ya traen su propio botón (la flecha de una barra
 * gruesa, una celda del mapa del equipo). Devuelve `undefined` sin destino, así el botón
 * desaparece solo en vez de quedar apretable sin efecto.
 */
export const abrir = (irA, destino) => (destino && irA
    ? () => irA(destino.tabla, cargaDe(destino))
    : undefined);

const MetricaClicable = ({
    irA, destino, detalle, vacio = false, className, style, envoltura: Envoltura = 'span',
    subrayar = true, children,
}) => {
    if (!destino || !irA) {
        return <Envoltura className={className} style={style}>{children}</Envoltura>;
    }

    const nombre = destino.de || 'este dato';
    const etiqueta = detalle ? `Ver en la lista: ${detalle}` : `Ver en la lista los registros de ${nombre}`;

    return (
        <button type="button"
            className={`metrica-clic${className ? ` ${className}` : ''}`}
            style={style}
            data-vacio={vacio ? '1' : undefined}
            aria-label={etiqueta}
            title={etiqueta}
            onClick={(e) => {
                // Una métrica clicable puede vivir dentro de una fila que también es clicable
                // (las celdas del mapa del equipo, las filas del ranking): sin esto el clic
                // disparaba las dos acciones y la última ganaba.
                e.stopPropagation();
                irA(destino.tabla, cargaDe({ ...destino, de: nombre }));
            }}>
            {subrayar ? <span className="metrica-clic-txt">{children}</span> : children}
        </button>
    );
};

export default MetricaClicable;
