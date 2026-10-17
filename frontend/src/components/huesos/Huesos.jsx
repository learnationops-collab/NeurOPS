import React from 'react';
import clsx from 'clsx';
import { Skeleton, SkeletonBlock, skeletonDelay, useEntryWindow } from '../standard';
import './huesos.css';

/**
 * Adaptador: los huesos ahora los dibuja el esqueleto estándar (`components/standard/Skeleton.jsx`,
 * receta en la skill ui-builder). Esto traduce los nombres de siempre (`alto`, `ancho`, `paso`,
 * `rotulo`) para que las pantallas que ya los usan (mazo del closer, tablero comercial, ficha) no
 * cambien. Código nuevo usa los estándar directamente.
 *
 * El hueso conserva la clase `hueso` para quien lo busque por ella (tests, ajustes por pantalla).
 */

/** El retraso de entrada del elemento número `i`, ya topeado. Lo usan también las filas reales. */
export const escalonDe = skeletonDelay;

/** La ventana en la que las filas reales entran escalonadas: `[entrando, abrir]`. */
export const useVentanaDeEntrada = useEntryWindow;

export const Hueso = ({ alto = 14, ancho, radio, paso = 0, style, className }) => (
    <SkeletonBlock height={alto} width={ancho} radius={radio} step={paso} style={style}
        className={clsx('hueso', className)} />
);

/**
 * El renglón de un texto, con su hueso centrado adentro: una caja del alto exacto del renglón (no
 * márgenes, que colapsan entre bloques hermanos y achicaban el esqueleto). En columna para que un
 * hueso sin `ancho` ocupe todo el renglón.
 */
export const Renglon = ({ alto, children, style }) => (
    <div aria-hidden="true"
        style={{ height: alto, display: 'flex', flexDirection: 'column', justifyContent: 'center', ...style }}>
        {children}
    </div>
);

/** El envoltorio de un esqueleto: `role="status"` con el rótulo; los huesos van con `aria-hidden`. */
export const Esqueleto = ({ rotulo = 'Cargando…', children, className, style }) => (
    <Skeleton label={rotulo} className={className} style={style}>{children}</Skeleton>
);

export default Hueso;
