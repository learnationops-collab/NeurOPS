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

// "Mi Cartera": todo cliente que este closer alguna vez cerró (venta completada en
// FinancialSale), con su deuda y su próxima cuota — pedido del usuario para poder buscar a
// cualquier cliente propio y ver de un vistazo en qué programa está y cómo va con los pagos,
// sin tener que esperar a que ese cliente le toque como seguimiento de cobro hoy. Reusa el mismo
// `/closer/followups/pool?tipo=cerrada` que ya alimenta la columna "Llamadas cerradas" de
// Seguimientos (mismos datos, sin pool nuevo del lado del backend) — así que la deuda, el
// programa y la próxima cuota que se ven acá son exactamente los mismos que en esa pestaña.
const MiCarteraPane = ({ onOpenLead }) => {
    const [items, setItems] = useState([]);
    const [programas, setProgramas] = useState({});
    const [loading, setLoading] = useState(true);
    const [q, setQ] = useState('');
    const [filter, setFilter] = useState('todos');
    const [programa, setPrograma] = useState('ALL');
    const [sort, setSort] = useState('deuda');
    const [limit, setLimit] = useState(20);

    const fetchItems = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/followups/pool', { params: { tipo: 'cerrada' } });
            setItems(res.data?.items || []);
            setProgramas(res.data?.programas || {});
        } catch (err) {
            console.error('Error cargando la cartera de clientes', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        let list = items.filter(it => {
            if (query && !it.lead_name.toLowerCase().includes(query)) return false;
            if (programa !== 'ALL' && it.programa_code !== programa) return false;
            if (filter === 'con_deuda' && !(it.deuda > 0)) return false;
            if (filter === 'al_dia' && it.deuda > 0) return false;
            if (filter === 'vencida' && !(it.proxima_cuota && it.proxima_cuota.vencida)) return false;
            return true;
        });
        list = list.slice().sort((a, b) => {
            if (sort === 'deuda') return (b.deuda || 0) - (a.deuda || 0);
            if (sort === 'reciente') return new Date(b.enrollment_date || 0) - new Date(a.enrollment_date || 0);
            return a.lead_name.localeCompare(b.lead_name, 'es');
        });
        return list;
    }, [items, q, filter, programa, sort]);

    const shown = filtered.slice(0, limit);

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

            {/* Tabla de clientes */}
            <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,.018)', border: '1px solid var(--v6-bd)' }}>
                <div style={{ minWidth: '760px', display: 'grid', gridTemplateColumns: 'minmax(160px,1.5fr) 90px 110px 150px 130px', gap: '10px', alignItems: 'center', padding: '13px 20px', background: 'rgba(255,255,255,.035)', borderBottom: '1px solid var(--v6-bd)' }}>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Cliente</span>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Programa</span>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Inscripción</span>
                    <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.38)' }}>Próxima cuota</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-right" style={{ color: 'rgba(255,255,255,.38)' }}>Deuda</span>
                </div>

                {shown.length === 0 ? (
                    <div style={{ minWidth: '760px', padding: '56px 22px', textAlign: 'center' }}>
                        <div className="text-sm font-black" style={{ color: 'rgba(255,255,255,.55)' }}>Sin resultados</div>
                        <div className="text-xs font-semibold mt-1.5" style={{ color: 'rgba(255,255,255,.34)' }}>Probá con otro nombre o quitá los filtros.</div>
                    </div>
                ) : shown.map(it => {
                    const pc = it.proxima_cuota;
                    const rail = it.deuda === 0 ? '#2FBF8F' : (pc?.vencida ? '#E85C4A' : '#D9A441');
                    return (
                        <div
                            key={it.client_id}
                            onClick={() => openClient(it)}
                            className="kcard-v6"
                            style={{
                                minWidth: '760px', display: 'grid', gridTemplateColumns: 'minmax(160px,1.5fr) 90px 110px 150px 130px',
                                gap: '10px', alignItems: 'center', padding: '14px 20px', borderRadius: 0,
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
                            <div className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,.5)' }}>
                                {it.enrollment_date ? new Date(it.enrollment_date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </div>
                            <div className="text-[11px] font-bold">
                                {pc ? (
                                    <span style={{ color: pc.vencida ? '#E85C4A' : '#D9A441' }}>
                                        {pc.sin_plan ? 'Sin plan de cuotas' : `${pc.vencida ? 'Vencida' : 'Cobrar'} ${cuotaDateLabel(pc.fecha_vencimiento)}`}
                                    </span>
                                ) : (
                                    <span style={{ color: '#2FBF8F' }}>Al día</span>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-[15px] font-black tabular-nums" style={{ color: it.deuda ? (pc?.vencida ? '#E85C4A' : '#FF3FA4') : '#2FBF8F' }}>
                                    {it.deuda ? money(it.deuda) : '✓'}
                                </div>
                            </div>
                        </div>
                    );
                })}

                {filtered.length > shown.length && (
                    <div
                        onClick={() => setLimit(l => l + 20)}
                        style={{ minWidth: '760px', padding: '15px 22px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.025)' }}
                        className="text-[10px] font-black uppercase tracking-widest"
                    >
                        <span style={{ color: 'rgba(255,255,255,.55)' }}>Ver más · {filtered.length - shown.length} restantes</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MiCarteraPane;
