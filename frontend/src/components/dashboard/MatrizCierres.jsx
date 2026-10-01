import MetricaClicable from './MetricaClicable';
import './pareja.css';
import './matriz-cierres.css';

/**
 * El close rate en sus cuatro lecturas: ventas solas o con señas, por llamada o por presentación.
 * Cada cifra es una tasa con su numerador y su denominador.
 *
 * Pedido del usuario (30/09/2026): el close rate solo cuenta pago completo y split pay; la seña es
 * una reserva. Pero ver cuánto suman las señas ayuda a entender qué está pasando con los cierres,
 * así que se muestran las dos cosas lado a lado en vez de mezclarlas en un solo número.
 *
 * Es UNA pieza para los dos tableros —el panel Cierre del dashboard comercial y el dashboard del
 * closer— porque los dos backends devuelven el mismo bloque `cierres` (ver `matriz_de_cierres` en
 * `closer_service.py`). Lo único que cambia entre tableros es el tooltip de cada uno, que llega por
 * `Ayuda` con la forma `{ titulo, texto }`, y la cabecera, que es de cada tablero: por eso la
 * leyenda (`LeyendaCierres`) se exporta aparte, para que cada uno la ponga en la suya.
 *
 * El diseño es el de Kerwin (30/09/2026): arriba una tira con la tasa de presentación —la que
 * explica la distancia entre las dos columnas— y debajo una tarjeta por columna, con las ventas
 * solas y, debajo, con señas: la barra de "con señas" apila el azul de las ventas y el rosa de
 * las señas, y la pastilla dice cuántos puntos suman las señas en esa columna.
 */

