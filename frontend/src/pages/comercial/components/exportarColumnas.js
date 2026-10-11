/**
 * Cómo se escribe cada columna de Revisar en el CSV de «Exportar» (10/10/2026).
 *
 * Las columnas se definen UNA vez, en `tablasDef.js` y `academia.js`, y se dibujan con `Celda`
 * (`RevisarLista.jsx`), que decide por la clave de la columna qué va en la celda. Esto es su gemelo
 * para el archivo: la misma decisión por clave, pero con el texto o el número crudo que hay detrás
 * del chip o del «$1,234». No repite ninguna lista de columnas: recorre las de la tabla, así que una
 * columna nueva aparece sola en el panel Exportar.
 *
 * ## Una celda de la pantalla puede ser varias del CSV
 *
 * Varias celdas muestran dos datos: el chip del pago y, debajo, el método; lo pagado y cuántos
 * cobros; el cliente y su Instagram. En una planilla cada celda guarda UN dato —si no, no se puede
 * sumar ni filtrar—, así que esas columnas se exportan en partes: la principal lleva el encabezado de
 * la columna y las otras el suyo. Cada parte se elige y se ordena por separado en el panel.
 *
 * ## Valores planos
 *
 * Cada `valor(fila)` devuelve un texto, un número o null; nunca un objeto ni JSX. El formato (el
 * separador decimal, las comillas) lo pone `exportarCsv.js`, igual para todas. Las fechas ya salen
 * en ISO (`2026-10-02`, o `2026-10-02 17:30` si la columna tiene hora), que Excel y Google Sheets
 * reconocen como fecha en cualquier idioma. El test que recorre todas las tablas
 * (`exportarColumnas.test.js`) es el que impide que una columna nueva rompa esto.
 */

import { parseUtcIso } from '../../../utils/datetime';
import { TIPOS_EN_UTC } from './Shared';
import { actividadDe } from './academia';
import { agendaDe } from './tablasDef';

const dos = (n) => String(n).padStart(2, '0');

/** Un instante guardado en UTC, en el reloj de quien exporta: `2026-10-02 17:30`. */
export const instanteIso = (iso) => {
    const d = parseUtcIso(iso);
    return d
        ? `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())} ${dos(d.getHours())}:${dos(d.getMinutes())}`
        : null;
};

/** Un día tal como viene, sin pasarlo por el huso: `2026-10-02`. */
export const diaIso = (iso) => (iso ? String(iso).slice(0, 10) : null);

/**
 * La fecha de una fila, con la MISMA regla que `cuandoDe` (Shared.jsx): las agendas y los leads traen
 * un instante en UTC y se escriben en hora local; las ventas y los clientes traen un día, que se
 * escribe tal cual y con la hora solo si la trae (es cuando la lista también la muestra).
 */
export const fechaDeFila = (fila, campo = 'fecha') => {
    const iso = fila?.[campo];
    if (!iso) return null;
    if (TIPOS_EN_UTC.includes(fila.tipo)) return instanteIso(iso);
    const hora = String(iso).slice(11, 16);
    return hora ? `${diaIso(iso)} ${hora}` : diaIso(iso);
};

/** Un número crudo, o null si no hay dato: un «—» de la pantalla es una celda vacía, no un 0. */
const aNumero = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))
    ? null : Number(v));

const texto = (campo) => (f) => (f[campo] === null || f[campo] === undefined || f[campo] === ''
    ? null : String(f[campo]));
const etiqueta = (campo) => (f) => f[campo]?.label ?? null;
// Lo que la columna usa para ordenarse ES el número que muestra (`orden` en su definición): se
// reusa en vez de volver a decir de qué campo sale.
const porOrden = (f, col) => aNumero(col.orden(f));

/**
 * Las partes de cada columna, por su clave. La primera es la principal: sin `header` lleva el de la
 * columna. Las demás llevan `sub`, que arma su clave (`tipo_pago.metodo`): es lo que el panel
 * recuerda de una vez para la otra, así que no se cambia a la ligera.
 *
 * `ver` (la flecha que abre la fila) no es un dato: no tiene partes y no se ofrece.
 */
