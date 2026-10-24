import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Check, ChevronDown, Columns, RotateCcw, Rows, Search, SlidersHorizontal, X } from 'lucide-react';
import PanelConfigurar from '../../pages/comercial/components/PanelConfigurar';
import { Segmented } from '../../pages/comercial/components/Shared';
import Tip from '../../pages/comercial/components/Tip';
import { useColumnasVisibles } from './useColumnasVisibles';
import { anchoMinimo, izquierdaDePegadas } from './anchoColumnas';
import { useEnPantalla } from '../ui/useEnPantalla';
import { usePaginaProgresiva } from './usePaginaProgresiva';
import ListaAgrupable from './ListaAgrupable';
import CajaDesplazable from './CajaDesplazable';
import AsaDeAncho from './AsaDeAncho';
import { useAnchosColumnas } from './useAnchosColumnas';
import './listas.css';

/**
 * La lista estándar del sistema fuera de Revisar: la misma barra (filtro completo, columnas,
 * búsqueda y «mostrando X de Y») y la misma tabla (`.tabla-cab` / `.tabla-fila` con `--cols`) que la
 * del dashboard comercial, para cualquier conjunto de filas que ya esté en el cliente.
 *
 * Vive dentro de un `.dc-shell` (usa sus clases). La definición es solo datos:
 *
 *   columnas: [{ key, header, width = 'minmax(0,1fr)', valor(fila) — lo que ordena y lo que se
 *               muestra si no hay `render` —, render?(fila), alinear?: 'der', fija?, oculta?, ayuda?,
 *               ordenable = true }]
 *   facetas:  [{ key, label, de(fila) → texto o null }]  — el panel «Filtro completo» de Revisar.
 *
 * `claveGuardado` es la clave de `localStorage` de las columnas elegidas (una por lista).
 *   agrupables: [{ key, label, de(fila) → texto o null }] — «Agrupar por», como en Revisar: grupos
 *               colapsables con su cantidad (`ListaAgrupable`).
 *
 * `vistas`: [{ key, label, columnas: [keys], grupos? }] — combinaciones de columnas que se eligen con un
 * toque (Embudo, Plata…); `grupos: true` rotula arriba cada grupo (`grupo` de la primera columna de cada
 * uno). `totales`: { etiqueta, sub(filas) } agrega la fila de totales debajo de la cabecera, con el
 * `total(filas) → { texto, tipo, valor }` de cada columna que lo sabe calcular; `render(fila, total)`
 * recibe el de su columna (para colorear contra el total).
 *
 * `redimensionable: true`: el ancho de la columna se cambia arrastrando el borde de su encabezado (se
 * recuerda; ver `useAnchosColumnas`). Conviene en la columna principal, que es la `pegada`.
 *
 * `pegada: true` en una columna la deja fija a la izquierda al desplazar la tabla (solo las primeras, con
 * `width` en px; ver `anchoColumnas.js`).
 *
 * `extra` va al final de la barra (botones propios de la lista). `marcada` es la clave de la fila
 * abierta, que se resalta. Las filas se dibujan de a páginas al scrollear (`usePaginaProgresiva`),
 * así una lista de miles no traba la pantalla.
 */

const normal = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const comparar = (a, b) => {
    if (a == null && b == null) return 0;
    if (a == null) return 1;
    if (b == null) return -1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b), 'es', { numeric: true });
};

/** Pasa el filtro de facetas: «todas» exige cumplir cada faceta elegida; «alguna», al menos una. */
export const pasaFacetas = (fila, facetas, elegidas, modo) => {
    const activas = facetas.filter((f) => elegidas[f.key]?.length);
    if (!activas.length) return true;
    const cumple = (f) => elegidas[f.key].includes(f.de(fila));
    return modo === 'alguna' ? activas.some(cumple) : activas.every(cumple);
};

