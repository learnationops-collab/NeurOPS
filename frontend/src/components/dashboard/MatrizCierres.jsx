import { useEffect, useState } from 'react';
import MetricaClicable from './MetricaClicable';
import './matriz-cierres.css';

/**
 * El close rate en sus cuatro lecturas: filas sin / con señas, columnas por llamada / por
 * presentación. Cada celda es una tasa con su numerador y su denominador.
 *
 * Pedido del usuario (30/09/2026): el close rate solo cuenta pago completo y split pay; la seña es
 * una reserva. Pero ver cuánto suman las señas ayuda a entender qué está pasando con los cierres,
 * así que se muestran las dos cosas lado a lado en vez de mezclarlas en un solo número.
 *
 * Es UNA pieza para los dos tableros —el panel Cierre del dashboard comercial y el dashboard del
 * closer— porque los dos backends devuelven el mismo bloque `cierres` (ver `matriz_de_cierres` en
 * `closer_service.py`). Lo único que cambia entre tableros es el tooltip de cada uno, que llega por
 * `Ayuda` con la forma `{ titulo, texto }`.
 *
 * Está pensada para reestilarse sin tocar la lógica: el marcado es una tabla común con clases
 * `mc-*` (ver `matriz-cierres.css`) y los dos colores salen de `--mc-sin` / `--mc-con`.
 */

export const FILAS = [
    {
        key: 'sin_senas', label: 'Sin señas',
        numerador: 'ventas (pago completo o split pay)',
        ayuda: 'El close rate de verdad: solo cuentan los pagos completos y los split pay. Una seña '
            + 'es una reserva, no una venta, así que acá no entra.',
    },
    {
        key: 'con_senas', label: 'Con señas',
        numerador: 'ventas + señas sin completar',
        ayuda: 'Las ventas más los leads que dejaron una seña y todavía no pagaron el programa. La '
            + 'seña que después se completó ya está en las ventas: cuenta una sola vez.',
    },
];

export const COLUMNAS = [
    {
        key: 'por_llamada', label: 'Por llamada',
        denominador: 'llamadas con show up', unidad: ['llamada', 'llamadas'],
        ayuda: 'Sobre todas las llamadas a las que el lead se presentó.',
    },
    {
        key: 'por_presentacion', label: 'Por presentación',
        denominador: 'presentaciones', unidad: ['presentación', 'presentaciones'],
        ayuda: 'Sobre las llamadas donde además se llegó a presentar la oferta: saca del '
            + 'denominador a las que se cortaron antes del precio.',
    },
];

/** Un conteo: los enteros sin decimales, un promedio diario con uno solo. */
const n = (valor) => {
    const x = Number(valor) || 0;
    return Number.isInteger(x) ? String(x) : x.toFixed(1);
};

/** Una tasa: `null` es "—" (sin denominador no hay tasa), nunca 0%. */
export const pctDe = (valor) => (valor === null || valor === undefined ? '—' : `${valor}%`);

/** Qué dice el tooltip de una celda: la cuenta en palabras y con los números del período. */
export const textoDeCelda = (fila, col, celda) => `${fila.numerador} ÷ ${col.denominador}: `
    + `${n(celda?.num)} de ${n(celda?.den)}. ${fila.key === 'con_senas'
        ? 'Incluye las señas: no es el close rate, es el compromiso de compra.'
        : 'Es el close rate.'}`;

/** Tooltip mínimo para cuando el tablero no pasa el suyo: el texto va en el `title`. */
const AyudaSimple = ({ titulo, texto }) => (
    <span className="mc-i" role="note" tabIndex={0} title={`${titulo}: ${texto}`}
        aria-label={`${titulo}: ${texto}`}>i</span>
);

/** Arranca en false y pasa a true después del primer pintado: es lo que hace crecer la barra. */
const useMontado = () => {
    const [montado, setMontado] = useState(false);
    useEffect(() => {
        const id = requestAnimationFrame(() => setMontado(true));
        return () => cancelAnimationFrame(id);
    }, []);
    return montado;
};

const Celda = ({ fila, col, celda, destino, irA, Ayuda, orden }) => {
    const montado = useMontado();
    const titulo = `${fila.label} · ${col.label}`;
    const ancho = Math.max(0, Math.min(100, celda?.pct || 0));
    return (
        <td className="mc-celda" style={{ '--mc-orden': orden }}>
            <div className="mc-cifra">
                {/* `<b>` y `<small>` y no `<span>`: el CSS global fuerza el peso de todo span a
                    400 con !important, y estas dos son las etiquetas que conservan el suyo. */}
                <MetricaClicable irA={irA} destino={destino} vacio={!celda?.num}
                    detalle={`${titulo} · ${n(celda?.num)} de ${n(celda?.den)}`}
                    className="mc-pct">
                    <b>{pctDe(celda?.pct)}</b>
                </MetricaClicable>
                <Ayuda titulo={titulo} texto={textoDeCelda(fila, col, celda)} />
            </div>
            <small className="mc-frac">
                {n(celda?.num)} de {n(celda?.den)} {celda?.den === 1 ? col.unidad[0] : col.unidad[1]}
            </small>
            <span className="mc-riel" aria-hidden="true">
                <i style={{ width: montado ? `${ancho}%` : 0 }} />
            </span>
        </td>
    );
};

const MatrizCierres = ({ cierres, irA, destinos, Ayuda = AyudaSimple, className }) => {
    if (!cierres) return null;
    const sin = cierres.sin_senas?.por_llamada?.pct;
    const con = cierres.con_senas?.por_llamada?.pct;
    const brecha = sin !== null && sin !== undefined && con !== null && con !== undefined
        ? Math.round((con - sin) * 10) / 10 : null;

    return (
        <div className={`mc${className ? ` ${className}` : ''}`}>
            <table className="mc-tabla">
                <caption className="mc-oculto">
                    Close rate sin señas y con señas, por llamada y por presentación
                </caption>
                <thead>
                    <tr>
                        <th scope="col"><span className="mc-oculto">Cierres</span></th>
                        {COLUMNAS.map(col => (
                            <th key={col.key} scope="col">
                                <span className="mc-cab">{col.label}<Ayuda titulo={col.label} texto={col.ayuda} /></span>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {FILAS.map((fila, i) => (
                        <tr key={fila.key} className={`mc-fila mc-fila--${fila.key}`}>
                            <th scope="row">
                                <span className="mc-cab">
                                    <i className="mc-punto" aria-hidden="true" />
                                    {fila.label}
                                    <Ayuda titulo={fila.label} texto={fila.ayuda} />
                                </span>
                            </th>
                            {COLUMNAS.map((col, j) => (
                                <Celda key={col.key} fila={fila} col={col} orden={i * 2 + j}
                                    celda={cierres[fila.key]?.[col.key]}
                                    destino={destinos?.[fila.key]?.[col.key]}
                                    irA={irA} Ayuda={Ayuda} />
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
            {cierres.senas > 0 && (
                <p className="mc-pie">
                    {n(cierres.senas)} {cierres.senas === 1 ? 'seña' : 'señas'} sin completar
                    {brecha !== null && ` suman ${brecha} pts por llamada`}: es la distancia entre
                    reservar y cerrar.
                </p>
            )}
        </div>
    );
};

export default MatrizCierres;
