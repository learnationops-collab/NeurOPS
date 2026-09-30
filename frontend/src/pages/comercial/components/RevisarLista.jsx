import React from 'react';
import { ArrowDown, ArrowRight } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import ListaAgrupable from '../../../components/listas/ListaAgrupable';
import VistaTarjetas from '../../../components/listas/VistaTarjetas';
import { usePaginaProgresiva } from '../../../components/listas/usePaginaProgresiva';
import { Esqueleto, Hueso, escalonDe } from '../../../components/huesos/Huesos';
import { Tip, fmt } from './Shared';
import { DIAS_DATO_VIEJO, diasDesde, formatoAcademia, haceCuanto } from './academia';

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
 * agrupar, React desmonta y vuelve a montar, y la vista nueva entra con su animación. Lo que se
 * desmonta es sólo el dibujo: qué grupos abrió el usuario lo guarda `Revisar` y llega acá en
 * `gruposElegidos`, así que pasar a tarjetas no cierra el grupo que se estaba mirando. Sin
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
 *
 * Agrupada, los grupos arrancan cerrados y lo que se pagina es cada grupo abierto, con su propio
 * pie: la lista entera no se pagina (ver `ListaAgrupable`).
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
        // --- La Academia (ver `academia.js`). `fila.academia` es null en una venta sin cliente.
        case 'academia': {
            // El estado y, debajo, desde cuándo: la última actividad que se le vio, o por qué no
            // hay datos todavía.
            const a = fila.academia;
            if (!a) return <span className="celda mut40">—</span>;
            const sub = a.ultima_actividad
                ? `actividad ${haceCuanto(a.ultima_actividad)}`
                : (a.error && !a.sincronizado ? 'la Academia dio error' : null);
            return (
                <>
                    <ChipTono chip={a.estado} />
                    {sub && <span className="celda-sub" title={a.error || undefined}>{sub}</span>}
                </>
            );
        }
        case 'ac_horas':
            return <span className="celda celda--num">{formatoAcademia.horas(fila.academia?.horas)}</span>;
        case 'ac_progreso':
            return <span className="celda celda--num">{formatoAcademia.progreso(fila.academia?.progreso)}</span>;
        case 'ac_lecciones':
            return (
                <span className="celda celda--num">
                    {formatoAcademia.lecciones(fila.academia?.lecciones, fila.academia?.lecciones_total)}
                </span>
            );
        case 'ac_ejecuciones':
            return <span className="celda celda--num">{formatoAcademia.ejecuciones(fila.academia?.ejecuciones)}</span>;
        case 'ac_racha':
            return <span className="celda celda--num">{formatoAcademia.racha(fila.academia?.racha)}</span>;
        case 'ac_frescura': {
            // De cuándo es el dato. Viejo se pinta como aviso: con la sincronización andando no
            // debería pasar de unas horas.
            const a = fila.academia;
            const cuando = a?.sincronizado || a?.intentado;
            if (!cuando) return <span className="celda mut40">—</span>;
            const viejo = diasDesde(cuando) > DIAS_DATO_VIEJO;
            return (
                <span className="celda num" style={viejo ? { color: 'var(--warning)' } : undefined}
                    title={a.error ? `El último intento dio error: ${a.error}` : undefined}>
                    {haceCuanto(cuando)}
                    {a.error && a.sincronizado && <span className="celda-sub">no se pudo renovar</span>}
                </span>
            );
        }
        case 'ver':
            return <span className="celda-ver"><ArrowRight size={14} /></span>;
        default:
            return <span className="celda">{fila[col.key] || '—'}</span>;
    }
};

/** Las columnas que se leen como un chip de estado: en una tarjeta van arriba, no en la lista de datos. */
const COLS_CHIP = new Set(['pre_call', 'post_call', 'estado', 'academia']);
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

/**
 * El encabezado. Una columna con `orden` es un botón que la ordena (de mayor a menor, de menor a
 * mayor, y de vuelta al orden de la tabla); el orden vive en `Revisar`, junto al filtro, y acá solo
 * se muestra y se pide. Una columna con `ayuda` lleva su "i" al lado del rótulo, afuera del botón:
 * un elemento que se enfoca adentro de otro no se puede alcanzar bien con el teclado.
 *
 * Debajo de 900px el encabezado no se ve (la tabla se apila): ahí se ordena con "Ordenar".
 */
const RotuloOrden = { desc: 'de mayor a menor', asc: 'de menor a mayor' };