const MenuColumnas = ({ columnas, visibles, alternar, restablecer, onCerrar }) => {
    const caja = useRef(null);
    const enPantalla = useEnPantalla(caja);
    useEffect(() => {
        const fuera = (e) => { if (!caja.current?.contains(e.target)) onCerrar(); };
        const escape = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [onCerrar]);
    const vistas = new Set(visibles.map((c) => c.key));
    return (
        <div className="menu lc-menu-columnas" role="menu" aria-label="Columnas" ref={enPantalla}>
            {columnas.map((c) => (
                <button key={c.key} type="button" className="menu-item" role="menuitemcheckbox"
                    aria-checked={vistas.has(c.key)} disabled={c.fija}
                    onClick={() => alternar(c.key)}>
                    <span className="menu-caja" aria-hidden="true">{vistas.has(c.key) ? <Check size={11} /> : ''}</span>
                    <span className="trunc">{c.header}</span>
                </button>
            ))}
            <button type="button" className="menu-item lc-restablecer" onClick={restablecer}>
                <RotateCcw size={13} aria-hidden="true" />
                <span className="trunc">Columnas por defecto</span>
            </button>
        </div>
    );
};

/** «Agrupar por»: sin agrupar o una dimensión, con cuántos grupos deja cada una. */
const MenuAgrupar = ({ agrupables, filas, valor, onElegir, onCerrar }) => {
    const caja = useRef(null);
    const enPantalla = useEnPantalla(caja);
    useEffect(() => {
        const fuera = (e) => { if (!caja.current?.contains(e.target)) onCerrar(); };
        const escape = (e) => { if (e.key === 'Escape') onCerrar(); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', escape);
        return () => {
            document.removeEventListener('mousedown', fuera);
            document.removeEventListener('keydown', escape);
        };
    }, [onCerrar]);
    return (
        <div className="menu" role="menu" aria-label="Agrupar por" ref={enPantalla}>
            <button type="button" className="menu-item" role="menuitemradio" aria-checked={!valor}
                onClick={() => onElegir(null)}>
                <span className="trunc">Sin agrupar</span>
            </button>
            {agrupables.map((d) => (
                <button key={d.key} type="button" className="menu-item" role="menuitemradio"
                    aria-checked={valor === d.key} onClick={() => onElegir(d.key)}>
                    <span className="trunc">{d.label}</span>
                    <span className="cuenta">{new Set(filas.map((f) => d.de(f) || '—')).size}</span>
                </button>
            ))}
        </div>
    );
};

const ListaConfigurable = ({
    columnas, facetas = [], filas, clave, onAbrirFila, buscar, buscarPlaceholder = 'Buscar…',
    claveGuardado, vacio = 'No hay filas para mostrar.', ayuda, extra, ordenInicial = null, marcada = null,
    agrupables = [], vistas = [], totales = null,
}) => {
    const [agrupacion, setAgrupacion] = useState(null);
    const dimension = agrupables.find((d) => d.key === agrupacion) || null;
    const { visibles: visiblesCrudo, alternar, restablecer, fijarVisibles } = useColumnasVisibles(claveGuardado, columnas);
    const { anchos, fijar: fijarAncho } = useAnchosColumnas(claveGuardado);
    // Una columna `redimensionable` con ancho elegido usa ese (en px) en vez del de su definición.
    const visibles = useMemo(() => visiblesCrudo.map((c) => (c.redimensionable && anchos[c.key]
        ? { ...c, width: `${anchos[c.key]}px` } : c)), [visiblesCrudo, anchos]);
    const [query, setQuery] = useState('');
    const [elegidas, setElegidas] = useState({});
    const [modo, setModo] = useState('todas');
    const [orden, setOrden] = useState(ordenInicial);
    const [menu, setMenu] = useState(null);

    const activas = facetas.reduce((n, f) => n + (elegidas[f.key]?.length || 0), 0);

    const filtradas = useMemo(() => {
        const q = normal(query.trim());
        return filas.filter((f) => pasaFacetas(f, facetas, elegidas, modo)
            && (!q || !buscar || normal(buscar(f)).includes(q)));
    }, [filas, facetas, elegidas, modo, query, buscar]);

    const mostradas = useMemo(() => {
        const col = orden && columnas.find((c) => c.key === orden.key);
        if (!col) return filtradas;
        const signo = orden.dir === 'asc' ? 1 : -1;
        return [...filtradas].sort((a, b) => signo * comparar(col.valor(a), col.valor(b)));
    }, [filtradas, orden, columnas]);

    // Mayor a menor, menor a mayor y de vuelta al orden de la lista, como en Revisar.
    const ordenar = (key) => setOrden((o) => {
        if (o?.key !== key) return { key, dir: 'desc' };
        return o.dir === 'desc' ? { key, dir: 'asc' } : null;
    });

    const { pagina, hayMas, pie } = usePaginaProgresiva(mostradas);

    // La vista activa es la que deja a la vista justo sus columnas (más las fijas); si se tocó una a mano, ninguna.
    const clavesVisibles = visibles.map((c) => c.key).sort().join('|');
    const vistaActiva = vistas.find((v) => columnas.filter((c) => c.fija || v.columnas.includes(c.key))
        .map((c) => c.key).sort().join('|') === clavesVisibles) || null;
    const conGrupos = !!vistaActiva?.grupos;
    // El total de cada columna que lo sabe calcular, sobre lo que se está viendo (ya filtrado).
    const totalesDe = useMemo(() => (totales
        ? Object.fromEntries(columnas.filter((c) => c.total).map((c) => [c.key, c.total(mostradas)])) : {}),
    [totales, columnas, mostradas]);

    const claseDe = (c, i, base = '') => [
        base, c.alinear === 'der' && 'lc-der', c.pegada && 'lc-pegada', conGrupos && c.grupo && i > 0 && 'lc-grupo-inicio',
    ].filter(Boolean).join(' ') || undefined;

    const dibujarFila = (fila) => (
        <div key={clave(fila)} className="tabla-fila" role="row" style={{ '--cols': plantilla }}
            {...(onAbrirFila ? {
                tabIndex: 0,
                onClick: () => onAbrirFila(fila),
                onKeyDown: (e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrirFila(fila); }
                },
            } : {})}
            data-abre={onAbrirFila ? '' : undefined}
            aria-current={marcada != null && clave(fila) === marcada ? 'true' : undefined}>
            {visibles.map((c, i) => (
                <div key={c.key} data-h={c.header} role="cell" className={claseDe(c, i, c.alinear === 'der' ? 'num' : '')}
                    style={c.pegada ? { left: pegadas[c.key] } : undefined}>
                    {c.render ? c.render(fila, totalesDe[c.key]) : (c.valor(fila) ?? '—')}
                </div>
            ))}
        </div>
    );

    const plantilla = visibles.map((c) => c.width || 'minmax(0,1fr)').join(' ');
    // Con muchas columnas la tabla se desplaza adentro de su caja (ver `anchoColumnas.js`).
    const ancho = anchoMinimo(visibles);
    const pegadas = izquierdaDePegadas(visibles);
    const quitar = (key, valor) => setElegidas((e) => ({ ...e, [key]: e[key].filter((v) => v !== valor) }));

    return (
        <div className="lista-configurable">
            {vistas.length > 0 && (
                <div className="lc-vistas">
                    <span className="t-eyebrow mut">Vista de columnas</span>
                    <Segmented opciones={vistas} valor={vistaActiva?.key ?? null} ariaLabel="Vista de columnas"
                        onChange={(key) => fijarVisibles(vistas.find((v) => v.key === key).columnas)} />
                </div>
            )}
            <div className="fila barra-tabla">
                {facetas.length > 0 && (
                    <div className="config-envoltura">
                        <button type="button" className={`pastilla${activas ? ' pastilla--on' : ''}`}
                            aria-expanded={menu === 'config'} aria-haspopup="dialog"
                            onClick={() => setMenu((m) => (m === 'config' ? null : 'config'))}>
                            <SlidersHorizontal size={15} />
                            Filtro completo
                            {activas > 0 && <span className="cuenta-burbuja">{activas}</span>}
                            <ChevronDown size={14} />
                        </button>
                        {menu === 'config' && (
                            <PanelConfigurar def={{ facetas }} filas={filas} facetas={elegidas}
                                setFacetas={setElegidas} modo={modo} setModo={setModo} tabla="lista"
                                onLimpiar={() => setElegidas({})} onCerrar={() => setMenu(null)} />
                        )}
                    </div>
                )}

                <div style={{ position: 'relative' }}>
                    <button type="button" className="pastilla" aria-expanded={menu === 'columnas'} aria-haspopup="menu"
                        onClick={() => setMenu((m) => (m === 'columnas' ? null : 'columnas'))}>
                        <Columns size={15} />
                        Columnas
                        <span className="mut40 num" style={{ fontSize: 11.5 }}>{visibles.length}/{columnas.length}</span>
                        <ChevronDown size={14} />
                    </button>
                    {menu === 'columnas' && (
                        <MenuColumnas columnas={columnas} visibles={visibles} alternar={alternar}
                            restablecer={restablecer} onCerrar={() => setMenu(null)} />
                    )}
                </div>

                {agrupables.length > 0 && (
                    <div style={{ position: 'relative' }}>
                        <button type="button" className={`pastilla${dimension ? ' pastilla--on' : ''}`}
                            aria-expanded={menu === 'agrupar'} aria-haspopup="menu"
                            onClick={() => setMenu((m) => (m === 'agrupar' ? null : 'agrupar'))}>
                            <Rows size={15} />
                            {dimension ? `Por ${dimension.label.toLowerCase()}` : 'Sin agrupar'}
                            <ChevronDown size={14} />
                        </button>
                        {menu === 'agrupar' && (
                            <MenuAgrupar agrupables={agrupables} filas={mostradas} valor={agrupacion}
                                onElegir={(key) => { setAgrupacion(key); setMenu(null); }}
                                onCerrar={() => setMenu(null)} />
                        )}
                    </div>
                )}

                {extra}

                {buscar && (
                    <label className="busca busca--sm">
                        <span className="mut40" style={{ display: 'flex' }}><Search size={14} /></span>
                        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                            placeholder={buscarPlaceholder} aria-label="Buscar" />
                    </label>
                )}

                <span className="barra-cuenta">
                    <span className="t-cap mut40 num">mostrando {mostradas.length} de {filas.length}</span>
                    {ayuda && <Tip titulo="Qué estás mirando" texto={ayuda} />}
                </span>
            </div>

            {activas > 0 && (
                <div className="fila filtro-fila">
                    <span className="t-rotulo">{modo === 'alguna' ? 'Cumple alguna:' : 'Cumple todas:'}</span>
                    {facetas.flatMap((f) => (elegidas[f.key] || []).map((v) => (
                        <button key={`${f.key}-${v}`} type="button" className="chip filtro-tag"
                            style={{ '--c': 'var(--brand-secondary)', textTransform: 'none', letterSpacing: 0, fontWeight: 700 }}
                            aria-label={`Quitar ${f.label}: ${v}`} onClick={() => quitar(f.key, v)}>
                            {f.label}: {v}
                            <X size={12} />
                        </button>
                    )))}
                </div>
            )}

            <div className="tabla lc-tabla" role="table" style={{ '--lc-min': `${ancho}px` }}>
                <CajaDesplazable className="lc-caja" claseArriba="lc-arriba">
                    <div className="lc-cabeza">
                    {conGrupos && (
                        <div className="tabla-cab lc-grupos" style={{ '--cols': plantilla }} aria-hidden="true">
                            {visibles.map((c, i) => (
                                <span key={c.key} className={claseDe(c, i)} style={c.pegada ? { left: pegadas[c.key] } : undefined}>
                                    {c.grupo || ''}
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="tabla-cab" style={{ '--cols': plantilla }} role="row">
                        {visibles.map((c, i) => {
                            const dir = orden?.key === c.key ? orden.dir : null;
                            const ordenable = c.ordenable !== false && !!c.valor;
                            return (
                                <span key={c.key} className={claseDe(c, i, 'cab-celda')}
                                    style={c.pegada ? { left: pegadas[c.key] } : undefined} role="columnheader">
                                    {ordenable ? (
                                        <button type="button" className={`cab-orden${dir ? ' cab-orden--on' : ''}`}
                                            onClick={() => ordenar(c.key)} aria-label={`Ordenar por ${c.header}`}>
                                            <span className="trunc">{c.header}</span>
                                            {dir && <ArrowDown size={11} aria-hidden="true"
                                                className={dir === 'asc' ? 'cab-flecha cab-flecha--asc' : 'cab-flecha'} />}
                                        </button>
                                    ) : <span className="trunc">{c.header}</span>}
                                    {c.ayuda && <Tip texto={c.ayuda} titulo={c.header} />}
                                    {c.redimensionable && (
                                        <AsaDeAncho nombre={c.header} onAncho={(px) => fijarAncho(c.key, px)}
                                            onRestablecer={() => fijarAncho(c.key, null)} />
                                    )}
                                </span>
                            );
                        })}
                    </div>
                    {totales && mostradas.length > 0 && (
                        <div className="tabla-fila lc-totales" style={{ '--cols': plantilla }} role="row">
                            {visibles.map((c, i) => {
                                const t = totalesDe[c.key];
                                return (
                                    <div key={c.key} role="cell" className={claseDe(c, i, 'num')}
                                        style={c.pegada ? { left: pegadas[c.key] } : undefined}>
                                        {i === 0 ? (
                                            <span className="lc-total-et">
                                                <b>{totales.etiqueta}</b>
                                                <small>{totales.sub ? totales.sub(mostradas) : ''}</small>
                                            </span>
                                        ) : t && (
                                            <span className="lc-total-v"><b>{t.texto}</b><small>{t.tipo}</small></span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    </div>
                    {mostradas.length === 0 ? (
                        <p className="t-body mut40 lc-vacio">{vacio}</p>
                    ) : dimension ? (
                        <ListaAgrupable filas={mostradas} dimension={dimension}
                            renderFilas={(filasGrupo) => filasGrupo.map(dibujarFila)} />
                    ) : pagina.map(dibujarFila)}
                    {hayMas && <div ref={pie} className="lc-pie" aria-hidden="true" />}
                </CajaDesplazable>
            </div>
        </div>
    );
};

export default ListaConfigurable;
