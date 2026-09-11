import { useState, useEffect, useCallback, useMemo } from 'react';
import { Loader2, Search, CalendarRange, CopyX, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../services/api';
import { parseUtcIso, toLocalDateStr, localToday, viewerTimezoneLabel } from '../../../utils/datetime';

// Estados en los que una agenda todavía no tiene un resultado real cargado — los únicos que
// se pueden marcar como "duplicada" (ver ESTADOS_SIN_REPORTAR abajo y `marcar-duplicada` en
// el backend). Nunca se ofrece esta acción sobre una llamada que sí ocurrió.
const ESTADOS_SIN_REPORTAR = new Set(['por_confirmar', 'confirmada', 'sin_reportar']);

// Ventana para considerar dos agendas del mismo cliente "la misma cita duplicada" — igual que
// la que usa el backend (`marcar_agenda_duplicada`) para no divergir en qué cuenta como cerca.
const VENTANA_DUPLICADO_MS = 6 * 60 * 60 * 1000;

// Mismos ids y etiquetas que los filtros de "Ver mis datos" (PerformanceFilters.jsx) a propósito:
// "Este mes" tiene que significar exactamente lo mismo en las dos pestañas para que el closer
// pueda cruzar los números. 'proximas' y 'todo' son extra de acá: el dashboard mide el rendimiento
// de un período cerrado, esta lista también sirve para ver lo que viene y el total histórico.
const PERIODS = [
    { key: 'hoy', label: 'Hoy' },
    { key: 'ayer', label: 'Ayer' },
    { key: '7d', label: '7 días' },
    { key: '30d', label: '30 días' },
    { key: 'mes', label: 'Este mes' },
    { key: 'mes_pasado', label: 'Mes pasado' },
    { key: '90', label: '90 días' },
    { key: 'proximas', label: 'Próximas' },
    { key: 'todo', label: 'Todo' },
    { key: 'custom', label: 'Personalizado' },
];

const VENTA_FILTERS = [
    { key: 'todas', label: 'Todas' },
    { key: 'con_venta', label: 'Con venta' },
    { key: 'sin_venta', label: 'Sin venta' },
];

const SORTS = [
    { key: 'reciente', label: 'Más reciente' },
    { key: 'antigua', label: 'Más antigua' },
];

// Etapa de confirmación (`Appointment.result`) tal como la escriben el closer, el Call Confirmer
// o el flujo de 2da llamada — se traduce a algo legible sin perder el valor crudo desconocido.
const CONFIRMACION_LABELS = {
    por_confirmar: 'Por confirmar',
    conversando: 'Conversando',
    confirmado: 'Confirmado',
    pendiente: 'Pendiente',
    agendado: 'Agendado',
    contactado: 'Contactado',
    'sin respuesta': 'Sin respuesta',
    '2th call': '2da llamada',
    '2da call': '2da llamada',
    cancelado: 'Cancelado',
    reagendado: 'Reagendado',
};
const confirmacionLabel = (raw) => {
    const key = (raw || '').trim().toLowerCase();
    if (!key) return '—';
    return CONFIRMACION_LABELS[key] || raw;
};

const mesEnCurso = () => {
    const hoy = new Date();
    return { start: toLocalDateStr(new Date(hoy.getFullYear(), hoy.getMonth(), 1)), end: localToday() };
};

const fmtDia = (d) => d.toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: 'short' });
const fmtHora = (d) => d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const fmtRango = (iso) => {
    if (!iso) return null;
    return new Date(`${iso}T00:00:00`).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
};

const chip = (active, color) => (active
    ? { background: 'rgba(255,255,255,.09)', border: `1px solid ${color || 'rgba(255,255,255,.32)'}`, color: color || '#fff' }
    : { background: 'transparent', border: '1px solid var(--v6-bd)', color: 'rgba(255,255,255,.5)' });

const GRID = 'minmax(150px,1.4fr) 96px minmax(120px,1fr) 130px 140px 110px';
const MIN_W = '980px';