export const PARTES_POR_COLUMNA = {
    // «Venta» arriba de una fecha se entiende en la tabla; suelto en una planilla, no: donde la
    // columna tiene un nombre largo (el del menú Ordenar), va ese.
    fecha: [{ header: (col) => col.ordenLabel || col.header, valor: (f) => fechaDeFila(f) }],
    cliente: [
        { valor: texto('cliente') },
        { sub: 'ig', header: 'Instagram', valor: texto('ig') },
    ],
    fuente: [{ valor: texto('fuente') }],
    closer: [{ valor: texto('closer') }],
    setter: [{ valor: texto('setter') }],
    programa: [{ valor: texto('programa') }],
    pre_call: [{ valor: etiqueta('pre_call') }],
    // Los días sin reportar van solo donde la celda los muestra: un 0 en una llamada ya reportada
    // diría algo que no es.
    post_call: [
        { valor: etiqueta('post_call') },
        { sub: 'retraso', header: 'Días sin reportar',
            valor: (f) => (f.retraso_dias > 0 ? aNumero(f.retraso_dias) : null) },
    ],
    estado: [{ valor: etiqueta('estado') }],
    // Ventas de quien opera (`defDe` en `tablasDef.js`): el estado de la venta y si tiene agenda, cada
    // uno en su columna. «Estado» suelto en una planilla de ventas se lee como el del cliente.
    estado_venta: [
        { header: 'Estado de la venta', valor: etiqueta('estado') },
        { sub: 'agenda', header: 'Agenda', valor: agendaDe },
    ],
    tipo_pago: [
        { valor: etiqueta('tipo_pago') },
        { sub: 'metodo', header: 'Método', valor: texto('metodo') },
    ],
    monto: [{ valor: porOrden }],
    pagado: [
        { valor: porOrden },
        { sub: 'cobros', header: 'Cobros', valor: (f) => aNumero(f.cobros) },
    ],
    // La celda escribe «—» cuando no debe nada; el archivo, 0: es un número que se va a sumar.
    deuda: [{ valor: porOrden }],
    // La celda de la próxima cuota junta el estado del cliente, su baja y la cuota: en el archivo
    // van separados, con la fecha y el monto como datos propios.
    cuota: [
        { header: 'Estado', valor: etiqueta('estado') },
        { sub: 'fecha', header: 'Próxima cuota', valor: (f) => diaIso(f.cuota_fecha) },
        { sub: 'monto', header: 'Monto de la cuota', valor: (f) => aNumero(f.cuota_monto) },
        { sub: 'baja', header: 'Fecha de baja', valor: (f) => diaIso(f.baja?.fecha) },
        { sub: 'motivo', header: 'Motivo de baja', valor: (f) => f.baja?.motivo || null },
    ],
    mensajes: [{ valor: (f) => aNumero(f.mensajes) }],
    // --- La Academia (ver `academia.js`). El estado es el de su faceta; los números, los de su orden.
    academia: [
        { valor: actividadDe },
        { sub: 'actividad', header: 'Última actividad',
            valor: (f) => instanteIso(f.academia?.ultima_actividad) },
        { sub: 'leido', header: 'Leído de la Academia',
            valor: (f) => instanteIso(f.academia?.sincronizado || f.academia?.intentado) },
    ],
    ac_horas: [{ valor: porOrden }],
    // Sin el «%» ni el «días» de la celda el número queda sin unidad: va en el encabezado.
    ac_progreso: [{ header: 'Progreso (%)', valor: porOrden }],
    // «3/12» en una celda Excel lo convierte en una fecha (3 de diciembre): van en dos números.
    ac_lecciones: [
        { valor: porOrden },
        { sub: 'total', header: 'Lecciones del programa', valor: (f) => aNumero(f.academia?.lecciones_total) },
    ],
    ac_ejecuciones: [{ valor: porOrden }],
    ac_racha: [{ header: 'Racha (días)', valor: porOrden }],
    ver: [],
};

