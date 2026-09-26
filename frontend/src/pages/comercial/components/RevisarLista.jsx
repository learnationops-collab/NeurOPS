import React from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import ListaAgrupable from '../../../components/listas/ListaAgrupable';
import VistaTarjetas from '../../../components/listas/VistaTarjetas';
import { fmt } from './Shared';

/**
 * Cómo se dibujan las filas de Revisar: como tabla o como tarjetas, sueltas o repartidas en grupos.
 *
 * Vive aparte de `Revisar.jsx` para no volver a pasarlo de 500 líneas, y porque las cuatro
 * combinaciones (tabla/tarjetas × suelta/agrupada) son una sola decisión de presentación: el
 * filtrado, los totales y el "mostrando X de Y" siguen viviendo allá, sobre el MISMO arreglo de
 * filas visibles que se le pasa acá. Por eso los subtotales de los grupos cierran con la tira de
 * totales de arriba.
 *
 * Las cuatro vistas llaman al mismo `onAbrirFila`: una fila y una tarjeta abren la misma ficha.
 *
 * El envoltorio lleva una `key` con el modo y la dimensión: al alternar lista/tarjetas o al
 * agrupar, React desmonta y vuelve a montar, y la vista nueva entra con su animación. Sin
 * `AnimatePresence` —la vista vieja se va sin fundido— por lo mismo que en `ListaAgrupable`: esta
 * lista se monta embebida en el mazo del closer, donde `AnimatePresence` ya dejó nodos sin
 * desmontar.
 */

/** Chip de estado con el tono que manda el backend (nunca uno elegido en el frontend). */
export const ChipTono = ({ chip }) => (chip
    ? <span className="chip" style={{ '--c': `var(--${chip.tone})` }}>{chip.label}</span>
    : null);

const Celda = ({ fila, col }) => {
    switch (col.key) {
        case 'fecha':
            return (
                <span className="celda num">
                    {fmt.fecha(fila.fecha)}
                    {fmt.hora(fila.fecha) && <span className="celda-sub num">{fmt.hora(fila.fecha)}</span>}
                </span>
            );
        case 'cliente':
            return (
                <span className="celda">
                    {fila.cliente}
                    {fila.ig && <span className="celda-sub">{fila.ig}</span>}
                </span>
            );
        case 'pre_call':
            return <ChipTono chip={fila.pre_call} />;
        case 'post_call':
            // El retraso va DEBAJO del chip de resultado: el chip dice qué pasó y la bajada dice
            // desde cuándo nadie lo carga, que es lo que hay que ir a resolver.
            return (
                <>
                    <ChipTono chip={fila.post_call} />
                    {fila.retraso_dias > 0 && (
                        <span className="celda-sub num"
                            style={{ color: 'var(--error)', fontWeight: 700 }}>
                            {fila.retraso_dias} {fila.retraso_dias === 1 ? 'día' : 'días'} sin reportar
                        </span>
                    )}
                </>
            );
        case 'estado':
            return <ChipTono chip={fila.estado} />;
        case 'tipo_pago':
            return (
                <>
                    <ChipTono chip={fila.tipo_pago} />
                    {fila.metodo && <span className="celda-sub">{fila.metodo}</span>}
                </>
            );
        case 'monto':
            return <span className="celda celda--num">{fmt.money(fila.monto)}</span>;
        case 'pagado':
            return (
                <span className="celda celda--num">
                    {fmt.money(fila.pagado)}
                    <span className="celda-sub num">{fmt.plural(fila.cobros, 'cobro', 'cobros')}</span>
                </span>
            );
        case 'deuda':
            // Cero no se escribe "$0": un cliente que no debe nada es una fila que no hay que
            // mirar, y el guión la saca del camino.
            return (
                <span className="celda celda--num"
                    style={fila.deuda > 0.01 ? { color: 'var(--error)', fontWeight: 800 } : undefined}>
                    {fila.deuda > 0.01 ? fmt.money(fila.deuda) : '—'}
                </span>
            );
        case 'cuota':
            // El chip dice en qué situación está y la bajada dice qué y cuándo cobrar, que es lo
            // que se viene a buscar acá.
            return (
                <>
                    <ChipTono chip={fila.estado} />
                    {fila.cuota_monto != null && (
                        <span className="celda-sub num"
                            style={fila.cuota_vencida ? { color: 'var(--error)', fontWeight: 700 } : undefined}>
                            {fmt.money(fila.cuota_monto)}
                            {fila.cuota_fecha ? ` · ${fmt.fecha(fila.cuota_fecha)}` : ' · sin plan'}
                        </span>
                    )}
                </>
            );
        case 'programa':
            return (
                <span className="chip" style={{
                    '--c': fila.programa === 'Residency Roadmap'
                        ? 'var(--prog-elite-b)' : 'var(--prog-ace)',
                }}>
                    {fila.programa}
                </span>
            );
        case 'mensajes':
            return <span className="celda celda--num">{fmt.num(fila.mensajes)}</span>;
        case 'ver':
            return <span className="celda-ver"><ArrowRight size={14} /></span>;
        default:
            return <span className="celda">{fila[col.key] || '—'}</span>;
    }
};