// "Mi cartera → Agendas": TODAS las agendas del closer en el período, con su estado, para que
// pueda corroborar cuántas tiene y en qué quedó cada una (pedido del usuario, 9/sep/2026). No es
// una bandeja de trabajo: no oculta lo ya resuelto. Todo el filtrado fino (texto, estado, venta)
// es local sobre lo que trajo `GET /closer/cartera/agendas`; solo cambiar el período vuelve a
// pedir al backend.
const CarteraAgendasPane = ({ onOpenLead }) => {
    const [items, setItems] = useState([]);
    const [estados, setEstados] = useState([]);
    const [counts, setCounts] = useState(null);
    const [rango, setRango] = useState(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('mes');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });
    const [q, setQ] = useState('');
    const [estado, setEstado] = useState('todos');
    const [venta, setVenta] = useState('todas');
    const [sort, setSort] = useState('reciente');
    const [limit, setLimit] = useState(30);
    const [resolvingId, setResolvingId] = useState(null);

    const fetchItems = useCallback(async () => {
        if (period === 'custom' && !(customRange.start && customRange.end)) return;
        setLoading(true);
        try {
            const params = { period };
            if (period === 'custom') {
                params.start_date = customRange.start;
                params.end_date = customRange.end;
            }
            const res = await api.get('/closer/cartera/agendas', { params });
            setItems(res.data?.items || []);
            setEstados(res.data?.estados || []);
            setCounts(res.data?.counts || null);
            setRango(res.data?.rango || null);
        } catch (err) {
            console.error('Error cargando las agendas de la cartera', err);
        } finally {
            setLoading(false);
        }
    }, [period, customRange]);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    const onPeriodClick = (key) => {
        setPeriod(key);
        setLimit(30);
        if (key === 'custom' && !(customRange.start && customRange.end)) setCustomRange(mesEnCurso());
    };

    const estadoInfo = useMemo(() => Object.fromEntries(estados.map(e => [e.key, e])), [estados]);

    // Posibles duplicados: misma cita cargada dos veces (visto en producción con Nerina / "Mia
    // Sky", 10/sep/2026 — puede pasar cuando una sincronización se procesa dos veces). Solo se
    // marca la fila como "posible duplicado" si TODAVÍA no tiene un resultado real reportado
    // (`ESTADOS_SIN_REPORTAR`) y existe otra cita del mismo cliente a menos de 6h — misma
    // ventana que valida el backend en `marcar-duplicada`, para no ofrecer la acción donde el
    // backend la va a rechazar igual.
    const duplicateOf = useMemo(() => {
        const map = {};
        items.forEach(a => {
            if (!a.client_id || !ESTADOS_SIN_REPORTAR.has(a.estado)) return;
            const tA = parseUtcIso(a.start_time)?.getTime();
            if (!tA) return;
            const hermana = items.find(b => {
                if (b.id === a.id || b.client_id !== a.client_id) return false;
                const tB = parseUtcIso(b.start_time)?.getTime();
                return tB && Math.abs(tB - tA) <= VENTANA_DUPLICADO_MS;
            });
            if (hermana) map[a.id] = hermana;
        });
        return map;
    }, [items]);

    const marcarDuplicada = async (it, e) => {
        e.stopPropagation();
        if (resolvingId) return;
        const hermana = duplicateOf[it.id];
        if (!window.confirm(
            `¿Marcar esta agenda de ${it.lead_name} como duplicada y cancelarla?\n\n` +
            `Se conserva la otra cita de este cliente (${hermana ? new Date(hermana.start_time).toLocaleString() : 'agenda cercana'}).`
        )) return;
        setResolvingId(it.id);
        try {
            await api.post(`/closer/cartera/agendas/${it.id}/marcar-duplicada`);
            toast.success('Agenda marcada como duplicada y cancelada');
            fetchItems();
        } catch (err) {
            toast.error(err.response?.data?.message || 'No se pudo marcar la agenda como duplicada');
        } finally {
            setResolvingId(null);
        }
    };

    // Eliminar de verdad una agenda cancelada (pedido del usuario, 10/sep/2026: una cancelación
    // — sobre todo una duplicada — "no fue una agenda" y no debería quedar dando vueltas en el
    // registro). Reusa DELETE /closer/deck/<id>, el mismo endpoint que ya usa "Descartar lead"
    // desde el modal de confirmación — no es una acción nueva, solo un segundo lugar desde
    // donde llamarla. Solo se ofrece sobre agendas YA canceladas: el endpoint en sí no exige
    // ningún estado (borra cualquier cita del closer), así que la restricción es a propósito
    // acá, para que esta lista de auditoría nunca pueda borrar un resultado real (show up, no
    // show, etc.) — solo lo que ya no cuenta como una agenda real.
    const eliminarAgenda = async (it, e) => {
        e.stopPropagation();
        if (resolvingId) return;
        const fecha = parseUtcIso(it.start_time);
        if (!window.confirm(
            `¿Eliminar definitivamente la agenda de ${it.lead_name}` +
            `${fecha ? ` del ${fmtDia(fecha)}` : ''}?\n\n` +
            `Esta acción no se puede deshacer.`
        )) return;
        setResolvingId(it.id);
        try {
            await api.delete(`/closer/deck/${it.id}`);
            toast.success('Agenda eliminada');
            fetchItems();
        } catch (err) {
            toast.error(err.response?.data?.message || err.response?.data?.error || 'No se pudo eliminar la agenda');
        } finally {
            setResolvingId(null);
        }
    };

    const filtered = useMemo(() => {
        const query = q.trim().toLowerCase();
        const list = items.filter(it => {
            if (query) {
                const hay = `${it.lead_name} ${it.instagram} ${it.email} ${it.phone}`.toLowerCase();
                if (!hay.includes(query)) return false;
            }
            if (estado !== 'todos' && it.estado !== estado) return false;
            if (venta === 'con_venta' && !it.venta) return false;
            if (venta === 'sin_venta' && it.venta) return false;
            return true;
        });
        list.sort((a, b) => {
            const cmp = (a.start_time || '').localeCompare(b.start_time || '');
            return sort === 'antigua' ? cmp : -cmp;
        });
        return list;
    }, [items, q, estado, venta, sort]);

    const shown = filtered.slice(0, limit);

    // Agrupado por día LOCAL del que mira (misma regla que el resto del workspace: el instante
    // UTC del backend se pinta en el reloj del navegador). El total por día es sobre la lista
    // filtrada, que es lo que se está viendo.
    const porDia = useMemo(() => {
        const acc = {};
        filtered.forEach(it => {
            const d = parseUtcIso(it.start_time);
            const key = d ? toLocalDateStr(d) : 'sin-fecha';
            acc[key] = (acc[key] || 0) + 1;
        });
        return acc;
    }, [filtered]);

    const openRow = (it) => {
        onOpenLead({
            id: it.id,
            client_id: it.client_id,
            lead_name: it.lead_name,
            instagram: it.instagram,
            phone: it.phone,
            email: it.email,
            start_time: it.start_time,
            origin: it.origin,
            setter_name: it.setter_name,
            examen: it.examen,
            result: it.result,
            closer_result: it.closer_result,
            closer_notes: it.closer_notes,
            fecha_seguimiento: it.fecha_seguimiento,
            seguimiento_tipo: it.seguimiento_tipo,
            fase: it.fase,
            tipo: it.tipo,
        });
    };

    const porEstado = counts?.por_estado || {};
    const sinResultado = (porEstado.por_confirmar || 0) + (porEstado.confirmada || 0) + (porEstado.sin_reportar || 0);
    const tzLabel = viewerTimezoneLabel();

    let lastDay = null;

    return (
        <div className="space-y-5">
            {/* Período: la única cosa que vuelve a pedir datos al backend */}
            <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1 p-1 rounded-full flex-wrap" style={{ background: 'rgba(255,255,255,.05)', border: '1px solid var(--v6-bd)' }}>
                    {PERIODS.map(p => (
                        <button
                            key={p.key}
                            type="button"
                            onClick={() => onPeriodClick(p.key)}
                            className="px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                            style={period === p.key
                                ? { background: 'var(--v6-gradb)', color: '#fff' }
                                : { background: 'transparent', color: 'rgba(255,255,255,.5)' }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {period === 'custom' && (
                    <div className="flex items-center gap-2 h-11 px-4 rounded-full" style={{ background: 'rgba(255,255,255,.045)', border: '1px solid rgba(255,63,164,.4)' }}>
                        <CalendarRange size={14} style={{ color: 'var(--v6-pink)' }} />
                        <input
                            type="date"
                            value={customRange.start}
                            max={customRange.end || undefined}
                            onChange={(e) => setCustomRange(r => ({ ...r, start: e.target.value }))}
                            className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                        />
                        <span className="text-xs" style={{ color: 'rgba(255,255,255,.4)' }}>–</span>
                        <input
                            type="date"
                            value={customRange.end}
                            min={customRange.start || undefined}
                            onChange={(e) => setCustomRange(r => ({ ...r, end: e.target.value }))}
                            className="bg-transparent text-xs font-bold text-white outline-none cursor-pointer"
                        />
                    </div>
                )}
                {rango && (
                    <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,.4)' }}>
                        {rango.start && rango.end
                            ? `Del ${fmtRango(rango.start)} al ${fmtRango(rango.end)}`
                            : rango.start ? `Desde el ${fmtRango(rango.start)}` : 'Todas las agendas registradas'}
                        {tzLabel ? ` · horas en tu reloj (${tzLabel})` : ''}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <Loader2 className="animate-spin text-pink-500" size={32} />
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando tus agendas...</span>
                </div>
            ) : (
                <>
                    {/* KPIs: totales que el closer necesita corroborar de un vistazo */}
                    <div className="rpt-kpis-v6">
                        {[
                            { label: 'Agendas en el período', value: counts?.total || 0, color: '#4E8BD8' },
                            { label: 'Todavía sin resultado', value: sinResultado, color: '#D9A441' },
                            { label: 'Asistieron (show up)', value: porEstado.show_up || 0, color: '#2FBF8F' },
                            { label: 'Con venta propia', value: counts?.venta_propia || 0, color: '#FF3FA4' },
                        ].map(k => (
                            <div key={k.label} className="rpt-kpi-v6">
                                <b style={{ color: k.color, fontSize: '28px' }}>{k.value}</b>
                                <span>{k.label}</span>
                            </div>
                        ))}
                    </div>

                    {/* Estado: un chip por estado con su total, clic filtra */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => { setEstado('todos'); setLimit(30); }}
                            className="px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                            style={chip(estado === 'todos')}
                        >
                            Todos · {counts?.total || 0}
                        </button>
                        {estados.filter(e => (porEstado[e.key] || 0) > 0 || e.key !== 'otro').map(e => (
                            <button
                                key={e.key}
                                type="button"
                                title={e.desc}
                                onClick={() => { setEstado(estado === e.key ? 'todos' : e.key); setLimit(30); }}
                                className="px-3.5 py-2 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1.5"
                                style={chip(estado === e.key, e.color)}
                            >
                                <span style={{ width: 7, height: 7, borderRadius: 99, background: e.color, display: 'inline-block' }} />
                                {e.label} · {porEstado[e.key] || 0}
                            </button>
                        ))}
                    </div>

                    {/* Búsqueda + venta + orden */}
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex-1 min-w-[240px] flex items-center gap-2.5 px-4 h-11 rounded-full" style={{ background: 'rgba(255,255,255,.045)', border: '1px solid var(--v6-bd)' }}>
                            <Search size={15} style={{ color: 'rgba(255,255,255,.42)' }} />
                            <input
                                value={q}
                                onChange={(e) => { setQ(e.target.value); setLimit(30); }}
                                placeholder="Buscar por nombre, instagram, mail o teléfono..."
                                className="flex-1 bg-transparent border-none text-white text-sm font-semibold outline-none"
                            />
                            {q && (
                                <button type="button" onClick={() => setQ('')} className="text-[10px] font-black uppercase cursor-pointer" style={{ color: 'var(--v6-pink)' }}>
                                    Limpiar
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: 'rgba(255,255,255,.32)' }}>Venta</span>
                            {VENTA_FILTERS.map(f => (
                                <button
                                    key={f.key}
                                    type="button"
                                    onClick={() => { setVenta(f.key); setLimit(30); }}
                                    className="px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all"
                                    style={chip(venta === f.key)}
                                >
                                    {f.label}
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
                                    style={chip(sort === s.key)}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Tabla agrupada por día */}
                    <div className="rounded-2xl overflow-x-auto" style={{ background: 'rgba(255,255,255,.018)', border: '1px solid var(--v6-bd)' }}>
                        <div style={{ minWidth: MIN_W, display: 'grid', gridTemplateColumns: GRID, gap: '10px', alignItems: 'center', padding: '13px 20px', background: 'rgba(255,255,255,.035)', borderBottom: '1px solid var(--v6-bd)' }}>
                            {['Cliente', 'Hora', 'Origen / Setter', 'Confirmación', 'Estado', 'Venta'].map((h, i) => (
                                <span key={h} className={`text-[9px] font-black uppercase tracking-widest ${i === 5 ? 'text-right' : ''}`} style={{ color: 'rgba(255,255,255,.38)' }}>{h}</span>
                            ))}
                        </div>

                        {shown.length === 0 ? (
                            <div style={{ minWidth: MIN_W, padding: '56px 22px', textAlign: 'center' }}>
                                <div className="text-sm font-black" style={{ color: 'rgba(255,255,255,.55)' }}>
                                    {items.length === 0 ? 'No tenés agendas en este período' : 'Sin resultados'}
                                </div>
                                <div className="text-xs font-semibold mt-1.5" style={{ color: 'rgba(255,255,255,.34)' }}>
                                    {items.length === 0 ? 'Probá con otro período.' : 'Probá con otro nombre o quitá los filtros.'}
                                </div>
                            </div>
                        ) : shown.map(it => {
                            const d = parseUtcIso(it.start_time);
                            const dayKey = d ? toLocalDateStr(d) : 'sin-fecha';
                            const showHeader = dayKey !== lastDay;
                            lastDay = dayKey;
                            const info = estadoInfo[it.estado] || {};
                            const color = info.color || 'rgba(255,255,255,.5)';
                            return (
                                <div key={it.id}>
                                    {showHeader && (
                                        <div style={{ minWidth: MIN_W, padding: '9px 20px', background: 'rgba(255,255,255,.025)', borderBottom: '1px solid rgba(255,255,255,.055)' }} className="flex items-center gap-2">
                                            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'rgba(255,255,255,.6)' }}>
                                                {d ? fmtDia(d) : 'Sin fecha'}
                                            </span>
                                            <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,.35)' }}>
                                                · {porDia[dayKey]} agenda{porDia[dayKey] === 1 ? '' : 's'}
                                            </span>
                                        </div>
                                    )}
                                    <div
                                        onClick={() => openRow(it)}
                                        className="kcard-v6"
                                        style={{
                                            minWidth: MIN_W, display: 'grid', gridTemplateColumns: GRID,
                                            gap: '10px', alignItems: 'center', padding: '13px 20px', borderRadius: 0,
                                            borderBottom: '1px solid rgba(255,255,255,.055)', position: 'relative', animation: 'none'
                                        }}
                                    >
                                        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: color }}></div>
                                        <div className="min-w-0">
                                            <div className="text-[13px] font-extrabold truncate flex items-center gap-1.5">
                                                <span className="truncate">{it.lead_name}</span>
                                                {it.is_rescheduled && (
                                                    <span title="Esta agenda nació de una reagenda" className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded" style={{ background: 'rgba(139,92,246,.18)', color: '#C4B5FD', flexShrink: 0 }}>↻ reag.</span>
                                                )}
                                            </div>
                                            <div className="text-[10px] font-semibold mt-0.5 truncate" style={{ color: 'rgba(255,255,255,.34)' }}>
                                                {it.instagram ? `@${it.instagram.replace('@', '')}` : (it.email || it.phone || '—')}
                                            </div>
                                        </div>
                                        <div className="text-[13px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,.8)' }}>
                                            {d ? fmtHora(d) : '—'}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="text-[11px] font-bold truncate" style={{ color: 'rgba(255,255,255,.6)' }}>{it.origin || '—'}</div>
                                            <div className="text-[10px] font-semibold truncate" style={{ color: 'rgba(255,255,255,.34)' }}>{it.setter_name || 'Sin setter'}</div>
                                        </div>
                                        <div className="text-[10.5px] font-bold" style={{ color: 'rgba(255,255,255,.55)' }}>
                                            {confirmacionLabel(it.result)}
                                        </div>
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span style={{ width: 8, height: 8, borderRadius: 99, background: color, flexShrink: 0 }} />
                                            <span className="text-[10.5px] font-black uppercase tracking-wide truncate" style={{ color }} title={it.estado === 'otro' ? it.closer_result : info.desc}>
                                                {it.estado === 'otro' ? (it.closer_result || 'Otro') : it.estado_label}
                                            </span>
                                        </div>
                                        <div className="text-right text-[10.5px] font-black">
                                            {it.venta_propia ? (
                                                <span style={{ color: '#FF3FA4' }}>💰 Sí</span>
                                            ) : it.venta ? (
                                                <span title="El cliente compró, pero la venta la reportó otro closer" style={{ color: 'rgba(255,255,255,.45)' }}>Otro closer</span>
                                            ) : (
                                                <span style={{ color: 'rgba(255,255,255,.2)' }}>—</span>
                                            )}
                                        </div>
                                    </div>
                                    {duplicateOf[it.id] && (
                                        <div
                                            style={{ minWidth: MIN_W, padding: '8px 20px 8px 24px', background: 'rgba(249,115,22,.07)', borderBottom: '1px solid rgba(255,255,255,.055)' }}
                                            className="flex items-center justify-between gap-3 flex-wrap"
                                        >
                                            <span className="text-[10px] font-bold flex items-center gap-1.5" style={{ color: '#F97316' }}>
                                                <CopyX size={12} /> Posible duplicado de la cita de {fmtHora(parseUtcIso(duplicateOf[it.id].start_time))} — no tiene resultado reportado
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => marcarDuplicada(it, e)}
                                                disabled={resolvingId === it.id}
                                                className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50"
                                                style={{ background: 'rgba(249,115,22,.15)', border: '1px solid rgba(249,115,22,.4)', color: '#FDBA74' }}
                                            >
                                                {resolvingId === it.id ? 'Cancelando…' : 'Marcar como duplicada'}
                                            </button>
                                        </div>
                                    )}
                                    {it.estado === 'cancelada' && (
                                        <div
                                            style={{ minWidth: MIN_W, padding: '8px 20px 8px 24px', background: 'rgba(255,255,255,.02)', borderBottom: '1px solid rgba(255,255,255,.055)' }}
                                            className="flex items-center justify-between gap-3 flex-wrap"
                                        >
                                            <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,.4)' }}>
                                                Cancelada — si no debería figurar (ej. una agenda duplicada), se puede eliminar del registro.
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => eliminarAgenda(it, e)}
                                                disabled={resolvingId === it.id}
                                                className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5"
                                                style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.4)', color: '#FCA5A5' }}
                                            >
                                                <Trash2 size={11} /> {resolvingId === it.id ? 'Eliminando…' : 'Eliminar agenda'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {filtered.length > shown.length && (
                            <div
                                onClick={() => setLimit(l => l + 30)}
                                style={{ minWidth: MIN_W, padding: '15px 22px', textAlign: 'center', cursor: 'pointer', background: 'rgba(255,255,255,.025)' }}
                                className="text-[10px] font-black uppercase tracking-widest"
                            >
                                <span style={{ color: 'rgba(255,255,255,.55)' }}>Ver más · {filtered.length - shown.length} restantes</span>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default CarteraAgendasPane;
