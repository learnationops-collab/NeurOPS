import React from 'react';
import { ArrowRight } from 'lucide-react';
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

const RevisarLista = ({ def, visibles, plantilla, onAbrirFila, dimension, modo }) => {
    const Tabla = ({ filas }) => (
        <>
            {filas.map(fila => (
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
                        // `data-h` es el rótulo que el CSS pinta a la izquierda de cada dato
                        // cuando la tabla se apila en móvil.
                        <div key={c.key} data-h={c.header}>
                            <Celda fila={fila} col={c} />
                        </div>
                    ))}
                </div>
            ))}
        </>
    );

    const Tarjetas = ({ filas }) => (
        <VistaTarjetas filas={filas} clave={claveDe} onAbrir={onAbrirFila}
            titulo={(f) => f.cliente} subtitulo={(f) => f.ig}
            chips={chipsDe(def)} campos={camposDe(def)} />
    );

    const renderFilas = modo === 'tarjetas'
        ? (filas) => <div style={{ padding: 'var(--s4)' }}><Tarjetas filas={filas} /></div>
        : (filas) => <Tabla filas={filas} />;

    if (dimension) {
        return (
            <ListaAgrupable filas={visibles} dimension={dimension} renderFilas={renderFilas}
                formatoMonto={fmt.money} />
        );
    }

    if (modo === 'tarjetas') return <Tarjetas filas={visibles} />;

    return (
        <div className="tabla">
            <div className="tabla-cab" style={{ '--cols': plantilla }}>
                {def.cols.map(c => <span key={c.key}>{c.header}</span>)}
            </div>
            <Tabla filas={visibles} />
        </div>
    );
};

export default RevisarLista;
