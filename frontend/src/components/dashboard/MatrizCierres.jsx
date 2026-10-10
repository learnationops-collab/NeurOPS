import { useEffect, useRef } from 'react';
import MetricaClicable from './MetricaClicable';
import './pareja.css';
import './matriz-cierres.css';

/**
 * El cierre en sus cuatro lecturas: las ventas y las señas, cada una por llamada y por
 * presentación. Cada cifra es una tasa con su numerador y su denominador.
 *
 * Pedido del usuario (30/09/2026): el close rate solo cuenta pago completo y split pay; la seña es
 * una reserva. Pero ver las señas ayuda a entender qué está pasando con los cierres, así que se
 * muestran las dos cosas lado a lado en vez de mezclarlas en un solo número. Hasta el 09/10/2026 la
 * segunda fila era "con señas" (ventas + señas); el usuario pidió sacarle las ventas —«que solo se
 * vean las señas ahí»—, así que ahora cada fila cuenta lo suyo y ninguna repite a la otra.
 *
 * Es UNA pieza para los dos tableros —el panel Cierre del dashboard comercial y el dashboard del
 * closer— porque los dos backends devuelven el mismo bloque `cierres` (ver `matriz_de_cierres` en
 * `closer_service.py`). Lo único que cambia entre tableros es el tooltip de cada uno, que llega por
 * `Ayuda` con la forma `{ titulo, texto }`, y la cabecera, que es de cada tablero: por eso la
 * leyenda (`LeyendaCierres`) se exporta aparte, para que cada uno la ponga en la suya.
 *
 * El diseño es el de Kerwin (30/09/2026): arriba una tira con la tasa de presentación —la que
 * explica la distancia entre las dos columnas— y debajo una tarjeta por columna, con las ventas
 * (barra azul) y, debajo, las señas (barra rosa). Cierra la tarjeta otra tira, la de «No cerradas»
 * (09/10/2026): las que asistieron y no compraron ni dejaron seña.
 */

