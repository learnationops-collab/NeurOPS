import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';

// Orden pedido por el usuario (feedback en video, 27/ago/2026): "que aparezca primero cobros,
// luego hot (llamadas tomadas) y luego fríos" — porque sabe que no le va a dar tiempo a todos,
// y prefiere ver primero lo que más plata mueve. El orden de este objeto define tanto las 3
// columnas de "Asignados para hoy" como los 3 botones de "Pool sin fecha" (Object.keys conserva
// el orden de declaración).
const TIPOS = {
    cerrada: { label: 'Cobros (llamadas cerradas)', desc: 'Clientes: cobranza, renovación y upsell', icon: '💰', cls: 'emerald' },
    tomada: { label: 'Llamadas tomadas', desc: 'Asistieron y quedó una decisión o una 2ª llamada', icon: '🎤', cls: 'amber' },
    no_tomada: { label: 'Llamadas no tomadas', desc: 'No shows, cancelaciones y reprogramaciones', icon: '📵', cls: 'rose' }
};

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

// Estado activo del botón de pool — usa el mismo color por tipo que sus chips (rose/amber/emerald)
// para que se note con claridad cuál está seleccionado, en vez de un violeta genérico que casi no
// se distinguía del estado inactivo.
const activePoolBtnCls = {
    rose: 'bg-rose-500/15 border-rose-400 ring-2 ring-rose-500/30',
    amber: 'bg-amber-500/15 border-amber-400 ring-2 ring-amber-500/30',
    emerald: 'bg-emerald-500/15 border-emerald-400 ring-2 ring-emerald-500/30'
};

const cuotaDateLabel = (fechaStr) => {
    if (!fechaStr) return '';
    const d = new Date(`${fechaStr}T00:00:00`);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
};

// Días de retraso del seguimiento (backend `dias_retraso`: días transcurridos desde la fecha en
// que estaba agendado). Distinto de "Call hace Nd", que mide desde la fecha de la llamada.
// Reusa los mismos colores del "cuándo" que las tarjetas de Confirmar/Reportar (late-v6/now-v6/
// soon-v6, ya definidos en index.css) en vez de badges propios, para que las 3 pestañas del mazo
// lean como un solo sistema.
const retrasoWhen = (dias) => {
    if (typeof dias !== 'number') return null;
    if (dias > 0) return { cls: 'late-v6', text: `${dias}d de retraso` };
    if (dias === 0) return { cls: 'now-v6', text: 'Para hoy' };
    return { cls: 'soon-v6', text: `En ${Math.abs(dias)}d` };
};

// Color del cuadro de urgencia (`.time-v6`) según `retrasoWhen(...).cls` — mismo criterio de
// colores que ya usan when-v6/late-v6/now-v6/soon-v6 en el resto del mazo, pero acá se pinta como
// caja llena (como la hora de una fila de Llamadas) en vez de pastilla con punto.
const TIME_BOX_STYLE = {
    'late-v6': { background: 'rgba(232,92,74,.14)', borderColor: 'rgba(232,92,74,.36)', color: '#F5A99C' },
    'now-v6': { background: 'rgba(217,164,65,.14)', borderColor: 'rgba(217,164,65,.36)', color: '#F3D08A' },
    'soon-v6': { background: 'rgba(78,139,216,.14)', borderColor: 'rgba(78,139,216,.36)', color: '#BFD3FF' },
};

// Resultado real de la llamada (`closer_result`) → chip de color, mismo idioma de colores que el
// resto del mazo (ok=verde, w=ámbar, d=rojo, i=azul). Cubre las grafías reales que usa el sistema
// (ver CloserWorkflowPage: 'Show up', 'No show', 'Cancelado'/'Cancelada', 'Reagendado'/
// 'Reagendada', '2da call').
const RESULT_CHIP = {
    'show up': { cls: 'ok', label: 'Show up' },
    'no show': { cls: 'd', label: 'No show' },
    'cancelado': { cls: 'd', label: 'Cancelado' },
    'cancelada': { cls: 'd', label: 'Cancelado' },
    'reagendado': { cls: 'w', label: 'Reagendado' },
    'reagendada': { cls: 'w', label: 'Reagendado' },
    '2da call': { cls: 'i', label: '2ª llamada' },
};
const resultChip = (closerResult) => RESULT_CHIP[(closerResult || '').trim().toLowerCase()] || null;