const Encabezado = ({ def, plantilla, orden, onOrdenar }) => (
    <div className="tabla-cab" style={{ '--cols': plantilla }}>
        {def.cols.map(c => {
            const ordenable = !!(c.orden && onOrdenar);
            const dir = orden?.key === c.key ? orden.dir : null;
            if (!ordenable && !c.ayuda) return <span key={c.key}>{c.header}</span>;
            return (
                <span key={c.key} className="cab-celda">
                    {ordenable ? (
                        <button type="button" className={`cab-orden${dir ? ' cab-orden--on' : ''}`}
                            onClick={() => onOrdenar(c.key)}
                            aria-label={`Ordenar por ${c.ordenLabel || c.header}${dir
                                ? `, ahora ${RotuloOrden[dir]}` : ''}`}>
                            {c.header}
                            <ArrowDown size={11} aria-hidden="true"
                                className={dir === 'asc' ? 'cab-flecha cab-flecha--asc' : 'cab-flecha'} />
                        </button>
                    ) : c.header}
                    {c.ayuda && <Tip texto={c.ayuda} titulo={c.ordenLabel || c.header} />}
                </span>
            );
        })}
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

/**
 * `orden` y `onOrdenar` son del encabezado (ver `Encabezado`). `variante` entra en la `key` del
 * envoltorio junto al modo y la dimensión: al cambiar el orden la lista se vuelve a montar y las
 * filas entran de nuevo, escalonadas, en su nuevo lugar. Es la misma señal que ya da agrupar o pasar
 * a tarjetas —"esto es otra vista"—, y además vuelve a la primera página, que es donde está lo que
 * se acaba de pedir ver primero.
 */
const RevisarLista = ({ def, visibles, plantilla, onAbrirFila, dimension, modo, gruposElegidos,
    onElegirGrupo, orden = null, onOrdenar = null, variante = '' }) => {
    const quieto = useReducedMotion();
    const esTarjetas = modo === 'tarjetas';

    // El paginado de la lista entera es sólo para la lista SUELTA. Agrupada, los grupos arrancan
    // cerrados y cada uno abierto pagina sus propias filas (ver `ListaAgrupable`): un pie global
    // quedaba a la vista debajo de los encabezados cerrados y cargaba todas las páginas sin dibujar
    // nada. Con `null` el hook no pagina ni pide pie, y al desagrupar vuelve a la primera página.
    const { pagina, hayMas, pie, dibujadas } = usePaginaProgresiva(dimension ? null : visibles);

    // Agrupada, `desde` son las filas del GRUPO que ya estaban: el escalonado se cuenta dentro de
    // la tanda que llega a ese grupo, igual que en la lista suelta se cuenta dentro de la página.
    const renderFilas = (filas, desde) => (esTarjetas
        ? (
            <div style={{ padding: 'var(--s4)' }}>
                <Tarjetas def={def} filas={filas} onAbrirFila={onAbrirFila} desde={desde} />
            </div>
        )
        : <Filas def={def} filas={filas} plantilla={plantilla} onAbrirFila={onAbrirFila}
            desde={desde} quieto={quieto} />);

    // El pie de un grupo abierto: los mismos huesos que el de la lista suelta, pero sin su propia
    // `.tabla` —ya está adentro de la de `ListaAgrupable`— y, en tarjetas, con el mismo relleno
    // lateral que la grilla de arriba para que los huesos caigan debajo de las columnas reales.
    const renderPie = () => (esTarjetas
        ? (
            <div className="tarjetas" style={{ padding: '0 var(--s4) var(--s4)' }}>
                {Array.from({ length: 2 }, (_, i) => <HuesoTarjeta key={i} paso={i} />)}
            </div>
        )
        : Array.from({ length: 3 }, (_, i) => (
            <HuesoFila key={i} def={def} plantilla={plantilla} paso={i} />
        )));

    const cuerpo = () => {
        if (dimension) {
            return (
                <>
                    {/* Agrupada y en tabla, el encabezado va UNA vez arriba de todos los grupos:
                        sin él las columnas quedaban sin rótulo, y repetirlo por grupo convertía
                        la lista en cinco tablas en vez de una repartida. */}
                    {!esTarjetas && (
                        <Encabezado def={def} plantilla={plantilla} orden={orden} onOrdenar={onOrdenar} />
                    )}
                    {/* `filas` son TODAS las filtradas: así los subtotales de cada grupo cierran
                        con la tira de arriba aunque el grupo esté cerrado, y lo que va llegando al
                        bajar dentro de un grupo abierto son sus filas. */}
                    <ListaAgrupable filas={visibles} dimension={dimension} renderFilas={renderFilas}
                        renderPie={renderPie} formatoMonto={fmt.money}
                        elegidos={gruposElegidos} onElegir={onElegirGrupo} />
                </>
            );
        }
        if (esTarjetas) {
            return <Tarjetas def={def} filas={pagina} onAbrirFila={onAbrirFila} desde={dibujadas} />;
        }
        return (
            <div className="tabla">
                <Encabezado def={def} plantilla={plantilla} orden={orden} onOrdenar={onOrdenar} />
                <Filas def={def} filas={pagina} plantilla={plantilla} onAbrirFila={onAbrirFila}
                    desde={dibujadas} quieto={quieto} />
            </div>
        );
    };

    return (
        <motion.div key={`${modo}-${dimension?.key || 'suelta'}-${variante}`}
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
