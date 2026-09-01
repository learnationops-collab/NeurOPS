import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
import api from '../../../services/api';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');

const cuotaDateLabel = (fechaStr) => {
    if (!fechaStr) return '';
    const d = new Date(`${fechaStr}T00:00:00`);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

const FILTERS = [
    { key: 'todos', label: 'Todos' },
    { key: 'con_deuda', label: 'Con deuda' },
    { key: 'al_dia', label: 'Al día' },
    { key: 'vencida', label: 'Cuota vencida' },
];

const SORTS = [
    { key: 'deuda', label: 'Deuda' },
    { key: 'reciente', label: 'Reciente' },
    { key: 'nombre', label: 'A-Z' },
];

// Filtro de período pedido por el usuario (feedback en video, 27/ago/2026): "que aparezca los
// últimos 30 días, los últimos 60 días, los últimos 15 días, hoy". Se aplica sobre la fecha de
// inscripción en la vista "Por cliente" y sobre la fecha de cada pago en "Cronológico" — cada
// vista filtra por SU propia fecha relevante, no por una sola en común (ver `withinPeriod`).
const PERIODS = [
    { key: 'all', label: 'Todos' },
    { key: 'today', label: 'Hoy' },
    { key: '15', label: 'Últimos 15 días' },
    { key: '30', label: 'Últimos 30 días' },
    { key: '60', label: 'Últimos 60 días' },
];

const withinPeriod = (dateStr, period) => {
    if (period === 'all') return true;
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dDay = new Date(d);
    dDay.setHours(0, 0, 0, 0);
    if (period === 'today') return dDay.getTime() === today.getTime();
    const days = Number(period);
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - days);
    return dDay >= cutoff && dDay <= today;
};

// Los 6 tipos canónicos que usa todo el sistema (SheetsService._extract_tipo_keyword) — mismo
// orden y color en la tabla agrupada y en la lista cronológica, para que sean reconocibles.
const TIPOS_PAGO = [
    { key: 'seña', label: 'Seña', color: '#D9A441' },
    { key: 'completo', label: 'Completo', color: '#2FBF8F' },
    { key: 'parcial', label: 'Parcial', color: '#4E8BD8' },
    { key: 'cuota', label: 'Cuota', color: '#8B5CF6' },
    { key: 'renovacion', label: 'Renovación', color: '#22D3C4' },
    { key: 'upsell', label: 'Upsell', color: '#FF3FA4' },
];

const VIEWS = [
    { key: 'cliente', label: 'Por cliente' },
    { key: 'cronologico', label: 'Cronológico' },
];

