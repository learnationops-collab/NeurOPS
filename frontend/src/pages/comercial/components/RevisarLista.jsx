import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import ListaAgrupable from '../../../components/listas/ListaAgrupable';
import VistaTarjetas from '../../../components/listas/VistaTarjetas';
import { usePaginaProgresiva } from '../../../components/listas/usePaginaProgresiva';
import { Esqueleto, Hueso, escalonDe } from '../../../components/huesos/Huesos';
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
 *
 * ## El dibujado es progresivo; el filtrado no
 *
 * Las filas llegan TODAS del backend y `Revisar` las filtra completas: eso es lo que hace que el
 * "mostrando X de Y", los contadores de las facetas y la tira de totales cierren sobre el mismo
 * conjunto (ver el docstring de `tablasDef.js`). Lo único paginado acá es el dibujado, con
 * `usePaginaProgresiva`: entran 40 filas y el resto llega al bajar. Por eso el pie de la lista no
 * dice "cargando más datos" —no hay ninguna petición— sino que muestra los huesos de las filas que
 * están por dibujarse.
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

/* Cada fila entra por su cuenta, escalonada dentro de la página que está entrando (`desde`).
   El escalonado va topeado en `escalonDe` (ver ahí los números). Las filas ya montadas no vuelven
   a animarse porque la `key` es estable, así que al llegar la página siguiente sólo se mueven las
   nuevas.

   El recorrido es de 12 px y la curva frena al final: con 6 px y 0,2 s la fila aparecía casi en
   su lugar y el escalonado no se percibía, que era justo lo que se había pedido ver. */
const ENTRADA_FILA = { duration: .34, ease: [.22, 1, .36, 1] };
const Filas = ({ def, filas, plantilla, onAbrirFila, desde = 0, quieto }) => filas.map((fila, i) => (
    <motion.div key={claveDe(fila)} className="tabla-fila"
        role="button" tabIndex={0} style={{ '--cols': plantilla }}
        aria-label={`Abrir ${fila.cliente}`}
        initial={quieto ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={quieto
            ? { duration: 0 }
            : { ...ENTRADA_FILA, delay: escalonDe(i - desde) / 1000 }}
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
    </motion.div>
));

const Tarjetas = ({ def, filas, onAbrirFila, desde = 0 }) => (
    <VistaTarjetas filas={filas} clave={claveDe} onAbrir={onAbrirFila} desde={desde}
        titulo={(f) => f.cliente} subtitulo={(f) => f.ig}
        chips={chipsDe(def)} campos={camposDe(def)} />
);

/* ============================================================
   HUESOS — la forma de la tabla mientras carga y mientras baja
   ============================================================ */

/* Los anchos de los huesos se alternan: con todos iguales la tabla parecía un tablero de ajedrez,
   que no es la forma de ninguna lista real. `ver` es la flecha, que sí es siempre del mismo tamaño. */
const ANCHOS_HUESO = ['70%', '84%', '56%', '76%', '62%'];
const anchoHueso = (col, i) => (col.key === 'ver' ? 14 : ANCHOS_HUESO[i % ANCHOS_HUESO.length]);

/** Una fila de huesos con las columnas REALES de la tabla: `def.cols` trae el `width` de cada una,
 *  así que el hueso cae justo donde va a caer el dato y al llegar las filas nada se corre. */
const HuesoFila = ({ def, plantilla, paso }) => (
    <div className="tabla-fila" style={{ '--cols': plantilla }} aria-hidden="true">
        {def.cols.map((c, i) => (
            <div key={c.key} data-h={c.header}>
                <Hueso alto={12} ancho={anchoHueso(c, i)} paso={paso} />
            </div>
        ))}
    </div>
);

const HuesoTarjeta = ({ paso }) => (
    <div className="reg-tarjeta" aria-hidden="true" style={{ pointerEvents: 'none' }}>
        <Hueso alto={15} ancho="58%" paso={paso} />
        <Hueso alto={11} ancho="34%" paso={paso + 1} style={{ marginTop: 'var(--s2)' }} />
        <Hueso alto={46} paso={paso + 2} style={{ marginTop: 'var(--s4)' }} />
    </div>
);

/**
 * Lo que se ve en Revisar mientras el backend devuelve las filas: la tira de totales y la tabla,
 * con el encabezado de verdad. El encabezado no se dibuja con huesos porque ya se sabe —las
 * columnas son de la definición, no del servidor— y leerlo mientras carga adelanta qué viene.
 */
export const EsqueletoRevisar = ({ def, plantilla, modo, filas = 8, totales = 5 }) => (
    <Esqueleto rotulo="Cargando los registros…">
        <div className="tot-tira" aria-hidden="true">
            {Array.from({ length: totales }, (_, i) => (
                <Hueso key={i} alto={18} ancho={96} paso={i} />
            ))}
        </div>
        {modo === 'tarjetas' ? (
            <div className="tarjetas" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => <HuesoTarjeta key={i} paso={i} />)}
            </div>
        ) : (
            <div className="tabla">
                <Encabezado def={def} plantilla={plantilla} />
                {Array.from({ length: filas }, (_, i) => (
                    <HuesoFila key={i} def={def} plantilla={plantilla} paso={i} />
                ))}
            </div>
        )}
    </Esqueleto>
);

