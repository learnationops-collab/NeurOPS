/**
 * El CSV de «Exportar» en Revisar (10/10/2026): se arma entero en el navegador, con las filas que
 * Revisar ya tiene cargadas y filtradas. No se le pide nada al backend: el archivo dice exactamente
 * lo que dice la lista (o el período entero, si se lo elige), sin una segunda consulta que pudiera
 * dar otro número.
 *
 * Los valores llegan planos desde `exportarColumnas.js` (texto, número o null). Acá se decide solo
 * CÓMO se escriben, y esa decisión es una sola para la vista previa y para el archivo: el panel
 * muestra `celdasDe` y el archivo es `armarCsv` sobre las mismas celdas, así que lo que se ve antes
 * de exportar es lo que queda escrito.
 *
 * ## Dos formatos, porque Excel no lee igual en todos los idiomas
 *
 * Un Excel en español espera `;` entre columnas y `,` para los decimales: con `,` de separador mete
 * cada fila entera en la columna A. Google Sheets y un Excel en inglés esperan lo contrario. Los
 * números van crudos (sin `$` ni separador de miles) y su separador decimal sigue al formato, que es
 * lo único que hace falta para que la planilla los tome como números y se puedan sumar.
 *
 * El archivo empieza con el BOM de UTF-8: sin él, Excel lo abre como Windows-1252 y «Pérez» se lee
 * «PÃ©rez».
 */

import { localToday } from '../../../utils/datetime';

export const BOM = '﻿';

export const FORMATOS = [
    { key: 'excel', label: 'Excel en español', separador: ';', decimal: ',' },
    { key: 'internacional', label: 'Google Sheets / internacional', separador: ',', decimal: '.' },
];

export const formatoDe = (key) => FORMATOS.find(f => f.key === key) || FORMATOS[0];

/**
 * Un texto que empieza con `=`, `+`, `-` o `@` la planilla lo toma por una fórmula. Los nombres y los
 * Instagram de los leads los escribe gente de afuera (ManyChat): un «=HYPERLINK(…)» por nombre
 * correría al abrir el archivo. Se le antepone un apóstrofo, que es lo que recomienda OWASP para la
 * inyección de fórmulas en CSV. Alcanza también a los «@usuario» de Instagram, que Excel intenta
 * leer como fórmula igual. Los números no pasan por acá: un -500 es un número.
 */
const PARECE_FORMULA = /^[=+\-@\t\r]/;

/**
 * El texto de una celda tal como queda escrito. Es lo que muestra la vista previa.
 *
 * Un número sale sin notación científica ni el ruido de la coma flotante (0.1 + 0.2), con hasta
 * seis decimales y el separador decimal del formato.
 */
export const textoDeCelda = (valor, formato) => {
    if (valor === null || valor === undefined) return '';
    if (typeof valor === 'number') {
        if (!Number.isFinite(valor)) return '';
        return String(Math.round(valor * 1e6) / 1e6).replace('.', formato.decimal);
    }
    if (typeof valor === 'boolean') return valor ? 'Sí' : 'No';
    // Un objeto no debería llegar nunca (lo cuida el test de `exportarColumnas`); si llega, mejor su
    // etiqueta o nada que «[object Object]».
    const texto = typeof valor === 'object' ? String(valor.label ?? '') : String(valor);
    return PARECE_FORMULA.test(texto) ? `'${texto}` : texto;
};

/**
 * Un campo listo para la línea: entre comillas si trae el separador, comillas o un salto de línea,
 * con las comillas de adentro duplicadas (RFC 4180). El resto va tal cual.
 */
export const escaparCampo = (texto, separador) => (
    texto.includes(separador) || /["\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto);

/** Las celdas de cada fila, como texto: la vista previa y el archivo leen esto mismo. */
export const celdasDe = (filas, columnas, formato) => filas.map(
    fila => columnas.map(c => textoDeCelda(c.valor(fila), formato)));

/** El archivo entero: BOM, encabezados y una línea por fila, con fin de línea de Windows (CRLF). */
export const armarCsv = ({ filas, columnas, formato }) => {
    const lineas = [columnas.map(c => c.header), ...celdasDe(filas, columnas, formato)]
        .map(celdas => celdas.map(t => escaparCampo(t, formato.separador)).join(formato.separador));
    return `${BOM}${lineas.join('\r\n')}\r\n`;
};

/**
 * El nombre por defecto: la tabla y el período, `ventas_2026-10-01_2026-10-31.csv`.
 *
 * La cartera (Clientes) no se acota al período —es un saldo a hoy, ver `ComercialService.clientes`—,
 * así que lleva la fecha de hoy: con las del período diría que son los clientes de ese mes, y no lo
 * son. Lo mismo si todavía no se sabe el período.
 */
export const nombreDeArchivo = (tabla, fechas, hoy = localToday()) => {
    if (tabla === 'clientes' || !fechas?.start || !fechas?.end) return `${tabla}_${hoy}.csv`;
    return `${tabla}_${String(fechas.start).slice(0, 10)}_${String(fechas.end).slice(0, 10)}.csv`;
};

/** Lo que escribió el usuario, sin los caracteres que Windows no acepta en un nombre y con `.csv`. */
export const nombreValido = (escrito, porDefecto) => {
    const limpio = String(escrito || '').replace(/[\\/:*?"<>|]+/g, '-').trim();
    if (!limpio || limpio === '.csv') return porDefecto;
    return /\.csv$/i.test(limpio) ? limpio : `${limpio}.csv`;
};

/** Descarga el texto como archivo: un Blob y un link temporal que se clickea y se va. */
export const descargarCsv = (contenido, nombre) => {
    const url = URL.createObjectURL(new Blob([contenido], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = nombre;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Después del clic: revocarla en el mismo tick cancela la descarga en algunos navegadores.
    setTimeout(() => URL.revokeObjectURL(url), 0);
};