// "Mi Cartera": todo cliente que este closer efectivamente VENDIÓ (email_vendedor en
// FinancialSale al momento de reportar la venta), con su deuda y su próxima cuota — pedido del
// usuario para poder buscar a cualquier cliente propio y ver de un vistazo en qué programa está
// y cómo va con los pagos. Antes reusaba `/closer/followups/pool?tipo=cerrada` (la cola de "a
// quién le toca cobrar hoy", que sigue al DUEÑO ACTUAL de la agenda, no a quién vendió) — eso
// hacía que closers activos vieran en su cartera clientes de closers dados de baja, porque ese
// endpoint no filtra a cuál closer específico asignar un huérfano (bug real reportado por el
// usuario, 27/ago/2026: "un closer tiene ventas que no le pertenecen"). `/closer/cartera` es el
// endpoint correcto para esto: filtra por quién reportó la venta, punto.
const MiCarteraPane = ({ onOpenLead }) => {
    const [items, setItems] = useState([]);
    const [programas, setProgramas] = useState({});
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('todos');
    const [programa, setPrograma] = useState('ALL');
    const [sort, setSort] = useState('deuda');
    const [period, setPeriod] = useState('all');
    const [limit, setLimit] = useState(20);
    // "Por cliente" (una fila por cliente, con el total pagado por tipo) o "Cronológico" (una
    // fila por pago individual, ordenado por fecha) — las dos formas de ver la cartera que pidió
    // el usuario. Mismo dato de base (`items[].pagos`), sin pedirle nada distinto al backend.
    const [view, setView] = useState('cliente');

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/cartera');
            setItems(res.data?.items || []);
            setProgramas(res.data?.programas || {});
        } catch (err) {
            console.error('Error cargando la cartera de clientes', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    // Filtros que no dependen de una fecha en particular (búsqueda/programa/deuda) — comunes a
    // las dos vistas. El filtro de período se aplica DESPUÉS, por separado en cada vista, porque
    // cada una filtra por su propia fecha relevante (inscripción vs. fecha de pago individual).
    const filteredBase = useMemo(() => {
        const query = q.trim().toLowerCase();
        return items.filter(it => {
            if (query && !it.lead_name.toLowerCase().includes(query)) return false;
            if (programa !== 'ALL' && it.programa_code !== programa) return false;
            if (filter === 'con_deuda' && !(it.deuda > 0)) return false;
            if (filter === 'al_dia' && it.deuda > 0) return false;
            if (filter === 'vencida' && !(it.proxima_cuota && it.proxima_cuota.vencida)) return false;
            return true;
        });
    }, [items, q, filter, programa]);

    const filtered = useMemo(() => {
        let list = filteredBase.filter(it => withinPeriod(it.enrollment_date, period));
        list = list.slice().sort((a, b) => {
            if (sort === 'deuda') return (b.deuda || 0) - (a.deuda || 0);
            if (sort === 'reciente') return new Date(b.enrollment_date || 0) - new Date(a.enrollment_date || 0);
            return a.lead_name.localeCompare(b.lead_name, 'es');
        });
        return list;
    }, [filteredBase, period, sort]);

    const shown = filtered.slice(0, limit);

    // Vista cronológica: cada pago individual de cada cliente que pasa los filtros no-fecha
    // (`filteredBase`, sin el filtro de período — ese se aplica acá abajo sobre la fecha del
    // PAGO, no la de inscripción, para no ocultar un pago reciente de un cliente que se inscribió
    // hace tiempo), más reciente primero.
    const payments = useMemo(() => {
        const flat = filteredBase.flatMap(it => (it.pagos || []).map(p => ({
            ...p,
            client_id: it.client_id,
            client_name: it.lead_name,
            instagram: it.instagram,
            programa_code: it.programa_code,
            item: it
        })));
        const withinPeriodList = flat.filter(p => withinPeriod(p.date, period));
        withinPeriodList.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        return withinPeriodList;
    }, [filteredBase, period]);
    const shownPayments = payments.slice(0, limit);

    // KPIs con datos que este endpoint realmente trae — sin inventar "cobrado"/"renovados" que
    // necesitarían el historial completo de pagos por cliente (no expuesto acá todavía).
    const totalDeuda = items.reduce((s, it) => s + (it.deuda || 0), 0);
    const conDeuda = items.filter(it => it.deuda > 0).length;
    const alDia = items.length - conDeuda;
    const vencidas = items.filter(it => it.proxima_cuota?.vencida).length;

    const openClient = (item) => {
        onOpenLead({
            id: item.id,
            client_id: item.client_id,
            lead_name: item.lead_name,
            instagram: item.instagram,
            phone: item.phone,
            examen: item.examen,
            origin: item.origin,
            fase: 'seg',
            tipo: 'cerrada',
            seguimiento_intento: item.seguimiento_intento,
            closer_notes: item.closer_notes,
            call_date: item.call_date,
            enrollment_date: item.enrollment_date,
            deuda: item.deuda,
            programa_nombre: item.programa_nombre,
            programa_code: item.programa_code,
            proxima_cuota: item.proxima_cuota
        });
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-pink-500" size={32} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando tu cartera...</span>
            </div>
        );
    }

    return (
        <div className="space-y-5">
            {/* KPIs */}
            <div className="rpt-kpis-v6">
                {[
                    { label: 'Clientes en cartera', value: items.length, color: '#4E8BD8' },
                    { label: 'Deuda total pendiente', value: money(totalDeuda), color: '#FF3FA4' },
                    { label: 'Al día', value: `${alDia}/${items.length || 0}`, color: '#2FBF8F' },
                    { label: 'Cuotas vencidas', value: vencidas, color: '#D9A441' },
                ].map(k => (
                    <div key={k.label} className="rpt-kpi-v6">
                        <b style={{ color: k.color, fontSize: '28px' }}>{k.value}</b>
                        <span>{k.label}</span>
                    </div>
                ))}
            </div>

            {/* Búsqueda + filtros */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 p-1 rounded-full" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--v6-bd)' }}>
                    {VIEWS.map(v => (
                        <button
                            key={v.key}
                            type="button"
                            onClick={() => { setView(v.key); setLimit(20); }}
                            className="px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                            style={view === v.key
                                ? { background: 'var(--v6-gradb)', color: '#fff' }
                                : { background: 'transparent', color: 'rgba(255,255,255,.5)' }}
                        >
                            {v.label}
                        </button>
                    ))}
                </div>
                <div className="flex-1 min-w-[240px] flex items-center gap-2.5 px-4 h-11 rounded-full" style={{ background: 'rgba(255,255,255,.045)', border: '1px solid var(--v6-bd)' }}>
                    <Search size={15} style={{ color: 'rgba(255,255,255,.42)' }} />
                    <input
                        value={q}
                        onChange={(e) => { setQ(e.target.value); setLimit(20); }}
                        placeholder="Buscar cliente por nombre..."
                        className="flex-1 bg-transparent border-none text-white text-sm font-semibold outline-none"
                    />
                    {q && (
                        <button type="button" onClick={() => setQ('')} className="text-[10px] font-black uppercase cursor-pointer" style={{ color: 'var(--v6-pink)' }}>
                            Limpiar
                        </button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        type="button"
                        onClick={() => { setPeriod(p.key); setLimit(20); }}
                        className="px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                        style={period === p.key
                            ? { background: 'var(--v6-gradb)', color: '#fff' }
                            : { background: 'transparent', border: '1px solid var(--v6-bd)', color: 'rgba(255,255,255,.5)' }}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {FILTERS.map(f => (
                    <button
                        key={f.key}
                        type="button"
                        onClick={() => { setFilter(f.key); setLimit(20); }}
                        className="px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                        style={filter === f.key
                            ? { background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.32)', color: '#fff' }
                            : { background: 'transparent', border: '1px solid var(--v6-bd)', color: 'rgba(255,255,255,.5)' }}
                    >
                        {f.label}
                    </button>
                ))}
                <div className="flex-1" />
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.32)' }}>Programa</span>
                    {['ALL', ...Object.keys(programas)].map(code => (
                        <button
                            key={code}
                            type="button"
                            onClick={() => { setPrograma(code); setLimit(20); }}
                            className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                            style={programa === code
                                ? { background: 'rgba(255,255,255,.09)', border: '1px solid #FF3FA4', color: '#FF3FA4' }
                                : { background: 'transparent', border: '1px solid var(--v6-bd)', color: 'rgba(255,255,255,.45)' }}
                        >
                            {code === 'ALL' ? 'Todos' : code}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.32)' }}>Orden</span>
                    {SORTS.map(s => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => setSort(s.key)}
                            className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                            style={sort === s.key
                                ? { background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.28)', color: '#fff' }
                                : { background: 'transparent', border: '1px solid var(--v6-bd)', color: 'rgba(255,255,255,.45)' }}
                        >
                            {s.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabla: "Por cliente" agrupa el total pagado por tipo (una fila por cliente);
                "Cronológico" muestra cada pago individual, más reciente primero. Mismo dato de
                base (`items[].pagos`, ya viene clasificado del backend). */}
            {view === 'cliente' ? (
                <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,.018)', border: '1px solid var(--v6-bd)' }}>
                    <div style={{ minWidth: '1180px', display: 'grid', gridTemplateColumns: `minmax(150px,1.3fr) 74px 100px ${TIPOS_PAGO.map(() => '84px').join(' ')} 100px 120px`, gap: '8px', alignItems: 'center', padding: '13px 20px', background: 'rgba(255,255,255,.035)', borderBottom: '1px solid var(--v6-bd)' }}>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Cliente</span>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Prog.</span>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Inscripción</span>
                        {TIPOS_PAGO.map(t => (
                            <span key={t.key} className="text-[9px] font-black uppercase tracking-widest text-right" style={{ color: t.color }}>{t.label}</span>
                        ))}
                        <span className="text-[9px] font-black uppercase tracking-widest text-right" style={{ color: 'rgba(255,255,255,.38)' }}>Próx. cuota</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-right" style={{ color: 'rgba(255,255,255,.38)' }}>Deuda</span>
                    </div>

                    {shown.length === 0 ? (
                        <div style={{ minWidth: '1180px', padding: '56px 22px', textAlign: 'center' }}>
                            <div className="text-sm font-black" style={{ color: 'rgba(255,255,255,.55)' }}>Sin resultados</div>
                            <div className="text-xs font-semibold mt-1.5" style={{ color: 'rgba(255,255,255,.34)' }}>Probá con otro nombre o quitá los filtros.</div>
                        </div>
                    ) : shown.map(it => {
                        const pc = it.proxima_cuota;
                        const rail = it.deuda === 0 ? '#2FBF8F' : (pc?.vencida ? '#E85C4A' : '#D9A441');
                        const desglose = it.desglose_pagos || {};
                        return (
                            <div
                                key={it.client_id}
                                onClick={() => openClient(it)}
                                className="kcard-v6"
                                style={{
                                    minWidth: '1180px', display: 'grid', gridTemplateColumns: `minmax(150px,1.3fr) 74px 100px ${TIPOS_PAGO.map(() => '84px').join(' ')} 100px 120px`,
                                    gap: '8px', alignItems: 'center', padding: '14px 20px', borderRadius: 0,
                                    borderBottom: '1px solid rgba(255,255,255,.055)', position: 'relative', animation: 'none'
                                }}
                            >
                                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: rail }}></div>
                                <div className="min-w-0">
                                    <div className="text-[13px] font-extrabold truncate">{it.lead_name}</div>
                                    {it.instagram && <div className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,.34)' }}>@{it.instagram.replace('@', '')}</div>}
                                </div>
                                <div>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-black" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }}>
                                        {it.programa_code || '—'}
                                    </span>
                                </div>
                                <div className="text-[10.5px] font-bold" style={{ color: 'rgba(255,255,255,.5)' }}>
                                    {it.enrollment_date ? new Date(it.enrollment_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </div>
                                {TIPOS_PAGO.map(t => {
                                    const v = desglose[t.key] || 0;
                                    return (
                                        <div key={t.key} className="text-right text-[11.5px] font-black tabular-nums" style={{ color: v ? t.color : 'rgba(255,255,255,.2)' }}>
                                            {v ? money(v) : '—'}
                                        </div>
                                    );
                                })}
                                <div className="text-right text-[10.5px] font-bold">
                                    {pc ? (
                                        <span style={{ color: pc.vencida ? '#E85C4A' : '#D9A441' }}>
                                            {pc.sin_plan ? 'Sin plan' : `${pc.vencida ? 'Vencida' : cuotaDateLabel(pc.fecha_vencimiento)}`}
                                        </span>
                                    ) : (
                                        <span style={{ color: '#2FBF8F' }}>Al día</span>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-[14px] font-black tabular-nums" style={{ color: it.deuda ? (pc?.vencida ? '#E85C4A' : '#FF3FA4') : '#2FBF8F' }}>
                                        {it.deuda ? money(it.deuda) : '✓'}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {filtered.length > shown.length && (
                        <div
                            onClick={() => setLimit(l => l + 20)}
                            style={{ minWidth: '1180px', padding: '15px 22px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.025)' }}
                            className="text-[10px] font-black uppercase tracking-widest"
                        >
                            <span style={{ color: 'rgba(255,255,255,.55)' }}>Ver más · {filtered.length - shown.length} restantes</span>
                        </div>
                    )}
                </div>
            ) : (
                <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,.018)', border: '1px solid var(--v6-bd)' }}>
                    <div style={{ minWidth: '680px', display: 'grid', gridTemplateColumns: '110px minmax(150px,1.5fr) 90px 120px 110px 100px', gap: '10px', alignItems: 'center', padding: '13px 20px', background: 'rgba(255,255,255,.035)', borderBottom: '1px solid var(--v6-bd)' }}>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Fecha</span>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Cliente</span>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Programa</span>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Tipo</span>
                        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Método</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-right" style={{ color: 'rgba(255,255,255,.38)' }}>Monto</span>
                    </div>

                    {shownPayments.length === 0 ? (
                        <div style={{ minWidth: '680px', padding: '56px 22px', textAlign: 'center' }}>
                            <div className="text-sm font-black" style={{ color: 'rgba(255,255,255,.55)' }}>Sin pagos registrados</div>
                            <div className="text-xs font-semibold mt-1.5" style={{ color: 'rgba(255,255,255,.34)' }}>Probá con otro nombre o quitá los filtros.</div>
                        </div>
                    ) : shownPayments.map((p, i) => {
                        const tipoInfo = TIPOS_PAGO.find(t => t.key === p.tipo);
                        return (
                            <div
                                key={`${p.client_id}-${i}`}
                                onClick={() => openClient(p.item)}
                                className="kcard-v6"
                                style={{
                                    minWidth: '680px', display: 'grid', gridTemplateColumns: '110px minmax(150px,1.5fr) 90px 120px 110px 100px',
                                    gap: '10px', alignItems: 'center', padding: '13px 20px', borderRadius: 0,
                                    borderBottom: '1px solid rgba(255,255,255,.055)', animation: 'none'
                                }}
                            >
                                <div className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,.5)' }}>
                                    {p.date ? new Date(p.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[13px] font-extrabold truncate">{p.client_name}</div>
                                    {p.instagram && <div className="text-[10px] font-semibold mt-0.5" style={{ color: 'rgba(255,255,255,.34)' }}>@{p.instagram.replace('@', '')}</div>}
                                </div>
                                <div>
                                    <span className="px-2 py-1 rounded-lg text-[10px] font-black" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.15)', color: '#fff' }}>
                                        {p.programa_code || '—'}
                                    </span>
                                </div>
                                <div className="text-[10.5px] font-black uppercase tracking-wide" style={{ color: tipoInfo?.color || 'rgba(255,255,255,.5)' }}>
                                    {tipoInfo?.label || p.tipo_raw || '—'}
                                </div>
                                <div className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,.5)' }}>{p.metodo_pago || '—'}</div>
                                <div className="text-right text-[14px] font-black tabular-nums" style={{ color: tipoInfo?.color || '#fff' }}>{money(p.monto)}</div>
                            </div>
                        );
                    })}

                    {payments.length > shownPayments.length && (
                        <div
                            onClick={() => setLimit(l => l + 20)}
                            style={{ minWidth: '680px', padding: '15px 22px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.025)' }}
                            className="text-[10px] font-black uppercase tracking-widest"
                        >
                            <span style={{ color: 'rgba(255,255,255,.55)' }}>Ver más · {payments.length - shownPayments.length} restantes</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MiCarteraPane;