/**
 * Las partes de una columna: `{ key, header, columna, valor(fila) }`. Una columna sin entrada en
 * `PARTES_POR_COLUMNA` se exporta con `fila[key]`; el test exige que todas la tengan, pero si una se
 * escapara, `exportarCsv.js` igual no escribe un objeto.
 */
export const partesDe = (col) => (PARTES_POR_COLUMNA[col.key] || [{ valor: (f) => f[col.key] }])
    .map(p => ({
        key: p.sub ? `${col.key}.${p.sub}` : col.key,
        header: typeof p.header === 'function' ? p.header(col) : (p.header || col.header),
        columna: col.key,
        valor: (fila) => p.valor(fila, col),
    }));

/**
 * Lo que se puede exportar de una tabla: las partes de los DOS juegos de columnas (el de siempre y
 * el de la Academia), sin repetir, en el orden de su definición. Es lo mismo que hace
 * `columnasOrdenables` para «Ordenar»: el panel ofrece todo aunque en pantalla se vea un juego solo.
 */
export const columnasExportables = (def) => {
    const vistas = new Set();
    return [...(def?.cols || []), ...(def?.colsAcademia || [])].flatMap(col => {
        if (vistas.has(col.key)) return [];
        vistas.add(col.key);
        return partesDe(col);
    });
};

/* ============================================================
   LA ELECCIÓN DEL PANEL — qué columnas van y en qué orden
   ============================================================ */

/**
 * La elección del panel Exportar: `[{ key, on }]`, en el orden en que quedan las columnas del
 * archivo. Funciones puras, para que el orden y la selección se prueben sin montar el panel.
 *
 * Sin una elección guardada arranca con lo que se ve hoy (10/10/2026): las partes de las columnas
 * en pantalla (`vistas`, las del juego de columnas elegido), en su orden y prendidas; después el
 * resto —el otro juego de columnas— apagado, para sumarlo con un clic.
 *
 * Con una guardada manda esa: su orden y lo que estaba prendido. Una columna que no existía cuando
 * se guardó va al final, apagada; una que ya no existe se descarta.
 */
export const eleccionInicial = (exportables, vistas, guardada = null) => {
    const claves = exportables.map(c => c.key);
    if (guardada && Array.isArray(guardada.orden) && Array.isArray(guardada.elegidas)) {
        const existe = new Set(claves);
        const orden = [...new Set(guardada.orden)].filter(k => existe.has(k));
        const elegidas = new Set(guardada.elegidas);
        return [...orden, ...claves.filter(k => !orden.includes(k))]
            .map(key => ({ key, on: elegidas.has(key) }));
    }
    const enPantalla = [...new Set((vistas || [])
        .flatMap(col => exportables.filter(c => c.columna === col.key).map(c => c.key)))];
    return [...enPantalla, ...claves.filter(k => !enPantalla.includes(k))]
        .map(key => ({ key, on: enPantalla.includes(key) }));
};

/** Sube (`paso` -1) o baja (+1) una columna. En una punta no hace nada. */
export const moverColumna = (eleccion, key, paso) => {
    const i = eleccion.findIndex(c => c.key === key);
    const j = i + paso;
    if (i < 0 || j < 0 || j >= eleccion.length) return eleccion;
    const nueva = eleccion.slice();
    [nueva[i], nueva[j]] = [nueva[j], nueva[i]];
    return nueva;
};

export const alternarColumna = (eleccion, key) => eleccion.map(c => (c.key === key ? { ...c, on: !c.on } : c));

/** «Todas» o «Ninguna»: cambia qué va, no el orden. */
export const marcarTodas = (eleccion, on) => eleccion.map(c => ({ ...c, on }));

/** Las columnas que se escriben, en el orden elegido. */
export const columnasElegidas = (eleccion, exportables) => {
    const porClave = new Map(exportables.map(c => [c.key, c]));
    return eleccion.filter(c => c.on && porClave.has(c.key)).map(c => porClave.get(c.key));
};