export const FILAS = [
    {
        key: 'sin_senas', label: 'Ventas',
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

const plural = (valor, uno, varios) => `${n(valor)} ${Number(valor) === 1 ? uno : varios}`;

/** Una tasa: `null` es "—" (sin denominador no hay tasa), nunca 0%. */
export const pctDe = (valor) => (valor === null || valor === undefined ? '—' : `${valor}%`);

/** Lo que suman las señas en una columna, en puntos: con señas menos sin señas. */
export const brechaDe = (sin, con) => (sin === null || sin === undefined || con === null
    || con === undefined ? null : Math.round((con - sin) * 10) / 10);

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

/** El "i" va envuelto para poder atenuarlo sin tocar el tooltip de cada tablero. */
const ConAyuda = ({ Ayuda, titulo, texto }) => (
    <span className="mc-ayuda"><Ayuda titulo={titulo} texto={texto} /></span>
);

/** Una tasa en grande. */
const Pct = ({ valor, className }) => <b className={className}>{pctDe(valor)}</b>;

/** "12 de 84": el numerador resaltado, el resto apagado. */
const Fraccion = ({ num, den }) => (
    <small className="mc-frac"><b>{n(num)}</b> de {n(den)}</small>
);

const acotar = (x) => Math.max(0, Math.min(100, Number(x) || 0));

/**
 * Riel con uno o más tramos apilados. Cada tramo crece desde 0 al montar (keyframes, sin JS: así
 * crece aunque el primer cuadro llegue tarde) y, si el dato cambia, se desliza a su ancho nuevo.
 * `demora` escalona: el rosa de las señas arranca cuando el azul de las ventas ya llegó.
 */
const Riel = ({ tramos, className }) => (
    <span className={`mc-riel${className ? ` ${className}` : ''}`} aria-hidden="true">
        {tramos.map(t => (
            <i key={t.tono} className={`mc-tramo mc-tramo--${t.tono}`}
                style={{ '--ancho': `${acotar(t.ancho)}%`, '--demora': `${t.demora || 0}ms` }} />
        ))}
    </span>
);

/** Arriba de la matriz: de las llamadas con show up, en cuántas se llegó a presentar la oferta. */
const TiraPresentacion = ({ celda, destino, irA, Ayuda }) => (
    <div className="mc-tira">
        <span className="mc-tira-rot">
            <small className="mc-rot">Presentación</small>
            <ConAyuda Ayuda={Ayuda} titulo="Presentación"
                texto={`Presentaciones ÷ llamadas con show up: ${n(celda.num)} de ${n(celda.den)}. `
                    + 'Es la que explica la distancia entre las dos columnas: cuánto se pierde antes '
                    + 'de mostrar la oferta es un problema distinto de no cerrar.'} />
        </span>
        <Riel className="mc-riel--tira" tramos={[{ tono: 'presenta', ancho: celda.pct, demora: 120 }]} />
        <span className="mc-tira-cifra">
            <MetricaClicable irA={irA} destino={destino} vacio={!celda.num} subrayar={false}
                detalle={`Presentación · ${n(celda.num)} de ${n(celda.den)}`}>
                <Pct valor={celda.pct} className="mc-tira-pct" />
            </MetricaClicable>
            <Fraccion num={celda.num} den={celda.den} />
        </span>
    </div>
);

/** Una lectura dentro de la tarjeta: rótulo, tasa grande con su fracción y la barra. */
const Lectura = ({ fila, col, celda, tramos, pastilla, destino, irA, Ayuda }) => {
    const titulo = `${fila.label} · ${col.label}`;
    return (
        <div className={`mc-lectura mc-lectura--${fila.key}`} role="group" aria-label={titulo}>
            <div className="mc-lectura-cab">
                <small className="mc-rot">{fila.label}</small>
                {pastilla}
                <ConAyuda Ayuda={Ayuda} titulo={titulo}
                    texto={`${textoDeCelda(fila, col, celda)} ${fila.ayuda}`} />
            </div>
            <div className="mc-cifra">
                {/* `<b>` y `<small>` y no `<span>`: el CSS global fuerza el peso de todo span a
                    400 con !important, y estas dos son las etiquetas que conservan el suyo. */}
                <MetricaClicable irA={irA} destino={destino} vacio={!celda?.num} subrayar={false}
                    detalle={`${titulo} · ${n(celda?.num)} de ${n(celda?.den)}`}>
                    <Pct valor={celda?.pct} className="mc-pct" />
                </MetricaClicable>
                <Fraccion num={celda?.num} den={celda?.den} />
            </div>
            <Riel tramos={tramos} />
        </div>
    );
};

/** Una columna de la matriz como tarjeta: ventas solas arriba, con señas abajo. */
const Columna = ({ col, cierres, orden, destinos, irA, Ayuda }) => {
    const sin = cierres.sin_senas?.[col.key] || {};
    const con = cierres.con_senas?.[col.key] || {};
    const den = sin.den ?? con.den;
    const brecha = brechaDe(sin.pct, con.pct);
    // Los tramos salen de los conteos y no de las tasas redondeadas: así el azul de las dos
    // barras mide lo mismo y el rosa es exactamente lo que agregan las señas.
    const ventas = den ? (sin.num / den) * 100 : 0;
    const senas = den ? Math.max(0, ((con.num ?? 0) - (sin.num ?? 0)) / den) * 100 : 0;
    const demora = 260 + orden * 110;
    return (
        <div className="mc-col" role="group" aria-label={col.label} style={{ '--mc-orden': orden }}>
            <i className="mc-humo" aria-hidden="true" />
            <div className="mc-col-cab">
                <span className="mc-col-titulo">
                    <small className="mc-eyebrow">{col.label}</small>
                    <ConAyuda Ayuda={Ayuda} titulo={col.label} texto={col.ayuda} />
                </span>
                <small className="mc-den">{plural(den, ...col.unidad)}</small>
            </div>
            <Lectura fila={FILAS[0]} col={col} celda={sin} irA={irA} Ayuda={Ayuda}
                destino={destinos?.sin_senas?.[col.key]}
                tramos={[{ tono: 'ventas', ancho: ventas, demora }]} />
            <Lectura fila={FILAS[1]} col={col} celda={con} irA={irA} Ayuda={Ayuda}
                destino={destinos?.con_senas?.[col.key]}
                pastilla={brecha > 0 && (
                    <small className="mc-pp" title={`Las señas suman ${brecha} puntos ${col.label.toLowerCase()}`}>
                        +{brecha} pp
                    </small>
                )}
                tramos={[
                    { tono: 'ventas', ancho: ventas, demora: demora + 120 },
                    { tono: 'senas', ancho: Math.min(senas, 100 - acotar(ventas)), demora: demora + 640 },
                ]} />
        </div>
    );
};

/**
 * La leyenda de la cabecera: cuántas ventas (con su desglose pago completo + split pay) y cuántas
 * señas sin completar hay detrás de las tasas, con el color de cada una en las barras.
 */
export const LeyendaCierres = ({ cierres }) => {
    if (!cierres) return null;
    const desglose = cierres.ventas_completo !== undefined && cierres.ventas_split !== undefined;
    return (
        <span className="mc-leyenda">
            <span className="mc-ley">
                <i className="mc-ley-marca mc-ley-marca--ventas" aria-hidden="true" />
                <b>{plural(cierres.ventas, 'venta', 'ventas')}</b>
                {desglose && (
                    <small className="mc-ley-desglose">
                        {n(cierres.ventas_completo)} <abbr title="pago completo">PC</abbr>
                        {' + '}{n(cierres.ventas_split)} <abbr title="split pay">SP</abbr>
                    </small>
                )}
            </span>
            <span className="mc-ley">
                <i className="mc-ley-marca mc-ley-marca--senas" aria-hidden="true" />
                <b>{plural(cierres.senas, 'seña', 'señas')}</b>
            </span>
        </span>
    );
};

const MatrizCierres = ({ cierres, irA, destinos, Ayuda = AyudaSimple, className }) => {
    if (!cierres) return null;
    return (
        <div className={`mc${className ? ` ${className}` : ''}`}>
            {cierres.presentacion && (
                <TiraPresentacion celda={cierres.presentacion} destino={destinos?.presentacion}
                    irA={irA} Ayuda={Ayuda} />
            )}
            <div className="mc-cols pareja">
                {COLUMNAS.map((col, i) => (
                    <Columna key={col.key} col={col} cierres={cierres} orden={i}
                        destinos={destinos} irA={irA} Ayuda={Ayuda} />
                ))}
            </div>
        </div>
    );
};

export default MatrizCierres;
