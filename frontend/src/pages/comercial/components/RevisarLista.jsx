import React, { useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowRight, MoreHorizontal } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import ListaAgrupable from '../../../components/listas/ListaAgrupable';
import VistaTarjetas from '../../../components/listas/VistaTarjetas';
import { usePaginaProgresiva } from '../../../components/listas/usePaginaProgresiva';
import { Esqueleto, Hueso, Renglon, escalonDe } from '../../../components/huesos/Huesos';
import { Tip, cuandoDe, fmt } from './Shared';
import { DIAS_DATO_VIEJO, diasDesde, formatoAcademia, haceCuanto } from './academia';
import { SIN_PALABRA_CLAVE } from './tablasSetter';

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

/** Chip de estado con el tono que manda el backend (nunca uno elegido en el frontend).
 *
 * El texto va en su propio span: el chip es `inline-flex`, y a un texto suelto dentro de un flex
 * no se le puede poner `text-overflow`. Así, en una columna angosta se corta con «…» en vez de
 * salirse del chip y pisar la columna de al lado.
 *
 * El tooltip es la `ayuda` del estado cuando el backend la manda («Lead perdido», «Archivada sin
 * reporte»: los que hay que explicar), y si no la etiqueta entera, por si se cortó. */
export const ChipTono = ({ chip }) => (chip
    ? (
        <span className="chip" style={{ '--c': `var(--${chip.tone})` }} title={chip.ayuda || chip.label}>
            <span className="trunc">{chip.label}</span>
        </span>
    )
    : null);