export const FILAS = [
    {
        key: 'sin_senas', label: 'Ventas',
        numerador: 'ventas (pago completo o split pay)',
        ayuda: 'El close rate de verdad: solo cuentan los pagos completos y los split pay. Una seña '
            + 'es una reserva, no una venta, así que acá no entra.',
    },
    {
        key: 'solo_senas', label: 'Señas',
        numerador: 'señas sin completar',
        ayuda: 'Los leads que dejaron una seña y todavía no pagaron el programa. Las ventas no '
            + 'entran: están en la fila de arriba, y la seña que después se completó cuenta allá, '
            + 'una sola vez.',
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

/** Lo que muestra `Pct` al final: la tasa con su `%`, o el conteo pelado si el sufijo es vacío. */
const textoDe = (valor, sufijo) => (valor === null || valor === undefined ? '—' : `${valor}${sufijo}`);

/** Qué dice el tooltip de una celda: la cuenta en palabras y con los números del período. */
export const textoDeCelda = (fila, col, celda) => `${fila.numerador} ÷ ${col.denominador}: `
    + `${n(celda?.num)} de ${n(celda?.den)}. ${fila.key === 'solo_senas'
        ? 'Son reservas, no ventas: no entran en el close rate.'
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

const quieto = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * La tasa grande sube de 0 a su valor (0,8 s, la misma curva que las barras).
 *
 * El conteo se escribe en el nodo desde el efecto y no por estado —como `Cifra` en el dashboard
 * comercial—: son unos cincuenta cuadros por cifra y no vale re-renderizar la tarjeta por cada uno.
 * El render ya deja el valor final, así que sin animación (movimiento reducido, pestaña oculta,
 * tests) se lee el número correcto desde el primer momento.
 *
 * Se exporta porque el panel Estados (`RepartoEstados`) cuenta sus porcentajes con la misma pieza.
 * Un `valor` en texto conserva sus decimales: "30.0" sube y termina en "30.0%", no en "30%".
 * `sufijo` vacío la vuelve un conteo: la tira de «No cerradas» sube su cantidad con la misma curva.
 */
export const Pct = ({ valor, className, sufijo = '%' }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const fin = Number(valor);
        if (!el || valor === null || valor === undefined || !Number.isFinite(fin) || quieto()) {
            return undefined;
        }
        const dec = (String(valor).split('.')[1] || '').length;
        let id = 0;
        let t0 = 0;
        const paso = (t) => {
            if (!t0) t0 = t;
            const k = Math.min((t - t0) / 800, 1);
            el.textContent = `${(fin * (1 - (1 - k) ** 3)).toFixed(dec)}${sufijo}`;
            if (k < 1) id = requestAnimationFrame(paso);
            else el.textContent = textoDe(valor, sufijo);
        };
        id = requestAnimationFrame(paso);
        // Solo se corta el conteo: si el valor cambió, React ya escribió el nuevo antes de esta
        // limpieza, y reponer acá el texto de este efecto dejaría el número viejo.
        return () => cancelAnimationFrame(id);
    }, [valor, sufijo]);
    return <b ref={ref} className={className}>{textoDe(valor, sufijo)}</b>;
};

/** "12 de 84": el numerador resaltado, el resto apagado. */
const Fraccion = ({ num, den }) => (
    <small className="mc-frac"><b>{n(num)}</b> de {n(den)}</small>
);

const acotar = (x) => Math.max(0, Math.min(100, Number(x) || 0));

/**
 * Riel con uno o más tramos apilados. Cada tramo crece desde 0 al montar (keyframes, sin JS: así
 * crece aunque el primer cuadro llegue tarde) y, si el dato cambia, se desliza a su ancho nuevo.
 * `demora` escalona: la barra rosa de las señas arranca después de la azul de las ventas, de
 * arriba hacia abajo, como se lee la tarjeta.
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

/**
 * Abajo de la matriz: las llamadas con show up que no terminaron ni en venta ni en seña (pedido del
 * usuario, 09/10/2026: «agrega un dato de "No cerradas" con la cantidad de agendas en show up que no
 * se cerraron»). Es el resto de la columna "Por llamada" —ventas + señas + no cerradas son las que
 * asistieron— y por eso va como tira, igual que la de presentación arriba, y no como una tercera
 * fila de cada tarjeta: es una sola cifra sobre las llamadas, no dos.
 *
 * La cifra grande es la CANTIDAD, que es lo que se pidió; la base y la tasa van al lado.
 */
const TiraNoCerradas = ({ celda, destino, irA, Ayuda }) => (
    <div className="mc-tira mc-tira--no" role="group" aria-label="No cerradas">
        <span className="mc-tira-rot">
            <small className="mc-rot">No cerradas</small>
            <ConAyuda Ayuda={Ayuda} titulo="No cerradas"
                texto={`Llamadas con show up que no terminaron ni en venta ni en seña: ${n(celda.num)} `
                    + `de ${n(celda.den)}. Con las ventas y las señas suman todas las llamadas con `
                    + 'show up: acá están los leads a los que hay que volver.'} />
        </span>
        <Riel className="mc-riel--tira" tramos={[{ tono: 'no', ancho: celda.pct, demora: 520 }]} />
        <span className="mc-tira-cifra">
            <MetricaClicable irA={irA} destino={destino} vacio={!celda.num} subrayar={false}
                detalle={`No cerradas · ${n(celda.num)} de ${n(celda.den)}`}>
                <Pct valor={n(celda.num)} sufijo="" className="mc-tira-pct" />
            </MetricaClicable>
            <small className="mc-frac">de {n(celda.den)} · {pctDe(celda.pct)}</small>
        </span>
    </div>
);

/** Una lectura dentro de la tarjeta: rótulo, tasa grande con su fracción y la barra. */
const Lectura = ({ fila, col, celda, tramos, destino, irA, Ayuda }) => {
    const titulo = `${fila.label} · ${col.label}`;
    return (
        <div className={`mc-lectura mc-lectura--${fila.key}`} role="group" aria-label={titulo}>
            <div className="mc-lectura-cab">
                <small className="mc-rot">{fila.label}</small>
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

/** Una columna de la matriz como tarjeta: las ventas arriba, las señas abajo. */
const Columna = ({ col, cierres, orden, destinos, irA, Ayuda }) => {
    const sin = cierres.sin_senas?.[col.key] || {};
    const solo = cierres.solo_senas?.[col.key] || {};
    const den = sin.den ?? solo.den;
    // Los tramos salen de los conteos y no de las tasas redondeadas, con el mismo denominador:
    // así las dos barras de la tarjeta se pueden comparar a ojo.
    const ventas = den ? ((sin.num ?? 0) / den) * 100 : 0;
    const senas = den ? ((solo.num ?? 0) / den) * 100 : 0;
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
            <Lectura fila={FILAS[1]} col={col} celda={solo} irA={irA} Ayuda={Ayuda}
                destino={destinos?.solo_senas?.[col.key]}
                tramos={[{ tono: 'senas', ancho: senas, demora: demora + 240 }]} />
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
            {cierres.no_cerradas && (
                <TiraNoCerradas celda={cierres.no_cerradas} destino={destinos?.no_cerradas}
                    irA={irA} Ayuda={Ayuda} />
            )}
        </div>
    );
};

export default MatrizCierres;