/** Las columnas que se leen como un chip de estado: en una tarjeta van arriba, no en la lista de datos. */
const COLS_CHIP = new Set(['pre_call', 'post_call', 'estado']);
/** Y estas ya están en el encabezado de la tarjeta o no son un dato. */
const COLS_FUERA = new Set(['cliente', 'ver']);

/** Una tarjeta se arma con las MISMAS columnas de la tabla, así ninguna vista muestra menos. */
const camposDe = (def) => (fila) => def.cols
    .filter(c => !COLS_FUERA.has(c.key) && !COLS_CHIP.has(c.key))
    .map(c => ({ rotulo: c.header || c.key, valor: <Celda fila={fila} col={c} /> }));

const chipsDe = (def) => (fila) => def.cols
    .filter(c => COLS_CHIP.has(c.key))
    .map(c => <Celda key={c.key} fila={fila} col={c} />);

const claveDe = (fila) => `${fila.tipo}-${fila.id}`;

/* Las tres piezas viven en el módulo y no dentro de `RevisarLista`. Un componente declarado en el
   cuerpo de otro es una función NUEVA en cada render, así que React lo trata como un tipo distinto
   y desmonta y vuelve a montar todo su subárbol: con la lista abierta eso perdía el foco y la
   posición del scroll en cada tecla del buscador. */

const Encabezado = ({ def, plantilla }) => (
    <div className="tabla-cab" style={{ '--cols': plantilla }}>
        {def.cols.map(c => <span key={c.key}>{c.header}</span>)}
    </div>
);

const Filas = ({ def, filas, plantilla, onAbrirFila }) => filas.map(fila => (
    <div key={claveDe(fila)} className="tabla-fila"
        role="button" tabIndex={0} style={{ '--cols': plantilla }}
        aria-label={`Abrir ${fila.cliente}`}
        onClick={() => onAbrirFila(fila)}
        onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onAbrirFila(fila);
            }
        }}>
        {def.cols.map(c => (
            // `data-h` es el rótulo que el CSS pinta a la izquierda de cada dato cuando la
            // tabla se apila en móvil.
            <div key={c.key} data-h={c.header}>
                <Celda fila={fila} col={c} />
            </div>
        ))}
    </div>
));

const Tarjetas = ({ def, filas, onAbrirFila }) => (
    <VistaTarjetas filas={filas} clave={claveDe} onAbrir={onAbrirFila}
        titulo={(f) => f.cliente} subtitulo={(f) => f.ig}
        chips={chipsDe(def)} campos={camposDe(def)} />
);

const RevisarLista = ({ def, visibles, plantilla, onAbrirFila, dimension, modo }) => {
    const quieto = useReducedMotion();
    const esTarjetas = modo === 'tarjetas';

    const renderFilas = (filas) => (esTarjetas
        ? (
            <div style={{ padding: 'var(--s4)' }}>
                <Tarjetas def={def} filas={filas} onAbrirFila={onAbrirFila} />
            </div>
        )
        : <Filas def={def} filas={filas} plantilla={plantilla} onAbrirFila={onAbrirFila} />);

    const cuerpo = () => {
        if (dimension) {
            return (
                <>
                    {/* Agrupada y en tabla, el encabezado va UNA vez arriba de todos los grupos:
                        sin él las columnas quedaban sin rótulo, y repetirlo por grupo convertía
                        la lista en cinco tablas en vez de una repartida. */}
                    {!esTarjetas && <Encabezado def={def} plantilla={plantilla} />}
                    <ListaAgrupable filas={visibles} dimension={dimension} renderFilas={renderFilas}
                        formatoMonto={fmt.money} />
                </>
            );
        }
        if (esTarjetas) return <Tarjetas def={def} filas={visibles} onAbrirFila={onAbrirFila} />;
        return (
            <div className="tabla">
                <Encabezado def={def} plantilla={plantilla} />
                <Filas def={def} filas={visibles} plantilla={plantilla} onAbrirFila={onAbrirFila} />
            </div>
        );
    };

    return (
        <motion.div key={`${modo}-${dimension?.key || 'suelta'}`}
            initial={quieto ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={quieto ? { duration: 0 } : { duration: .2, ease: 'easeOut' }}>
            {cuerpo()}
        </motion.div>
    );
};

export default RevisarLista;
