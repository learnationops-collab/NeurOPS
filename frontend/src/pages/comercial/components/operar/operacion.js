
/**
 * Lo que Operaciones hace sobre los registros desde Revisar (10/10/2026).
 *
 * Las tablas viejas de Agendas y Ventas del operador (con edición masiva, duplicados y acciones por
 * venta) se fueron: el operador mira los registros como la dirección, en Revisar, y lo que solo él
 * hacía queda como acciones de esa misma vista. Quién opera lo dice el backend (`puede_operar` del
 * contexto: admin y operador); la dirección y los closers ven Revisar igual que siempre.
 *
 * Cada acción vive en su propio módulo, que se registra en `MODULOS`: así sumar una no toca las
 * demás. Un módulo aporta, por tabla (`agendas`, `ventas`, …), acciones de tres clases:
 *
 *  - `lote`: sobre las filas tildadas. Revisar muestra las casillas solo si la tabla tiene alguna.
 *  - `herramientas`: botones de la barra que no dependen de qué filas se tildaron (Duplicados).
 *  - `fila(fila)`: las del menú «⋯» de cada fila; devuelve [] si a esa fila no le corresponde ninguna.
 *
 * Toda acción es `{ id, label, Icono, Panel }`. `Panel` se monta al elegirla y recibe
 * `{ tabla, filas, fila, fechas, onCerrar, onHecho }`: `filas` son las tildadas (lote) o las que
 * muestra la lista (herramientas), `fila` la de su menú, y `onHecho` recarga la tabla. El panel
 * dibuja su propio modal (`components/ui/Modal`), así cada uno elige su ancho y su pie.
 */

import agendasLote from './agendasLote';
import duplicados from './duplicados';

/** Los módulos registrados: `{ [tabla]: { lote?, herramientas?, fila? } }`. */
export const MODULOS = [agendasLote, duplicados];

/**
 * Las acciones de Operaciones para esta tabla, o null si no hay ninguna (y entonces Revisar se ve
 * exactamente como siempre). `modulos` es para los tests.
 */
export function operacionDe(tabla, modulos = MODULOS) {
    const aportes = modulos.map((m) => m[tabla]).filter(Boolean);
    const lote = aportes.flatMap((a) => a.lote || []);
    const herramientas = aportes.flatMap((a) => a.herramientas || []);
    const deFila = aportes.map((a) => a.fila).filter(Boolean);
    if (!lote.length && !herramientas.length && !deFila.length) return null;
    return {
        lote,
        herramientas,
        fila: deFila.length ? (fila) => deFila.flatMap((f) => f(fila) || []) : null,
    };
}