const Celda = ({ fila, col }) => {
    switch (col.key) {
        case 'fecha': {
            const { dia, hora } = cuandoDe(fila);
            return (
                <span className="celda num">
                    {dia}
                    {hora && <span className="celda-sub num">{hora}</span>}
                </span>
            );
        }
        // `title` con el texto entero: la celda lo corta con «…» cuando no entra.
        case 'cliente':
            return (
                <span className="celda" title={fila.cliente || undefined}>
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
            // Una venta no completada (solo la ve quien opera) no es cash: el monto va tachado, que
            // es lo que explica por qué no está en la tira de totales.
            return fila.completada === false ? (
                <span className="celda celda--num mut40" style={{ textDecoration: 'line-through' }}
                    title={`No suma: la venta está ${(fila.estado?.label || 'sin completar').toLowerCase()}`}>
                    {fmt.money(fila.monto)}
                </span>
            ) : <span className="celda celda--num">{fmt.money(fila.monto)}</span>;
        // Solo en la tabla de quien opera (ver `defDe` en `tablasDef.js`): el estado de la venta y,
        // debajo, si no tiene agenda, que es lo que se viene a corregir con «Atribuir a una agenda».
        case 'estado_venta':
            return (
                <>
                    <ChipTono chip={fila.estado} />
                    {fila.tiene_agenda === false && (
                        <span className="celda-sub" style={{ color: 'var(--warning)', fontWeight: 700 }}>
                            Sin agenda
                        </span>
                    )}
                </>
            );
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
                    {/* Un dado de baja no tiene nada que cobrar: la bajada dice cuándo y por qué
                        se fue, que es lo que se viene a buscar en su filtro. */}
                    {fila.baja && (
                        <span className="celda-sub">
                            {[fila.baja.fecha_legible, fila.baja.motivo].filter(Boolean).join(' · ')}
                        </span>
                    )}
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
        // La del anuncio que trajo al lead (Revisar del setter, ver `tablasSetter.js`). Sin ella se
        // marca como el retraso de un post call: es lo que «Mis agendas» le pide completar.
        case 'palabra_clave':
            return fila.palabra_clave
                ? <span className="celda" title={fila.palabra_clave}>{fila.palabra_clave}</span>
                : (
                    <span className="celda" style={{ color: 'var(--warning)', fontWeight: 700 }}>
                        {SIN_PALABRA_CLAVE}
                    </span>
                );
        // --- La Academia (ver `academia.js`). `fila.academia` es null en una venta sin cliente.
        case 'academia': {
            // El estado y, debajo, cuánto confiar en él: la última actividad que se le vio o de
            // cuándo es el dato (antes era la columna «Datos de», que no entraba a ~1000px). Un
            // dato viejo o que no se pudo renovar gana y se pinta como aviso: con la
            // sincronización andando no debería pasar de unas horas.
            const a = fila.academia;
            if (!a) return <span className="celda mut40">—</span>;
            const cuando = a.sincronizado || a.intentado;
            const leido = cuando ? `leído ${haceCuanto(cuando)}` : null;
            let sub = null;
            let aviso = false;
            if (a.error && !a.sincronizado) [sub, aviso] = ['la Academia dio error', true];
            else if (cuando && (diasDesde(cuando) > DIAS_DATO_VIEJO || a.error)) [sub, aviso] = [leido, true];
            else if (a.ultima_actividad) sub = `actividad ${haceCuanto(a.ultima_actividad)}`;
            else sub = leido;
            const detalle = [leido && `Datos de la Academia ${leido}.`,
                a.error && `El último intento dio error: ${a.error}`].filter(Boolean).join(' ');
            return (
                <>
                    <ChipTono chip={a.estado} />
                    {sub && (
                        <span className="celda-sub" title={detalle || undefined}
                            style={aviso ? { color: 'var(--warning)' } : undefined}>{sub}</span>
                    )}
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
        case 'ver':
            return <span className="celda-ver"><ArrowRight size={14} /></span>;
        default:
            return <span className="celda" title={fila[col.key] || undefined}>{fila[col.key] || '—'}</span>;
    }
};

/** Las columnas que se leen como un chip de estado: en una tarjeta van arriba, no en la lista de datos. */
const COLS_CHIP = new Set(['pre_call', 'post_call', 'estado', 'estado_venta', 'academia']);
/** Y estas ya están en el encabezado de la tarjeta o no son un dato. */
const COLS_FUERA = new Set(['cliente', 'ver']);

/** Una tarjeta se arma con las MISMAS columnas de la tabla, así ninguna vista muestra menos. */
const camposDe = (def) => (fila) => def.cols
    .filter(c => !COLS_FUERA.has(c.key) && !COLS_CHIP.has(c.key))
    .map(c => ({ rotulo: c.header || c.key, valor: <Celda fila={fila} col={c} /> }));

const chipsDe = (def) => (fila) => def.cols
    .filter(c => COLS_CHIP.has(c.key))
    .map(c => <Celda key={c.key} fila={fila} col={c} />);

export const claveDe = (fila) => `${fila.tipo}-${fila.id}`;

/* ============================================================
   OPERAR — la casilla y el menú «⋯» de cada fila (10/10/2026)
   ============================================================

   Solo aparecen cuando quien mira opera los registros (admin y operador, ver `operar/operacion.js`):
   la casilla si la tabla tiene acciones de lote, el «⋯» si tiene acciones de fila. Son una columna
   más de la grilla (Revisar le suma su ancho a `plantilla`), así que el encabezado y los huesos
   llevan la misma celda y nada se corre al llegar las filas.

   Los dos cortan el clic: la fila entera abre la ficha, y tildar o abrir el menú no tiene que
   abrirla. Con el teclado, lo mismo con Enter y espacio. */

const cortar = (e) => e.stopPropagation();

const CasillaFila = ({ fila, marcada, onAlternar }) => (
    <div className="op-celda" onClick={cortar} onKeyDown={cortar} data-h="">
        <input type="checkbox" className="op-casilla" checked={marcada}
            onChange={() => onAlternar(fila)} aria-label={`Seleccionar ${fila.cliente}`} />
    </div>
);

/** El menú «⋯» de una fila: se cierra al elegir, con Escape o con un clic afuera. */
const MenuFila = ({ fila, acciones, onAccion }) => {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (!caja.current?.contains(e.target)) setAbierto(false); };
        const escape = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [abierto]);
    return (
        <div className="op-celda op-celda--fin" ref={caja} onClick={cortar} onKeyDown={cortar} data-h="">
            {acciones.length > 0 && (
                <>
                    <button type="button" className="op-mas" aria-haspopup="menu" aria-expanded={abierto}
                        aria-label={`Acciones de ${fila.cliente}`} onClick={() => setAbierto((v) => !v)}>
                        <MoreHorizontal size={16} />
                    </button>
                    {abierto && (
                        <div className="menu op-menu" role="menu" aria-label={`Acciones de ${fila.cliente}`}>
                            {acciones.map(({ id, label, Icono }) => (
                                <button key={id} type="button" className="menu-item" role="menuitem"
                                    onClick={() => { setAbierto(false); onAccion(acciones.find((a) => a.id === id), fila); }}>
                                    {Icono && <Icono size={14} />}
                                    <span className="trunc">{label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

/** La casilla del encabezado: tilda o destilda todas las filas que muestra la lista. */
const CasillaTodas = ({ estado, onAlternar }) => (
    <span className="op-celda">
        <input type="checkbox" className="op-casilla" checked={estado === 'todas'}
            ref={(el) => { if (el) el.indeterminate = estado === 'algunas'; }}
            onChange={onAlternar} aria-label="Seleccionar todas las filas de la lista" />
    </span>
);

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

const Encabezado = ({ def, plantilla, orden, onOrdenar, operar = null }) => (
    <div className="tabla-cab" style={{ '--cols': plantilla }}>
        {operar?.seleccionable && <CasillaTodas estado={operar.estadoTodas} onAlternar={operar.onAlternarTodas} />}
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
                            {/* En su span: si la columna se angosta se corta el rótulo, no el
                                ícono de ayuda de al lado. */}
                            <span className="trunc">{c.header}</span>
                            {/* Solo en la columna que ordena: invisible en las demás igual ocupaba
                                15px, y en las columnas angostas de la Academia eso dejaba «H…». */}
                            {dir && (
                                <ArrowDown size={11} aria-hidden="true"
                                    className={dir === 'asc' ? 'cab-flecha cab-flecha--asc' : 'cab-flecha'} />
                            )}
                        </button>
                    ) : <span className="trunc">{c.header}</span>}
                    {c.ayuda && <Tip texto={c.ayuda} titulo={c.ordenLabel || c.header} />}
                </span>
            );
        })}
        {operar?.deFila && <span className="op-celda op-celda--fin" />}
    </div>
);

/* Cada fila entra por su cuenta, escalonada dentro de la página que está entrando (`desde`).
   El escalonado va topeado en `escalonDe` (ver ahí los números). Las filas ya montadas no vuelven
   a animarse porque la `key` es estable, así que al llegar la página siguiente sólo se mueven las
   nuevas.

   El recorrido es de 12 px y la curva frena al final: con 6 px y 0,2 s la fila aparecía casi en
   su lugar y el escalonado no se percibía, que era justo lo que se había pedido ver. */
const ENTRADA_FILA = { duration: .34, ease: [.22, 1, .36, 1] };
const Filas = ({ def, filas, plantilla, onAbrirFila, desde = 0, quieto, operar = null }) => filas.map((fila, i) => (
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
        {operar?.seleccionable && (
            <CasillaFila fila={fila} marcada={operar.seleccion.has(claveDe(fila))} onAlternar={operar.onAlternar} />
        )}
        {def.cols.map(c => (
            // `data-h` es el rótulo que el CSS pinta a la izquierda de cada dato cuando la
            // tabla se apila en móvil.
            <div key={c.key} data-h={c.header}>
                <Celda fila={fila} col={c} />
            </div>
        ))}
        {operar?.deFila && <MenuFila fila={fila} acciones={operar.deFila(fila)} onAccion={operar.onAccion} />}
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
const HuesoFila = ({ def, plantilla, paso, operar = null }) => (
    <div className="tabla-fila" style={{ '--cols': plantilla }} aria-hidden="true">
        {operar?.seleccionable && <div className="op-celda" />}
        {def.cols.map((c, i) => (
            <div key={c.key} data-h={c.header}>
                <Hueso alto={12} ancho={anchoHueso(c, i)} paso={paso} />
            </div>
        ))}
        {operar?.deFila && <div className="op-celda op-celda--fin" />}
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
export const EsqueletoRevisar = ({ def, plantilla, modo, filas = 8, totales = 5, operar = null }) => (
    <Esqueleto rotulo="Cargando los registros…">
        {/* La tira con la misma grilla y los mismos renglones que `TotalesTira` (Revisar.jsx): el
            alcance, y por celda el número, el rótulo y la bajada. Al llegar los datos no se corre. */}
        <div className="tot-tira" aria-hidden="true" data-n={totales} style={{ '--n': totales }}>
            <Renglon alto={13}><Hueso alto={9} ancho={150} paso={0} /></Renglon>
            <div className="tot-grid">
                {Array.from({ length: totales }, (_, i) => (
                    <div key={i} className="tot-celda">
                        <Renglon alto={21}><Hueso alto={16} ancho={72} paso={i} /></Renglon>
                        <span className="tot-pie">
                            <Renglon alto={14}><Hueso alto={9} ancho={54} paso={i + 1} /></Renglon>
                            <Renglon alto={13}><Hueso alto={8} ancho={40} paso={i + 2} /></Renglon>
                        </span>
                    </div>
                ))}
            </div>
        </div>
        {modo === 'tarjetas' ? (
            <div className="tarjetas" aria-hidden="true">
                {Array.from({ length: 6 }, (_, i) => <HuesoTarjeta key={i} paso={i} />)}
            </div>
        ) : (
            <div className="tabla">
                <Encabezado def={def} plantilla={plantilla} operar={operar} />
                {Array.from({ length: filas }, (_, i) => (
                    <HuesoFila key={i} def={def} plantilla={plantilla} paso={i} operar={operar} />
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
/**
 * `operar` (solo para quien opera, ver `operar/operacion.js`): `{ seleccionable, seleccion,
 * onAlternar, estadoTodas, onAlternarTodas, deFila, onAccion }`. Las casillas y el «⋯» van en la
 * lista; en tarjetas no, que es una vista para leer.
 */
const RevisarLista = ({ def, visibles, plantilla, onAbrirFila, dimension, modo, gruposElegidos,
    onElegirGrupo, orden = null, onOrdenar = null, variante = '', operar = null }) => {
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
            desde={desde} quieto={quieto} operar={operar} />);

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
            <HuesoFila key={i} def={def} plantilla={plantilla} paso={i} operar={operar} />
        )));

    const cuerpo = () => {
        if (dimension) {
            return (
                <>
                    {/* Agrupada y en tabla, el encabezado va UNA vez arriba de todos los grupos:
                        sin él las columnas quedaban sin rótulo, y repetirlo por grupo convertía
                        la lista en cinco tablas en vez de una repartida. */}
                    {!esTarjetas && (
                        <Encabezado def={def} plantilla={plantilla} orden={orden} onOrdenar={onOrdenar}
                            operar={operar} />
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
                <Encabezado def={def} plantilla={plantilla} orden={orden} onOrdenar={onOrdenar}
                    operar={operar} />
                <Filas def={def} filas={pagina} plantilla={plantilla} onAbrirFila={onAbrirFila}
                    desde={dibujadas} quieto={quieto} operar={operar} />
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
                            <HuesoFila key={i} def={def} plantilla={plantilla} paso={i} operar={operar} />
                        ))}
                </div>
            )}
        </motion.div>
    );
};

export default RevisarLista;
