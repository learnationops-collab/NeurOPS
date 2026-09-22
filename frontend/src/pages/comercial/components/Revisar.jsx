import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, Search } from 'lucide-react';
import { Cargando, Chip, fmt } from './Shared';

/**
 * Revisar: el libro de registros con un buscador, un único botón de "Filtros" y los totales de
 * lo filtrado al pie.
 *
 * Todo el filtrado (búsqueda, chips rápidos y facetas) pasa por `aplicarFiltros` y se hace en el
 * cliente sobre las filas del período, que ya vienen del backend. Eso es lo que permite que los
 * contadores de los chips, el "mostrando X de Y" y los totales se recalculen juntos con el mismo
 * conjunto de filas: si cada uno consultara por su cuenta, podrían discrepar.
 *
 * Los totales del pie ignoran el chip rápido a propósito (es un atajo de lectura, no un filtro
 * del alcance), pero sí respetan el período, la búsqueda y las facetas.
 */

// Definición de cada tabla: columnas, facetas y chips rápidos. Una sola fuente para las cuatro.
const TABLAS = {
    agendas: {
        label: 'Agendas',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Cliente', width: '1.9fr' },
            { key: 'fuente', header: 'Fuente', width: '1.1fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            { key: 'pre_call', header: 'Pre call', width: '1fr' },
            { key: 'post_call', header: 'Post call', width: '1.2fr' },
        ],
        facetas: [
            { key: 'pre_call', label: 'Pre call', de: (f) => f.pre_call.label },
            { key: 'post_call', label: 'Post call', de: (f) => f.post_call.label },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
            { key: 'fuente', label: 'Fuente', de: (f) => f.fuente },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
            { key: 'no_show', label: 'No show', filtro: (f) => f.post_call.key === 'no_show' },
        ],
    },
    ventas: {
        label: 'Ventas',
        cols: [
            { key: 'fecha', header: 'Venta', width: '0.8fr' },
            { key: 'cliente', header: 'Cliente', width: '1.9fr' },
            { key: 'programa', header: 'Programa', width: '1.3fr' },
            { key: 'tipo_pago', header: 'Pago', width: '1.1fr' },
            { key: 'monto', header: 'Monto', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
        ],
        facetas: [
            { key: 'programa', label: 'Programa', de: (f) => f.programa },
            { key: 'tipo_pago', label: 'Tipo de pago', de: (f) => f.tipo_pago.label },
            { key: 'metodo', label: 'Método', de: (f) => f.metodo },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'completo', label: 'Pago completo', filtro: (f) => f.tipo_pago.key === 'completo' },
            { key: 'parcial', label: 'Split Pay', filtro: (f) => f.tipo_pago.key === 'parcial' },
        ],
    },
    leads: {
        label: 'Leads entrantes',
        cols: [
            { key: 'fecha', header: 'Llegó', width: '0.9fr' },
            { key: 'cliente', header: 'Cliente', width: '2fr' },
            { key: 'fuente', header: 'Fuente', width: '1fr' },
            { key: 'setter', header: 'Setter', width: '1fr' },
            { key: 'estado', header: 'Estado', width: '1.2fr' },
            { key: 'mensajes', header: 'Mensajes', width: '0.7fr' },
        ],
        facetas: [
            { key: 'estado', label: 'Estado', de: (f) => f.estado.label },
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
        ],
        chips: [
            { key: 'todos', label: 'Todos', filtro: () => true },
            { key: 'agendo', label: 'Agendaron', filtro: (f) => f.agendo },
            { key: 'sin_respuesta', label: 'Sin respuesta', filtro: (f) => !f.respondio },
        ],
    },
    generadas: {
        label: 'Agendas generadas',
        cols: [
            { key: 'fecha', header: 'Reunión', width: '0.9fr' },
            { key: 'cliente', header: 'Cliente', width: '1.9fr' },
            { key: 'setter', header: 'Setter', width: '1fr' },
            { key: 'closer', header: 'Closer', width: '0.9fr' },
            { key: 'pre_call', header: 'Pre call', width: '1fr' },
            { key: 'post_call', header: 'Post call', width: '1.2fr' },
        ],
        facetas: [
            { key: 'setter', label: 'Setter', de: (f) => f.setter },
            { key: 'pre_call', label: 'Pre call', de: (f) => f.pre_call.label },
            { key: 'post_call', label: 'Post call', de: (f) => f.post_call.label },
            { key: 'closer', label: 'Closer', de: (f) => f.closer },
        ],
        chips: [
            { key: 'todas', label: 'Todas', filtro: () => true },
            { key: 'asistieron', label: 'Asistieron', filtro: (f) => f.asistio },
            { key: 'pendientes', label: 'Pendientes', filtro: (f) => f.post_call.key === 'pendiente' },
        ],
    },
};