// Ganancia potencial de un seguimiento: en base a estadísticas REALES de este closer
// (`GET /closer/followups/earnings-stats`) — pedido del usuario (29/ago/2026): "que puedan ver
// cuánto pueden ganar por hacer esos seguimientos". Primera versión ponderaba por una tasa de
// cierre histórica y el usuario la encontró desproporcionada ("por qué la mayoría dice 4101") —
// el número salía inflado por un bug de escala en el backend. En vez de eso, mismo pedido del
// usuario, un modelo más simple y concreto por tipo:
// - "Cobros" (cerrada): NO es un promedio — es lo que el cliente YA debe (próxima cuota, o el
//   total adeudado si nunca se armó un plan). Si no debe nada, el promedio de lo que suelen dejar
//   renovación/upsell en un cliente ya cerrado.
// - "Tomada" (asistió, sin decisión aún): el ticket promedio de una venta real.
// - "No tomada" (no show/cancelado/reagendado): el promedio de lo que se cobra en señas — un
//   valor más chico y realista para un lead frío que ni siquiera tomó la llamada.
const estimateEarning = (item, tipo, earnings) => {
    if (!earnings) return 0;
    const rate = earnings.commission_rate || 0;
    if (tipo === 'cerrada') {
        const debe = item.proxima_cuota ? item.proxima_cuota.monto : (item.deuda || 0);
        const base = debe > 0 ? debe : (earnings.avg_renewal_upsell || 0);
        return rate * base;
    }
    if (tipo === 'no_tomada') return rate * (earnings.avg_seña || 0);
    return rate * (earnings.ticket_promedio || 0);
};

// Fila de seguimiento (`.row-v6`, el mismo lenguaje de lista de una sola columna que ya usa
// Llamadas) — reemplaza la tarjeta chica de Kanban de 3 columnas: el usuario pidió explícitamente
// que esta pestaña "en realidad debe cambiar, debe hacerse distinto" del Kanban de Confirmar/
// Reportar (feedback en video, 28/ago/2026). Se usa tanto en la lista de "Asignados para hoy"
// (una por categoría, apiladas) como en la del pool sin fecha.
//
// Reorganizada (29/ago/2026, pedido del usuario) para escanear de un vistazo: urgencia (retraso)
// a la izquierda en su caja de color de siempre, nombre + contexto (fuente, resultado de la
// agenda, programa/examen, deuda) al centro, y la ganancia potencial de este seguimiento puntual
// bien a la derecha — mismo orden izquierda→derecha que "cuándo → quién → cuánto vale" en vez de
// mezclar todo en una sola fila de chips sin jerarquía.
const SeguimientoRow = ({ item, tipo, earnings, onClick }) => {
    const pc = item.proxima_cuota;
    const when = retrasoWhen(item.dias_retraso);
    const result = resultChip(item.closer_result);
    const potential = estimateEarning(item, tipo, earnings);

    let footer;
    if (tipo === 'cerrada') {
        if (pc) {
            footer = pc.sin_plan
                ? `Debe ${money(pc.monto)} · sin plan de cuotas`
                : `${pc.vencida ? 'Cuota vencida' : 'Cobrar cuota'} ${cuotaDateLabel(pc.fecha_vencimiento)} · ${money(pc.monto)}`;
        } else {
            footer = 'Al día';
        }
    } else {
        footer = item.fecha_seguimiento
            ? `Seguimiento ${item.seguimiento_intento} de 4`
            : 'Asignar fecha';
    }

    return (
        <div className="row-v6" onClick={onClick}>
            <div className="time-v6" style={when ? TIME_BOX_STYLE[when.cls] : undefined}>
                {when ? when.text : '—'}
            </div>
            <div className="rmain-v6">
                <b>{item.lead_name}</b>
                <div className="chips-v6">
                    <span className="chip-v6 src">📍 {item.origin || 'Sin origen'}</span>
                    {result && <span className={`chip-v6 ${result.cls}`}>{result.label}</span>}
                    {tipo !== 'cerrada' && item.seguimiento_sub && (
                        <span className={`chip-v6 ${TIPOS[tipo].cls === 'emerald' ? 'ok' : TIPOS[tipo].cls === 'amber' ? 'w' : ''}`}>
                            {item.seguimiento_sub}
                        </span>
                    )}
                    {(item.days_since_call !== null && item.days_since_call !== undefined) && (
                        <span className="chip-v6">Call hace {item.days_since_call}d</span>
                    )}
                    {tipo === 'cerrada' && item.programa_nombre && (
                        <span className="chip-v6">{item.programa_nombre}</span>
                    )}
                    {tipo === 'cerrada' && typeof item.deuda === 'number' && item.deuda > 0 && (
                        <span className="chip-v6 w">Debe {money(item.deuda)}</span>
                    )}
                    {item.owner_closer_name && (
                        <span className="chip-v6 w">De {item.owner_closer_name} (baja)</span>
                    )}
                    <span className="chip-v6" style={{ color: '#fff', background: 'rgba(255,255,255,.1)' }}>{footer}</span>
                </div>
            </div>
            <div
                className="earn-v6"
                title={
                    tipo === 'cerrada' ? 'Tu comisión sobre lo que se le debe cobrar (o sobre el promedio de renovación/upsell si no debe nada)'
                    : tipo === 'no_tomada' ? 'Tu comisión sobre el promedio de lo que se cobra en señas'
                    : 'Tu comisión sobre el ticket promedio de una venta'
                }
            >
                <span className="earn-lbl-v6">{tipo === 'cerrada' ? 'Podés cobrar' : 'Podrías ganar'}</span>
                <span className="earn-val-v6">{money(potential)}</span>
            </div>
        </div>
    );
};