const RevisarLista = ({ def, visibles, plantilla, onAbrirFila, dimension, modo }) => {
    const quieto = useReducedMotion();
    const esTarjetas = modo === 'tarjetas';

    // Se pagina el arreglo COMPLETO y después se agrupa el prefijo: `agruparPor` saca los grupos en
    // el orden en el que aparece su primera fila, así que agregar filas al final agrega grupos al
    // final y nunca reordena los que ya estaban. Agrupar primero y paginar los grupos habría hecho
    // saltar la lista entera en cada página.
    const { pagina, hayMas, pie, dibujadas } = usePaginaProgresiva(visibles);
    // Qué filas ya entraron, para que la vista agrupada dibuje sólo esas sin que sus subtotales
    // dejen de contar el grupo entero. Es un `Set` por identidad: las filas son los mismos objetos
    // que `visibles`, así que no hace falta una clave.
    const enPagina = useMemo(() => (hayMas ? new Set(pagina) : null), [hayMas, pagina]);

    // Agrupada, el escalonado se cuenta dentro de cada grupo (`ListaAgrupable` llama a
    // `renderFilas` una vez por grupo y no sabe de índices globales). Es una aproximación: el tope
    // de `escalonDe` la vuelve irrelevante, porque ningún grupo escalona más de 12 filas.
    const renderFilas = (filas) => (esTarjetas
        ? (
            <div style={{ padding: 'var(--s4)' }}>
                <Tarjetas def={def} filas={filas} onAbrirFila={onAbrirFila} />
            </div>
        )
        : <Filas def={def} filas={filas} plantilla={plantilla} onAbrirFila={onAbrirFila}
            quieto={quieto} />);

    const cuerpo = () => {
        if (dimension) {
            return (
                <>
                    {/* Agrupada y en tabla, el encabezado va UNA vez arriba de todos los grupos:
                        sin él las columnas quedaban sin rótulo, y repetirlo por grupo convertía
                        la lista en cinco tablas en vez de una repartida. */}
                    {!esTarjetas && <Encabezado def={def} plantilla={plantilla} />}
                    {/* `filas` son TODAS las filtradas y `enPagina` recorta lo que se dibuja:
                        así los subtotales de cada grupo cierran con la tira de arriba desde el
                        primer momento, y lo que va llegando al bajar son las filas. */}
                    <ListaAgrupable filas={visibles} dimension={dimension} renderFilas={renderFilas}
                        enPagina={enPagina} formatoMonto={fmt.money} />
                </>
            );
        }
        if (esTarjetas) {
            return <Tarjetas def={def} filas={pagina} onAbrirFila={onAbrirFila} desde={dibujadas} />;
        }
        return (
            <div className="tabla">
                <Encabezado def={def} plantilla={plantilla} />
                <Filas def={def} filas={pagina} plantilla={plantilla} onAbrirFila={onAbrirFila}
                    desde={dibujadas} quieto={quieto} />
            </div>
        );
    };

    return (
        <motion.div key={`${modo}-${dimension?.key || 'suelta'}`}
            initial={quieto ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={quieto ? { duration: 0 } : { duration: .2, ease: 'easeOut' }}>
            {cuerpo()}
            {/* El pie que trae la página siguiente. Lleva los huesos de lo que falta dibujar en vez
                de un rótulo: es la misma promesa que el esqueleto de la carga inicial, y el
                `IntersectionObserver` necesita un elemento con alto para disparar. */}
            {hayMas && (
                <div ref={pie} className={esTarjetas ? 'tarjetas' : 'tabla'}
                    style={{ marginTop: esTarjetas ? 'var(--s4)' : 0 }}>
                    {esTarjetas
                        ? Array.from({ length: 2 }, (_, i) => <HuesoTarjeta key={i} paso={i} />)
                        : Array.from({ length: 3 }, (_, i) => (
                            <HuesoFila key={i} def={def} plantilla={plantilla} paso={i} />
                        ))}
                </div>
            )}
        </motion.div>
    );
};

export default RevisarLista;