export const TABLAS_POR_ROL = {
    closers: ['agendas', 'ventas'],
    setters: ['leads', 'generadas'],
};

const texto = (fila) => [fila.cliente, fila.ig, fila.email, fila.closer, fila.setter, fila.fuente,
    fila.programa].filter(Boolean).join(' ').toLowerCase();

/** Búsqueda + facetas. El chip rápido se aplica aparte, para que los totales lo ignoren. */
const aplicarFiltros = (filas, def, query, facetas, modo) => {
    const q = query.trim().toLowerCase();
    return filas.filter(f => {
        if (q && !texto(f).includes(q)) return false;
        const activas = def.facetas.filter(fa => (facetas[fa.key] || []).length > 0);
        if (activas.length === 0) return true;
        const cumple = activas.map(fa => facetas[fa.key].includes(fa.de(f)));
        return modo === 'alguna' ? cumple.some(Boolean) : cumple.every(Boolean);
    });
};

const PanelFiltros = ({ def, filas, facetas, setFacetas, modo, setModo, onCerrar }) => {
    const [abierta, setAbierta] = useState(null);
    const ref = useRef(null);

    useEffect(() => {
        const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) onCerrar(); };
        document.addEventListener('mousedown', fuera);
        return () => document.removeEventListener('mousedown', fuera);
    }, [onCerrar]);

    const opcionesDe = (faceta) => {
        const conteo = new Map();
        filas.forEach(f => {
            const v = faceta.de(f);
            if (v) conteo.set(v, (conteo.get(v) || 0) + 1);
        });
        return [...conteo.entries()].sort((a, b) => b[1] - a[1]);
    };

    const alternar = (faceta, valor) => {
        const actuales = facetas[faceta.key] || [];
        setFacetas({
            ...facetas,
            [faceta.key]: actuales.includes(valor)
                ? actuales.filter(v => v !== valor)
                : [...actuales, valor],
        });
    };

    const resumen = (faceta) => {
        const sel = facetas[faceta.key] || [];
        if (sel.length === 0) return 'Todas';
        return sel.length === 1 ? sel[0] : `${sel.length} activas`;
    };

    return (
        <div className="dc-pop" ref={ref} style={{ width: 'min(340px, 86vw)', minWidth: 'min(340px, 86vw)' }}>
            {def.facetas.map(faceta => {
                const sel = facetas[faceta.key] || [];
                return (
                    <div key={faceta.key} className="dc-facet">
                        <button type="button" className="dc-facet-head" aria-expanded={abierta === faceta.key}
                            onClick={() => setAbierta(a => (a === faceta.key ? null : faceta.key))}>
                            <span className="dc-total-label">{faceta.label}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="ln-t-caption" style={{ color: sel.length ? 'var(--brand-secondary)' : 'var(--text-muted-40)' }}>
                                    {resumen(faceta)}
                                </span>
                                <ChevronDown size={14} className="dc-facet-chevron" />
                            </span>
                        </button>
                        {abierta === faceta.key && (
                            <div style={{ paddingBottom: 8 }}>
                                {opcionesDe(faceta).map(([valor, n]) => (
                                    <button key={valor} type="button" className="dc-facet-opt"
                                        onClick={() => alternar(faceta, valor)}>
                                        <span className="dc-check" data-on={sel.includes(valor)}>
                                            {sel.includes(valor) && <Check size={11} />}
                                        </span>
                                        <span style={{ flex: 1 }}>{valor}</span>
                                        <span className="ln-muted-40 dc-num">{n}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 10 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="ln-t-caption ln-muted">Cumplir</span>
                    {['todas', 'alguna'].map(m => (
                        <button key={m} type="button" className="dc-chip-btn" aria-pressed={modo === m}
                            style={{ height: 26, fontSize: 11.5 }} onClick={() => setModo(m)}>
                            {m === 'todas' ? 'Todas' : 'Alguna'}
                        </button>
                    ))}
                </span>
                <button type="button" className="ln-btn ln-btn--ghost ln-btn--sm" style={{ height: 30 }}
                    onClick={() => setFacetas({})}>
                    Limpiar todo
                </button>
            </div>
        </div>
    );
};

const TotalesAgendas = ({ totales, alcance }) => {
    const tarjetas = [
        { label: 'Agendas', valor: fmt.num(totales.agendas), color: 'var(--text-on-surface)',
            hint: `${totales.realizadas} ya realizadas` },
        { label: 'Show up', valor: fmt.pct(totales.show_up), color: 'var(--success)',
            hint: `${totales.asistieron} de ${totales.realizadas} asistieron` },
        { label: 'Close rate', valor: fmt.pct(totales.close_rate), color: 'var(--brand-secondary)',
            hint: `${totales.ventas} de ${totales.asistieron} cerraron` },
        { label: 'Seguimiento', valor: fmt.num(totales.seguimiento), color: 'var(--warning)',
            hint: 'asistieron sin cerrar' },
        { label: 'No show', valor: fmt.num(totales.no_show), color: 'var(--error)',
            hint: `${fmt.pct(totales.no_show_pct)} de las realizadas` },
        { label: 'Pendientes', valor: fmt.num(totales.pendientes),
            color: totales.pendientes_con_retraso ? 'var(--warning)' : 'var(--idle)',
            hint: totales.pendientes_con_retraso ? `${totales.pendientes_con_retraso} con retraso` : 'al día' },
    ];
    return (
        <div className="dc-totales">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <span className="dc-total-label">Totales de lo filtrado</span>
                <span className="ln-t-caption ln-muted-40">{alcance}</span>
            </div>
            <div className="dc-totales-grid">
                {tarjetas.map(t => (
                    <div key={t.label} className="dc-total-card">
                        <div className="dc-total-label">{t.label}</div>
                        <div className="dc-total-value" style={{ color: t.color }}>{t.valor}</div>
                        <div className="dc-total-hint">{t.hint}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const TotalesVentas = ({ totales, alcance }) => (
    <div className="dc-totales">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span className="dc-total-label">Totales de lo filtrado</span>
            <span className="ln-t-caption ln-muted-40">{alcance}</span>
        </div>
        <div className="dc-totales-grid">
            <div className="dc-total-card">
                <div className="dc-total-label">Cash</div>
                <div className="dc-total-value">{fmt.money(totales.cash)}</div>
                <div className="dc-total-hint">{totales.filas} cobros</div>
            </div>
            <div className="dc-total-card">
                <div className="dc-total-label">Ventas</div>
                <div className="dc-total-value" style={{ color: 'var(--brand-secondary)' }}>{totales.ventas}</div>
                <div className="dc-total-hint">completo o split</div>
            </div>
            <div className="dc-total-card">
                <div className="dc-total-label">Ticket</div>
                <div className="dc-total-value">{fmt.money(totales.ticket)}</div>
                <div className="dc-total-hint">cash / ventas</div>
            </div>
            <div className="dc-total-card">
                <div className="dc-total-label">Cash neto</div>
                <div className="dc-total-value" style={{ color: 'var(--success)' }}>{fmt.money(totales.cash_neto)}</div>
                <div className="dc-total-hint">sin fees de pasarela</div>
            </div>
        </div>
    </div>
);

const TotalesLeads = ({ totales, alcance }) => (
    <div className="dc-totales">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <span className="dc-total-label">Totales de lo filtrado</span>
            <span className="ln-t-caption ln-muted-40">{alcance}</span>
        </div>
        <div className="dc-totales-grid">
            <div className="dc-total-card">
                <div className="dc-total-label">Leads</div>
                <div className="dc-total-value">{totales.leads}</div>
                <div className="dc-total-hint">{totales.mensajes} mensajes</div>
            </div>
            <div className="dc-total-card">
                <div className="dc-total-label">Respuesta</div>
                <div className="dc-total-value" style={{ color: 'var(--info)' }}>{fmt.pct(totales.respuesta)}</div>
                <div className="dc-total-hint">{totales.respondieron} respondieron</div>
            </div>
            <div className="dc-total-card">
                <div className="dc-total-label">Cualificación</div>
                <div className="dc-total-value" style={{ color: 'var(--success)' }}>{fmt.pct(totales.cualificacion)}</div>
                <div className="dc-total-hint">{totales.cualificados} cualificados</div>
            </div>
            <div className="dc-total-card">
                <div className="dc-total-label">Conversión</div>
                <div className="dc-total-value" style={{ color: 'var(--brand-secondary)' }}>{fmt.pct(totales.conversion)}</div>
                <div className="dc-total-hint">{totales.agendas} agendaron</div>
            </div>
        </div>
    </div>
);

const Celda = ({ fila, col }) => {
    switch (col.key) {
        case 'fecha':
            return (
                <span>
                    <span className="dc-cell-main dc-num">{fmt.fecha(fila.fecha)}</span>
                    <span className="dc-cell-sub dc-num">{fmt.hora(fila.fecha)}</span>
                </span>
            );
        case 'cliente':
            return (
                <span style={{ minWidth: 0 }}>
                    <span className="dc-cell-main" style={{ display: 'block' }}>{fila.cliente}</span>
                    {fila.ig && <span className="dc-cell-sub">{fila.ig}</span>}
                </span>
            );
        case 'pre_call':
            return <Chip chip={fila.pre_call} sm />;
        case 'post_call':
            return (
                <span>
                    <Chip chip={fila.post_call} sm />
                    {fila.retraso_dias > 0 && (
                        <span className="dc-retraso">{fila.retraso_dias} días sin reportar</span>
                    )}
                </span>
            );
        case 'estado':
            return <Chip chip={fila.estado} sm />;
        case 'tipo_pago':
            return (
                <span>
                    <Chip chip={fila.tipo_pago} sm />
                    <span className="dc-cell-sub">{fila.metodo}</span>
                </span>
            );
        case 'monto':
            return <span className="dc-cell-main dc-num">{fmt.money(fila.monto)}</span>;
        case 'programa':
            return (
                <span className="ln-program">
                    <span className="ln-program-dot" style={{
                        background: fila.programa === 'Residency Roadmap' ? 'var(--prog-elite-b)' : 'var(--prog-ace)',
                    }} />
                    {fila.programa}
                </span>
            );
        case 'mensajes':
            return <span className="dc-cell-main dc-num">{fila.mensajes}</span>;
        default:
            return <span className="ln-t-body-sm ln-muted">{fila[col.key] || '—'}</span>;
    }
};

const Revisar = ({ tabla, setTabla, datos, cargando, rol, basis, setBasis, alcance, onAbrirFila, filtroInicial }) => {
    const [query, setQuery] = useState('');
    const [facetas, setFacetas] = useState({});
    const [modo, setModo] = useState('todas');
    const [chip, setChip] = useState(null);
    const [panelAbierto, setPanelAbierto] = useState(false);

    const def = TABLAS[tabla];

    // Un drill-down desde Analizar llega con una faceta ya elegida.
    useEffect(() => {
        if (!filtroInicial) return;
        const nuevas = {};
        Object.entries(filtroInicial).forEach(([k, v]) => { nuevas[k] = [v]; });
        setFacetas(nuevas);
        setChip(null);
    }, [filtroInicial]);

    // Al cambiar de tabla, los filtros de la anterior no tienen sentido.
    useEffect(() => { setFacetas({}); setChip(null); setQuery(''); }, [tabla]);

    const filas = datos?.filas || [];
    const filtradas = useMemo(
        () => aplicarFiltros(filas, def, query, facetas, modo),
        [filas, def, query, facetas, modo]);

    const chipActivo = chip || def.chips[0].key;
    const visibles = useMemo(
        () => filtradas.filter(def.chips.find(c => c.key === chipActivo)?.filtro || (() => true)),
        [filtradas, def, chipActivo]);

    const activas = def.facetas.reduce((a, f) => a + (facetas[f.key]?.length || 0), 0);
    const grid = def.cols.map(c => c.width).join(' ');

    // Los totales se recalculan sobre lo filtrado, pero en el cliente no se puede: el backend ya
    // mandó los del período completo. Se recalculan con las mismas reglas usando las filas
    // visibles, para que el pie cierre con la tabla (ver el docstring del módulo).
    const totales = useMemo(() => {
        if (tabla === 'ventas') {
            const cash = filtradas.reduce((a, f) => a + f.monto, 0);
            const ventas = filtradas.filter(f => f.es_venta).length;
            return {
                filas: filtradas.length, ventas, cash: Math.round(cash * 100) / 100,
                cash_neto: Math.round(filtradas.reduce((a, f) => a + f.monto_neto, 0) * 100) / 100,
                ticket: ventas ? Math.round((cash / ventas) * 100) / 100 : null,
            };
        }
        if (tabla === 'leads') {
            const respondieron = filtradas.filter(f => f.respondio).length;
            const cualificados = filtradas.filter(f => f.cualificado).length;
            const agendaron = filtradas.filter(f => f.agendo).length;
            const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
            return {
                leads: filtradas.length, respondieron, respuesta: pct(respondieron, filtradas.length),
                cualificados, cualificacion: pct(cualificados, respondieron),
                agendas: agendaron, conversion: pct(agendaron, filtradas.length),
                mensajes: filtradas.reduce((a, f) => a + f.mensajes, 0),
            };
        }
        const realizadas = filtradas.filter(f => f.realizada).length;
        const asistieron = filtradas.filter(f => f.asistio).length;
        const ventas = filtradas.filter(f => f.post_call.key === 'venta').length;
        const noShow = filtradas.filter(f => f.post_call.key === 'no_show').length;
        const pendientes = filtradas.filter(f => f.post_call.key === 'pendiente');
        const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);
        return {
            agendas: filtradas.length, realizadas, asistieron, show_up: pct(asistieron, realizadas),
            ventas, close_rate: pct(ventas, asistieron),
            seguimiento: filtradas.filter(f => ['seguimiento', 'presento_no_cerro'].includes(f.post_call.key)).length,
            no_show: noShow, no_show_pct: pct(noShow, realizadas),
            pendientes: pendientes.length,
            pendientes_con_retraso: pendientes.filter(f => f.retraso_dias > 0).length,
        };
    }, [filtradas, tabla]);

    const alcanceTexto = [alcance, query ? `"${query}"` : null].filter(Boolean).join(' · ');

    return (
        <div className="ln-panel">
            <div style={{ marginBottom: 16 }}>
                <div className="dc-seg" role="tablist" aria-label="Tabla">
                    {TABLAS_POR_ROL[rol].map(k => (
                        <button key={k} type="button" role="tab" aria-selected={tabla === k}
                            className="dc-seg-tab" onClick={() => setTabla(k)}>
                            {TABLAS[k].label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="dc-toolbar">
                <span className="dc-search">
                    <Search size={14} className="ln-muted" />
                    <input value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar cliente, @ig, persona…" />
                </span>

                {(tabla === 'agendas' || tabla === 'generadas') && (
                    <div className="dc-seg" style={{ padding: 3 }}>
                        {[['meet', 'Fecha meet'], ['creacion', 'F. creación']].map(([k, label]) => (
                            <button key={k} type="button" className="dc-seg-tab" aria-selected={basis === k}
                                style={{ height: 28, padding: '0 12px', fontSize: 12 }}
                                onClick={() => setBasis(k)}>
                                {label}
                            </button>
                        ))}
                    </div>
                )}

                {def.chips.map(c => (
                    <button key={c.key} type="button" className="dc-chip-btn" aria-pressed={chipActivo === c.key}
                        onClick={() => setChip(c.key)}>
                        {c.label} · {filtradas.filter(c.filtro).length}
                    </button>
                ))}

                <div className="dc-pop-wrap" style={{ marginLeft: 'auto' }}>
                    <button type="button" className={`dc-filters-btn${activas ? ' is-active' : ''}`}
                        aria-expanded={panelAbierto} onClick={() => setPanelAbierto(a => !a)}>
                        <Filter size={14} />
                        Filtros
                        {activas > 0 && <span className="dc-badge">{activas}</span>}
                        <ChevronDown size={14} />
                    </button>
                    {panelAbierto && (
                        <PanelFiltros def={def} filas={filas} facetas={facetas} setFacetas={setFacetas}
                            modo={modo} setModo={setModo} onCerrar={() => setPanelAbierto(false)} />
                    )}
                </div>
            </div>

            {activas > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
                    <span className="ln-t-caption ln-muted-40">
                        Cumple {modo === 'alguna' ? 'ALGUNA' : 'TODAS'}:
                    </span>
                    {def.facetas.flatMap(fa => (facetas[fa.key] || []).map(v => (
                        <button key={`${fa.key}-${v}`} type="button" className="dc-chip-btn" aria-pressed
                            style={{ height: 26, fontSize: 11.5 }}
                            onClick={() => setFacetas({ ...facetas, [fa.key]: facetas[fa.key].filter(x => x !== v) })}>
                            {v} ×
                        </button>
                    )))}
                </div>
            )}

            {cargando ? <Cargando /> : (
                <>
                    <div className="dc-table">
                        <div className="dc-thead" style={{ gridTemplateColumns: grid }}>
                            {def.cols.map(c => <span key={c.key}>{c.header}</span>)}
                        </div>
                        {visibles.length === 0 && (
                            <div className="ln-empty">
                                <p className="ln-empty-title">Nada que revisar acá</p>
                                <p className="ln-empty-desc">
                                    Con este período y estos filtros no queda ninguna fila.
                                </p>
                            </div>
                        )}
                        {visibles.map(fila => (
                            <button key={`${fila.tipo}-${fila.id}`} type="button" className="dc-trow"
                                style={{ gridTemplateColumns: grid }} onClick={() => onAbrirFila(fila)}>
                                {def.cols.map(c => <Celda key={c.key} fila={fila} col={c} />)}
                            </button>
                        ))}
                    </div>

                    <div className="ln-t-caption ln-muted-40 dc-num" style={{ marginTop: 12 }}>
                        mostrando {visibles.length} de {filtradas.length}
                    </div>

                    {tabla === 'ventas' && <TotalesVentas totales={totales} alcance={alcanceTexto} />}
                    {tabla === 'leads' && <TotalesLeads totales={totales} alcance={alcanceTexto} />}
                    {(tabla === 'agendas' || tabla === 'generadas') &&
                        <TotalesAgendas totales={totales} alcance={alcanceTexto} />}
                </>
            )}
        </div>
    );
};

export default Revisar;
