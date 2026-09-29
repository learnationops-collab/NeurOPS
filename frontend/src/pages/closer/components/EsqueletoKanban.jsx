import React from 'react';
import { Esqueleto, Hueso, escalonDe } from '../../../components/huesos/Huesos';

/**
 * El kanban de Confirmar y de Reportar mientras llega el mazo: las mismas columnas, con su título
 * y su punto de color, y tarjetas con la forma de `.kcard-v6`, en vez de un círculo girando.
 *
 * Pedido del usuario (29/sep/2026): "al entrar como closer, en las pestañas de confirmar reportar
 * no hay un esqueleto sino una carga con un círculo dando vueltas; eso no me gusta". Y había una
 * razón de layout además del gusto: el spinner medía unos 120 px y el kanban mide como mínimo 400
 * (el `min-height` de `.kcol-v6`), así que al llegar los datos todo lo de abajo saltaba.
 *
 * Los títulos de las columnas van escritos y no en hueso, como el encabezado de la tabla en
 * `EsqueletoRevisar`: se saben antes de la respuesta y leerlos adelanta qué viene. Lo único del
 * encabezado que depende del servidor es el contador, y ése sí es hueso.
 *
 * Dos tarjetas por columna. Con la cabecera suman casi exactamente los 400 px mínimos de la
 * columna, así que una bandeja real de hasta dos tarjetas por columna no se mueve al llegar, y una
 * más larga sólo crece hacia abajo, sin correr nada de lo que ya estaba a la vista.
 */

const TARJETAS_POR_COLUMNA = 2;

/**
 * Una tarjeta en hueso, pieza por pieza con las medidas de `.kcard-v6` en `index.css`: cada hueso
 * va dentro del alto de LÍNEA del texto que reemplaza (no del alto de la letra), que es lo que
 * ocupa el texto real. Así la tarjeta en hueso mide lo mismo que la de verdad: 147 px la que
 * tiene botón de acción y 134 la que ya está hecha, con su sello verde en vez del botón.
 *
 * La caja es un `.kcard-v6` de verdad: el mismo fondo, sombra y radio, y la misma entrada
 * (`cardRiseIn`) con el mismo escalón que las tarjetas reales, así el paso del hueso al dato no
 * cambia de ritmo. Sin puntero: no hay nada que abrir todavía.
 */
const HuesoTarjeta = ({ paso, hecha }) => (
    <div className="kcard-v6" aria-hidden="true"
        style={{ pointerEvents: 'none', animationDelay: `${escalonDe(paso)}ms` }}>
        {/* La cuenta regresiva de arriba a la derecha (`.when-v6`: absoluta, 13,5 px). */}
        <Hueso alto={12} ancho={58} paso={paso} style={{ position: 'absolute', top: 14, right: 12 }} />
        {/* El nombre: 18 px de letra en una línea de 27. */}
        <Hueso alto={17} ancho="52%" paso={paso} style={{ margin: '5px 0' }} />
        {/* El @ de Instagram (`.m-v6`): 2 px de margen y una línea de 17. */}
        <Hueso alto={10} ancho="34%" paso={paso} style={{ margin: '6px 0 3px' }} />
        {/* Las etiquetas de origen y examen: pastillas de 18 px, 8 px por debajo. */}
        <div className="flex gap-1.5 mt-2">
            <Hueso alto={18} ancho={64} radio={4} paso={paso} />
            <Hueso alto={18} ancho={46} radio={4} paso={paso} />
        </div>
        {hecha
            ? <Hueso alto={24} radio={8} paso={paso} style={{ marginTop: 10 }} />
            : <Hueso alto={36} radio={10} paso={paso} style={{ marginTop: 11 }} />}
    </div>
);

/**
 * `columnas` es la lista de columnas con lo que se sabe de antemano: la clase que pinta el punto
 * (`k1-v6`/`k2-v6`/`k3-v6`), el título, si sus tarjetas ya están hechas (sello en vez de botón) y
 * si la columna abre con un subgrupo (`.ksub-v6`, como "Sin contactar" dentro de "Por confirmar").
 * Con dos columnas se usa la variante `kb2-v6`, igual que el kanban real.
 *
 * El escalón se cuenta por renglón del tablero, de izquierda a derecha y de arriba abajo, igual
 * que el de las tarjetas reales: primero la primera tarjeta de cada columna, después la segunda.
 */
const EsqueletoKanban = ({ columnas, rotulo = 'Cargando…' }) => (
    <Esqueleto rotulo={rotulo} className={`kb-v6${columnas.length === 2 ? ' kb2-v6' : ''}`}>
        {columnas.map((col, c) => (
            <div key={col.titulo} className={`kcol-v6 ${col.clase}`} aria-hidden="true">
                <div className="kch-v6">
                    <span className="dt-v6"></span>
                    <b>{col.titulo}</b>
                    {/* El contador (`.n-v6`): una pastilla de 22 px de alto. */}
                    <Hueso alto={22} ancho={30} radio={99} paso={c} />
                </div>
                <div className="kbody-v6">
                    {col.subgrupo && (
                        <div className="ksub-v6" style={{ minHeight: 20 }}>
                            <Hueso alto={9} ancho={84} paso={c} />
                        </div>
                    )}
                    {Array.from({ length: TARJETAS_POR_COLUMNA }, (_, i) => (
                        <HuesoTarjeta key={i} paso={i * columnas.length + c} hecha={col.hecha} />
                    ))}
                </div>
            </div>
        ))}
    </Esqueleto>
);

export default EsqueletoKanban;
