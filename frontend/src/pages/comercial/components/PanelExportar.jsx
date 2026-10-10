import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Download, FileText, X } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { fmt } from './Shared';
import { alternarColumna, columnasElegidas, columnasExportables, eleccionInicial, marcarTodas,
    moverColumna } from './exportarColumnas';
import { FORMATOS, armarCsv, celdasDe, descargarCsv, formatoDe, nombreDeArchivo, nombreValido } from './exportarCsv';

/**
 * Exportar: el CSV de Revisar, decidido antes de bajarlo (10/10/2026).
 *
 * Pedido del usuario: «una opción para exportar, en un solo lugar, como el filtro inteligente, que
 * me permita decidir qué y cómo exportarlo, con una vista previa de cómo se verán las columnas».
 * Por eso es el mismo panel que Configurar (`.config-panel`: mismo ancla, 680px, y debajo de 900px
 * se despliega en su fila) y no un modal: se decide mirando la lista.
 *
 * Tres decisiones y una prueba:
 *  · Qué filas: lo que se está viendo (búsqueda, facetas y filtro rápido, en el orden de la lista)
 *    o todo lo que trajo el período.
 *  · Qué columnas y en qué orden (ver `exportarColumnas.js`). Arranca con las que se ven; la última
 *    elección se recuerda por tabla.
 *  · Cómo: el separador del formato (ver `exportarCsv.js`).
 *  · La vista previa: las primeras filas con el texto EXACTO de cada celda, que es lo mismo que va
 *    a quedar escrito (`celdasDe` alimenta las dos cosas).
 *
 * Entra con un desliz corto de framer-motion; con movimiento reducido aparece quieto. Sin
 * `AnimatePresence` a propósito, como el resto de Revisar: vive también dentro del mazo del closer.
 */

const FILAS_PREVIA = 5;

/* La memoria es una comodidad de quien exporta, nunca un dato: si el navegador no deja leer o
   escribir (ventana privada, almacenamiento bloqueado), el panel arranca con lo que se ve. */
const CLAVE_COLUMNAS = (tabla) => `comercial_exportar_${tabla}`;
const CLAVE_FORMATO = 'comercial_exportar_formato';

const leer = (clave) => {
    try {
        const crudo = window.localStorage.getItem(clave);
        return crudo ? JSON.parse(crudo) : null;
    } catch {
        return null;
    }
};

const guardar = (clave, valor) => {
    try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        /* sin memoria: la próxima vez arranca de cero, que también sirve */
    }
};

/** Una opción de radio con la caja redonda del panel (`.config-op`, el mismo dibujo que las facetas). */
const Opcion = ({ on, onClick, children, cuenta }) => (
    <button type="button" className="config-op" role="radio" aria-checked={on} onClick={onClick}>
        <span className="config-caja config-caja--radio" aria-hidden="true" />
        <span className="trunc">{children}</span>
        {cuenta !== undefined && <span className="cuenta">{cuenta}</span>}
    </button>
);

