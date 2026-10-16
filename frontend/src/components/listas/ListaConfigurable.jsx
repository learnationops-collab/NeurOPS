import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, Check, ChevronDown, Columns, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import PanelConfigurar from '../../pages/comercial/components/PanelConfigurar';
import Tip from '../../pages/comercial/components/Tip';
import { useColumnasVisibles } from './useColumnasVisibles';
import { useEnPantalla } from '../ui/useEnPantalla';
import { usePaginaProgresiva } from './usePaginaProgresiva';
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

const ListaConfigurable = ({
    columnas, facetas = [], filas, clave, onAbrirFila, buscar, buscarPlaceholder = 'Buscar…',
    claveGuardado, vacio = 'No hay filas para mostrar.', ayuda, extra, ordenInicial = null, marcada = null,
}) => {
    const { visibles, alternar, restablecer } = useColumnasVisibles(claveGuardado, columnas);
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

    const plantilla = visibles.map((c) => c.width || 'minmax(0,1fr)').join(' ');
    const quitar = (key, valor) => setElegidas((e) => ({ ...e, [key]: e[key].filter((v) => v !== valor) }));

    return (
        <div className="lista-configurable">
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

            <div className="tabla lc-tabla" role="table">
                <div className="tabla-cab" style={{ '--cols': plantilla }} role="row">
                    {visibles.map((c) => {
                        const dir = orden?.key === c.key ? orden.dir : null;
                        const ordenable = c.ordenable !== false && !!c.valor;
                        return (
                            <span key={c.key} className={`cab-celda${c.alinear === 'der' ? ' lc-der' : ''}`} role="columnheader">
                                {ordenable ? (
                                    <button type="button" className={`cab-orden${dir ? ' cab-orden--on' : ''}`}
                                        onClick={() => ordenar(c.key)} aria-label={`Ordenar por ${c.header}`}>
                                        <span className="trunc">{c.header}</span>
                                        {dir && <ArrowDown size={11} aria-hidden="true"
                                            className={dir === 'asc' ? 'cab-flecha cab-flecha--asc' : 'cab-flecha'} />}
                                    </button>
                                ) : <span className="trunc">{c.header}</span>}
                                {c.ayuda && <Tip texto={c.ayuda} titulo={c.header} />}
                            </span>
                        );
                    })}
                </div>
                {mostradas.length === 0 ? (
                    <p className="t-body mut40 lc-vacio">{vacio}</p>
                ) : pagina.map((fila) => (
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
                        {visibles.map((c) => (
                            <div key={c.key} data-h={c.header} role="cell" className={c.alinear === 'der' ? 'lc-der num' : undefined}>
                                {c.render ? c.render(fila) : (c.valor(fila) ?? '—')}
                            </div>
                        ))}
                    </div>
                ))}
                {hayMas && <div ref={pie} className="lc-pie" aria-hidden="true" />}
            </div>
        </div>
    );
};

export default ListaConfigurable;