// Payload del modal de seguimiento — compartido entre el click de una fila (`openLead`) y el
// aviso hacia CloserWorkflowPage de a quién seguir primero (`onTopPending`, ver más abajo) para
// no mantener el mapeo de campos en dos lugares.
const buildLeadPayload = (item, tipo) => ({
    id: item.id,
    client_id: item.client_id,
    lead_name: item.lead_name,
    instagram: item.instagram,
    phone: item.phone,
    examen: item.examen,
    origin: item.origin,
    fase: 'seg',
    tipo,
    seguimiento_intento: item.seguimiento_intento,
    closer_notes: item.closer_notes,
    call_date: item.call_date,
    enrollment_date: item.enrollment_date,
    deuda: item.deuda,
    programa_nombre: item.programa_nombre,
    programa_code: item.programa_code,
    proxima_cuota: item.proxima_cuota
});

// `refreshKey` sube desde CloserWorkflowPage cada vez que una acción toca el mazo (resolver un
// seguimiento, programar el siguiente, registrar una venta...). Sin esa señal, el panel se
// quedaba con la lista vieja y el seguimiento recién hecho solo desaparecía al recargar la página.
// `onTopPending` (opcional): a quién seguir primero, con la misma prioridad que ya usa esta
// pestaña (cobros -> hot -> fríos) — lo consume "Tu siguiente paso" en CloserWorkflowPage para
// mostrar un único botón en vez de una lista de bandejas (pedido del usuario, 28/ago/2026).
const SeguimientosPane = ({ selectedDate, onOpenLead, refreshKey = 0, onTopPending }) => {
    const [grouped, setGrouped] = useState({ no_tomada: [], tomada: [], cerrada: [] });
    const [poolCounts, setPoolCounts] = useState({ no_tomada: 0, tomada: 0, cerrada: 0 });
    const [goal, setGoal] = useState({ hechos: 0, meta: 50, faltan: 50, pct: 0 });
    const [earnings, setEarnings] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openPool, setOpenPool] = useState(null);
    const [poolItems, setPoolItems] = useState([]);
    const [poolLoading, setPoolLoading] = useState(false);
    const [poolFilters, setPoolFilters] = useState({ sub: '', days_since: '', programa: '', deuda: '' });

    // La pantalla completa de "Cargando seguimientos..." solo tiene sentido cuando no hay nada que
    // mostrar todavía (primer render o cambio de día). En una recarga por acción, la lista se
    // reemplaza en silencio para no hacer parpadear el panel entero.
    const loadedDateRef = useRef(null);
    const loadedPoolRef = useRef(null);

    const fetchMain = useCallback(async () => {
        if (loadedDateRef.current !== selectedDate) setLoading(true);
        try {
            const [todayRes, countsRes, goalRes] = await Promise.all([
                api.get(`/closer/followups/today?selected_date=${selectedDate}`),
                api.get('/closer/followups/pool-counts'),
                api.get(`/closer/followups/goal?selected_date=${selectedDate}`)
            ]);
            setGrouped(todayRes.data.grouped);
            setPoolCounts(countsRes.data);
            setGoal(goalRes.data);
        } catch (err) {
            console.error('Error cargando seguimientos', err);
        } finally {
            loadedDateRef.current = selectedDate;
            setLoading(false);
        }
    }, [selectedDate, refreshKey]);

    useEffect(() => { fetchMain(); }, [fetchMain]);

    // Estadísticas para la ganancia potencial (ticket promedio, promedio de señas, promedio de
    // renovación/upsell): no cambian de un minuto a otro como la lista de seguimientos — se piden
    // aparte y se refrescan solo con `refreshKey` (una venta nueva puede moverlas), no con cada
    // cambio de `selectedDate`.
    useEffect(() => {
        api.get('/closer/followups/earnings-stats')
            .then(res => setEarnings(res.data))
            .catch(err => console.error('Error cargando estadísticas de ganancia potencial', err));
    }, [refreshKey]);

    const fetchPool = useCallback(async () => {
        if (!openPool) return;
        const poolSignature = JSON.stringify([openPool, poolFilters]);
        if (loadedPoolRef.current !== poolSignature) setPoolLoading(true);
        try {
            const params = new URLSearchParams({ tipo: openPool });
            if (poolFilters.sub) params.set('sub', poolFilters.sub);
            if (poolFilters.days_since) params.set('days_since', poolFilters.days_since);
            if (openPool === 'cerrada' && poolFilters.programa) params.set('programa', poolFilters.programa);
            if (openPool === 'cerrada' && poolFilters.deuda) params.set('deuda', poolFilters.deuda);
            const res = await api.get(`/closer/followups/pool?${params.toString()}`);
            setPoolItems(res.data.items);
        } catch (err) {
            console.error('Error cargando pool de seguimientos', err);
        } finally {
            loadedPoolRef.current = JSON.stringify([openPool, poolFilters]);
            setPoolLoading(false);
        }
    }, [openPool, poolFilters, refreshKey]);

    useEffect(() => { fetchPool(); }, [fetchPool]);

    // A quién seguir primero, en el mismo orden de prioridad que ya define `TIPOS` (cobros -> hot
    // -> fríos): primero lo asignado para hoy; si ya está todo resuelto, se busca en el pool sin
    // fecha con una consulta liviana (un solo tipo, se usa solo el primer item). Pedido del
    // usuario (28/ago/2026): "que sea uno [un botón] que me lleve a seguir a alguien... como
    // prioridad va a tomar algún cobro" — antes esta pestaña no exponía ningún lead concreto hacia
    // afuera, así que "Tu siguiente paso" no podía ofrecer una sola acción como sí hace con
    // Confirmar/Reportar.
    useEffect(() => {
        if (!onTopPending || loading) return;
        const todayTipo = Object.keys(TIPOS).find(t => grouped[t]?.length > 0);
        if (todayTipo) {
            const item = grouped[todayTipo][0];
            onTopPending({ item, tipo: todayTipo, source: 'today', payload: buildLeadPayload(item, todayTipo) });
            return;
        }
        const poolTipo = Object.keys(TIPOS).find(t => poolCounts[t] > 0);
        if (!poolTipo) {
            onTopPending(null);
            return;
        }
        let cancelled = false;
        api.get(`/closer/followups/pool?tipo=${poolTipo}`)
            .then(res => {
                if (cancelled) return;
                const item = (res.data.items || [])[0];
                onTopPending(item ? { item, tipo: poolTipo, source: 'pool', payload: buildLeadPayload(item, poolTipo) } : null);
            })
            .catch(() => { if (!cancelled) onTopPending(null); });
        return () => { cancelled = true; };
    }, [grouped, poolCounts, loading, onTopPending]);

    const togglePool = (tipo) => {
        setOpenPool(prev => (prev === tipo ? null : tipo));
        setPoolFilters({ sub: '', days_since: '', programa: '', deuda: '' });
    };

    // "Llamadas cerradas" abre el modal de seguimiento de cobro (segventa: deuda, plan de
    // cuotas, "¿qué pasó con el cobro?") — mismo modal que el resto de seguimientos, no el
    // resumen general del cliente (se quitó como destino por defecto).
    const openLead = (item, tipo) => onOpenLead(buildLeadPayload(item, tipo));

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-violet-500" size={32} />
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Cargando seguimientos...</span>
            </div>
        );
    }

    const itemsHoy = [...grouped.no_tomada, ...grouped.tomada, ...grouped.cerrada];
    const totalHoy = itemsHoy.length;
    // Ganancia potencial total de "Asignados para hoy" — suma de la de cada fila (ver
    // `estimateEarning`). "En cada uno y en total", pedido explícito del usuario.
    const totalPotencial = Object.keys(TIPOS).reduce(
        (sum, tipo) => sum + grouped[tipo].reduce((s, item) => s + estimateEarning(item, tipo, earnings), 0),
        0
    );

    return (
        <div className="space-y-6">
            {/* Meta diaria + ganancia potencial del día */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 flex items-center gap-6 flex-wrap">
                <div className="text-4xl font-black text-white">{goal.hechos}<span className="text-lg text-slate-500">/{goal.meta}</span></div>
                <div className="flex-1 min-w-[180px]">
                    <b className="text-sm font-black text-white block">Objetivo de seguimientos del día</b>
                    <span className="text-xs text-slate-400">
                        {goal.faltan > 0 ? `Te faltan ${goal.faltan} para la meta.` : 'Meta cumplida. 🏅'}
                    </span>
                    <div className="h-2 rounded-full bg-slate-900 border border-slate-800 overflow-hidden mt-2">
                        <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all" style={{ width: `${goal.pct}%` }} />
                    </div>
                </div>
                {earnings && totalHoy > 0 && (
                    <div className="text-right pl-6 border-l border-slate-900 shrink-0">
                        <div className="text-[10px] font-black uppercase tracking-widest" style={{ color: '#8C99E0' }}>Ganancia potencial hoy</div>
                        <div className="text-3xl font-black" style={{ color: '#7DEAC0' }}>{money(totalPotencial)}</div>
                    </div>
                )}
            </div>

            {/* Asignados para hoy */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                    <div>
                        <h3 className="text-sm font-black text-white">📅 Asignados para hoy</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Bloquean el reporte hasta que los resuelvas</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-bold bg-slate-900 text-slate-300 border border-slate-800 px-3 py-1 rounded-xl">{totalHoy}</span>
                    </div>
                </div>
                {totalHoy === 0 ? (
                    <div className="text-center py-8 text-emerald-400 text-xs font-bold">✓ Todos los seguimientos de hoy están resueltos.</div>
                ) : (
                    // Lista apilada por categoría (cobros -> hot -> fríos, ya priorizada por el orden
                    // de TIPOS), NO un Kanban de 3 columnas lado a lado — pedido explícito del usuario
                    // (feedback en video, 28/ago/2026): "sigue siendo un Kanban que en realidad debe
                    // cambiar, debe hacerse distinto" del resto del mazo (Confirmar/Reportar SÍ siguen
                    // siendo Kanban, esta pestaña ya no). Título de cada bloque grande y en negrita
                    // ("números grandes, títulos grandes" — mismo pedido de diseño general).
                    <div className="space-y-7">
                        {Object.keys(TIPOS).map((tipo, i) => {
                            const subtotal = grouped[tipo].reduce((s, item) => s + estimateEarning(item, tipo, earnings), 0);
                            return (
                                <div key={tipo}>
                                    <div className="flex items-center gap-3 mb-3">
                                        <span style={{ fontSize: '28px', lineHeight: 1 }}>{TIPOS[tipo].icon}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-white truncate" style={{ fontSize: '17px', fontWeight: 900, letterSpacing: '-0.01em' }}>{TIPOS[tipo].label}</div>
                                            <div className="text-[11px] font-semibold" style={{ color: 'var(--v6-tx3)' }}>{TIPOS[tipo].desc}</div>
                                        </div>
                                        {earnings && grouped[tipo].length > 0 && (
                                            <span className="text-xs font-black" style={{ color: '#7DEAC0' }}>{money(subtotal)}</span>
                                        )}
                                        <span style={{ fontSize: '28px', fontWeight: 900 }} className={grouped[tipo].length === 0 ? 'text-emerald-400' : 'text-white'}>
                                            {grouped[tipo].length}
                                        </span>
                                    </div>
                                    {grouped[tipo].length > 0 ? (
                                        grouped[tipo].map(item => (
                                            <SeguimientoRow key={item.id} item={item} tipo={tipo} earnings={earnings} onClick={() => openLead(item, tipo)} />
                                        ))
                                    ) : (
                                        <div className="text-center py-5 text-emerald-400 text-xs font-bold">✓ Nada pendiente</div>
                                    )}
                                    {i < Object.keys(TIPOS).length - 1 && <div className="mt-7 border-b" style={{ borderColor: 'var(--v6-bd)' }} />}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pool sin fecha */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                    <div>
                        <h3 className="text-sm font-black text-white">📥 Pool sin fecha asignada</h3>
                        <p className="text-xs text-slate-400 font-semibold mt-0.5">Base para elegir a quién seguir</p>
                    </div>
                    <span className="text-xs font-bold bg-slate-900 text-slate-300 border border-slate-800 px-3 py-1 rounded-xl">
                        {poolCounts.no_tomada + poolCounts.tomada + poolCounts.cerrada} disponibles
                    </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.keys(TIPOS).map(tipo => {
                        const isActive = openPool === tipo;
                        return (
                            <button
                                key={tipo}
                                onClick={() => togglePool(tipo)}
                                aria-pressed={isActive}
                                className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                                    isActive ? activePoolBtnCls[TIPOS[tipo].cls] : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                                }`}
                            >
                                <span className="text-xl">{TIPOS[tipo].icon}</span>
                                <div className="flex-1 min-w-0">
                                    <b className={`text-xs font-black block truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{TIPOS[tipo].label}</b>
                                    <span className="text-[11px] text-slate-400 font-semibold">{TIPOS[tipo].desc}</span>
                                </div>
                                <span className={`text-sm font-black ${isActive ? 'text-white' : 'text-slate-300'}`}>{poolCounts[tipo]}</span>
                            </button>
                        );
                    })}
                </div>

                {openPool && (
                    <div className="space-y-3 pt-2">
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={poolFilters.days_since}
                                onChange={(e) => setPoolFilters(prev => ({ ...prev, days_since: e.target.value }))}
                                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                            >
                                <option value="">Fecha de la call: cualquiera</option>
                                <option value="14">Últimos 14 días</option>
                                <option value="30">Entre 15 y 30 días</option>
                                <option value="+30">Más de 30 días</option>
                            </select>
                            {openPool === 'cerrada' && (
                                <>
                                    <select
                                        value={poolFilters.programa}
                                        onChange={(e) => setPoolFilters(prev => ({ ...prev, programa: e.target.value }))}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                                    >
                                        <option value="">Programa: todos</option>
                                        <option value="AL">Ace Learners</option>
                                        <option value="RR">Residency Roadmap</option>
                                        <option value="SI">Specialist Initiative</option>
                                    </select>
                                    <select
                                        value={poolFilters.deuda}
                                        onChange={(e) => setPoolFilters(prev => ({ ...prev, deuda: e.target.value }))}
                                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                                    >
                                        <option value="">Deuda: cualquiera</option>
                                        <option value="con">Con saldo pendiente</option>
                                        <option value="sin">Al día</option>
                                    </select>
                                </>
                            )}
                        </div>

                        {poolLoading ? (
                            <div className="flex justify-center py-8"><Loader2 className="animate-spin text-violet-500" size={24} /></div>
                        ) : poolItems.length === 0 ? (
                            <div className="text-center py-8 text-slate-500 text-xs font-bold uppercase">Sin leads en esta categoría con estos filtros.</div>
                        ) : (
                            <div className="max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                {poolItems.map(item => (
                                    <SeguimientoRow key={item.id} item={item} tipo={openPool} earnings={earnings} onClick={() => openLead(item, openPool)} />
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SeguimientosPane;