const PanelExportar = ({ def, tabla, colsVistas, filasVista, filasTodas, fechas, onCerrar }) => {
    const quieto = useReducedMotion();
    const exportables = useMemo(() => columnasExportables(def), [def]);
    const [eleccion, setEleccion] = useState(
        () => eleccionInicial(exportables, colsVistas, leer(CLAVE_COLUMNAS(tabla))));
    const [cuales, setCuales] = useState('vista');
    const [formatoKey, setFormatoKey] = useState(() => formatoDe(leer(CLAVE_FORMATO)).key);
    // `null` es «el de siempre»: si el período llega después de abrir el panel, el nombre lo sigue
    // hasta que el usuario escriba el suyo.
    const [nombreEscrito, setNombreEscrito] = useState(null);

    const porDefecto = nombreDeArchivo(tabla, fechas);
    const formato = formatoDe(formatoKey);
    const filas = cuales === 'vista' ? filasVista : filasTodas;
    const elegidas = useMemo(() => columnasElegidas(eleccion, exportables), [eleccion, exportables]);
    const previa = useMemo(() => celdasDe(filas.slice(0, FILAS_PREVIA), elegidas, formato),
        [filas, elegidas, formato]);
    const porClave = useMemo(() => new Map(exportables.map(c => [c.key, c])), [exportables]);

    // Se guarda solo lo que el usuario cambia: guardar al abrir congelaría las columnas de ese día,
    // y pasar después a las de la Academia ya no cambiaría con qué arranca el panel.
    const cambiarEleccion = (nueva) => {
        setEleccion(nueva);
        guardar(CLAVE_COLUMNAS(tabla), { orden: nueva.map(c => c.key), elegidas: nueva.filter(c => c.on).map(c => c.key) });
    };
    const elegirFormato = (key) => {
        setFormatoKey(key);
        guardar(CLAVE_FORMATO, key);
    };

    const exportar = () => {
        descargarCsv(armarCsv({ filas, columnas: elegidas, formato }), nombreValido(nombreEscrito ?? porDefecto, porDefecto));
        onCerrar();
    };

    // La cartera no es «del período» (es un saldo a hoy): decirlo así sería decir algo que no es.
    const rotuloTodas = tabla === 'clientes' ? 'Toda la cartera' : 'Todo el período';
    const posicion = new Map(elegidas.map((c, i) => [c.key, i + 1]));

    return (
        <motion.div className="config-panel config-panel--exportar" role="dialog" aria-label="Exportar"
            initial={quieto ? false : { opacity: 0, y: -8, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={quieto ? { duration: 0 } : { duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
            <div className="config-cab">
                <p className="t-h3" style={{ fontSize: 16 }}>Exportar</p>
                <small className="exp-tipo">CSV</small>
                <button type="button" className="ibtn ibtn--sm" style={{ marginLeft: 'auto' }}
                    onClick={onCerrar} aria-label="Cerrar">
                    <X size={15} />
                </button>
            </div>

            {/* Dos decisiones de dos opciones cada una, lado a lado: la grilla queda pareja. */}
            <div className="exp-dos">
                <div className="config-col" role="radiogroup" aria-label="Qué filas">
                    <p className="t-rotulo">Qué filas</p>
                    <Opcion on={cuales === 'vista'} onClick={() => setCuales('vista')}
                        cuenta={fmt.num(filasVista.length)}>
                        Lo que estás viendo
                    </Opcion>
                    <Opcion on={cuales === 'todas'} onClick={() => setCuales('todas')}
                        cuenta={fmt.num(filasTodas.length)}>
                        {rotuloTodas}
                    </Opcion>
                </div>
                <div className="config-col" role="radiogroup" aria-label="Formato">
                    <p className="t-rotulo">Formato</p>
                    {FORMATOS.map(f => (
                        <Opcion key={f.key} on={formatoKey === f.key} onClick={() => elegirFormato(f.key)}>
                            {`${f.label} (${f.separador})`}
                        </Opcion>
                    ))}
                </div>
            </div>

            <div className="exp-seccion">
                <div className="exp-cab">
                    <p className="t-rotulo">
                        Columnas
                        <small className="exp-cuenta num">{` · ${elegidas.length} de ${eleccion.length}`}</small>
                    </p>
                    <button type="button" className="btn btn--linea btn--sm"
                        disabled={elegidas.length === eleccion.length}
                        onClick={() => cambiarEleccion(marcarTodas(eleccion, true))}>
                        Todas
                    </button>
                    <button type="button" className="btn btn--linea btn--sm" disabled={elegidas.length === 0}
                        onClick={() => cambiarEleccion(marcarTodas(eleccion, false))}>
                        Ninguna
                    </button>
                </div>
                {/* El número de la derecha es el lugar de la columna en el archivo. Las flechas mueven
                    también las apagadas: así se puede dejar lista una columna antes de prenderla. */}
                <ul className="config-lista exp-lista" aria-label="Columnas a exportar">
                    {eleccion.map((c, i) => {
                        const header = porClave.get(c.key)?.header || c.key;
                        return (
                            <li key={c.key} className="exp-col">
                                <button type="button" className="config-op" role="checkbox" aria-checked={c.on}
                                    onClick={() => cambiarEleccion(alternarColumna(eleccion, c.key))}>
                                    <span className="config-caja" aria-hidden="true">{c.on ? '✓' : ''}</span>
                                    <span className="trunc">{header}</span>
                                    {c.on && <span className="cuenta">{posicion.get(c.key)}</span>}
                                </button>
                                <button type="button" className="exp-mover" aria-label={`Subir ${header}`}
                                    disabled={i === 0} onClick={() => cambiarEleccion(moverColumna(eleccion, c.key, -1))}>
                                    <ArrowUp size={14} />
                                </button>
                                <button type="button" className="exp-mover" aria-label={`Bajar ${header}`}
                                    disabled={i === eleccion.length - 1}
                                    onClick={() => cambiarEleccion(moverColumna(eleccion, c.key, 1))}>
                                    <ArrowDown size={14} />
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="exp-seccion">
                <div className="exp-cab">
                    <p className="t-rotulo">Vista previa</p>
                    <small className="exp-cuenta">
                        {filas.length > FILAS_PREVIA ? `primeras ${FILAS_PREVIA} filas` : 'todas las filas'}
                    </small>
                </div>
                {/* Cada celda con su texto exacto, el que queda en el archivo; el `title` lo deja leer
                    entero cuando la columna lo corta. */}
                <div className="exp-previa" role="region" aria-label="Vista previa" tabIndex={0}>
                    {elegidas.length === 0 ? (
                        <p className="t-cap mut40 exp-previa-vacia">Elegí al menos una columna.</p>
                    ) : (
                        <table>
                            <thead>
                                <tr>{elegidas.map(c => <th key={c.key} scope="col">{c.header}</th>)}</tr>
                            </thead>
                            <tbody>
                                {previa.map((celdas, i) => (
                                    <tr key={i}>
                                        {celdas.map((t, j) => <td key={elegidas[j].key} title={t || undefined}>{t}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {elegidas.length > 0 && filas.length === 0 && (
                        <p className="t-cap mut40 exp-previa-vacia">No hay filas para exportar.</p>
                    )}
                </div>
                <p className="t-cap mut40 num exp-medida">
                    {`${fmt.plural(filas.length, 'fila', 'filas')} × ${fmt.plural(elegidas.length, 'columna', 'columnas')}`}
                </p>
            </div>

            <div className="config-pie exp-pie">
                <label className="busca busca--sm exp-nombre">
                    <span className="mut40" style={{ display: 'flex' }}><FileText size={14} /></span>
                    <input type="text" value={nombreEscrito ?? porDefecto} spellCheck={false}
                        aria-label="Nombre del archivo" onChange={(e) => setNombreEscrito(e.target.value)} />
                </label>
                <button type="button" className="btn btn--cta btn--sm"
                    disabled={elegidas.length === 0 || filas.length === 0} onClick={exportar}>
                    <Download size={14} />
                    Exportar CSV
                </button>
            </div>
        </motion.div>
    );
};

export default PanelExportar;
