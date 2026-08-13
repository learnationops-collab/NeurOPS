import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';

const TIPOS = {
    no_tomada: { label: 'Llamadas no tomadas', desc: 'No shows, cancelaciones y reprogramaciones', icon: '📵', cls: 'rose' },
    tomada: { label: 'Llamadas tomadas', desc: 'Asistieron y quedó una decisión o una 2ª llamada', icon: '🎤', cls: 'amber' },
    cerrada: { label: 'Llamadas cerradas', desc: 'Clientes: cobranza, renovación y upsell', icon: '💰', cls: 'emerald' }
};

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

const chipCls = {
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
};

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
// Se colorea por gravedad para que el closer priorice de un vistazo lo más atrasado.
const retrasoBadge = (dias) => {
    if (typeof dias !== 'number') return null;
    if (dias > 0) {
        const cls = dias >= 7
            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
        return { cls, text: `⏰ ${dias}d de retraso` };
    }
    if (dias === 0) return { cls: 'bg-violet-500/10 text-violet-300 border-violet-500/20', text: 'Para hoy' };
    return { cls: 'bg-slate-900 text-slate-400 border-slate-850', text: `En ${Math.abs(dias)}d` };
};

const SeguimientoRow = ({ item, tipo, onClick }) => {
    const pc = item.proxima_cuota;
    const retraso = retrasoBadge(item.dias_retraso);
    return (
        <div
            onClick={onClick}
            className="p-4 rounded-2xl border border-slate-900/60 bg-black/20 hover:bg-slate-900/50 hover:border-slate-800 transition-all cursor-pointer flex items-center justify-between gap-4"
        >
            <div className="min-w-0 flex-1">
                <b className="text-sm font-black text-white truncate block">{item.lead_name}</b>
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    {retraso && (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${retraso.cls}`}>
                            {retraso.text}
                        </span>
                    )}
                    {tipo !== 'cerrada' && (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${chipCls[TIPOS[tipo].cls]}`}>
                            {item.seguimiento_sub || 'Sin subestado'}
                        </span>
                    )}
                    {item.origin && <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">{item.origin}</span>}
                    {item.owner_closer_name && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            De {item.owner_closer_name} (baja)
                        </span>
                    )}
                    {item.days_since_call !== null && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">
                            Call hace {item.days_since_call}d
                        </span>
                    )}
                    {tipo === 'cerrada' && item.programa_nombre && (
                        <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-slate-900 border border-slate-850 text-slate-400">
                            {item.programa_nombre}
                        </span>
                    )}
                    {tipo === 'cerrada' && typeof item.deuda === 'number' && (
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${item.deuda > 0 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                            {item.deuda > 0 ? `Debe ${money(item.deuda)}` : 'Al día'}
                        </span>
                    )}
                </div>
            </div>
            <div className="shrink-0 text-right">
                {tipo === 'cerrada' ? (
                    pc ? (
                        pc.sin_plan ? (
                            <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">
                                Debe {money(pc.monto)} · sin plan de cuotas
                            </span>
                        ) : (
                            <span className={`text-[9px] font-black uppercase tracking-wider ${pc.vencida ? 'text-rose-400' : 'text-amber-400'}`}>
                                {pc.vencida ? 'Cuota vencida' : 'Cobrar cuota'} {cuotaDateLabel(pc.fecha_vencimiento)} · {money(pc.monto)}
                            </span>
                        )
                    ) : (
                        <span className="text-[9px] font-black uppercase tracking-wider text-emerald-400">Al día</span>
                    )
                ) : item.fecha_seguimiento ? (
                    <span className="text-[9px] font-black uppercase tracking-wider text-violet-400">Seguimiento {item.seguimiento_intento} de 4</span>
                ) : (
                    <span className="text-[9px] font-black uppercase tracking-wider text-amber-400">Asignar fecha</span>
                )}
            </div>
        </div>
    );
};

// `refreshKey` sube desde CloserWorkflowPage cada vez que una acción toca el mazo (resolver un
// seguimiento, programar el siguiente, registrar una venta...). Sin esa señal, el panel se
// quedaba con la lista vieja y el seguimiento recién hecho solo desaparecía al recargar la página.
const SeguimientosPane = ({ selectedDate, onOpenLead, refreshKey = 0 }) => {
    const [grouped, setGrouped] = useState({ no_tomada: [], tomada: [], cerrada: [] });
    const [poolCounts, setPoolCounts] = useState({ no_tomada: 0, tomada: 0, cerrada: 0 });
    const [goal, setGoal] = useState({ hechos: 0, meta: 50, faltan: 50, pct: 0 });
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

    const togglePool = (tipo) => {
        setOpenPool(prev => (prev === tipo ? null : tipo));
        setPoolFilters({ sub: '', days_since: '', programa: '', deuda: '' });
    };

    const openLead = (item, tipo) => {
        // "Llamadas cerradas" abre el modal de seguimiento de cobro (segventa: deuda, plan de
        // cuotas, "¿qué pasó con el cobro?") — mismo modal que el resto de seguimientos, no el
        // resumen general del cliente (se quitó como destino por defecto).
        onOpenLead({
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
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="animate-spin text-violet-500" size={32} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Cargando seguimientos...</span>
            </div>
        );
    }

    const itemsHoy = [...grouped.no_tomada, ...grouped.tomada, ...grouped.cerrada];
    const totalHoy = itemsHoy.length;
    // Cuántos de los seguimientos del día vienen arrastrados de días anteriores, y cuánto es el
    // peor retraso — el resumen que el closer necesita antes de mirar fila por fila.
    const atrasados = itemsHoy.filter(i => typeof i.dias_retraso === 'number' && i.dias_retraso > 0);
    const maxRetraso = atrasados.reduce((max, i) => Math.max(max, i.dias_retraso), 0);

    return (
        <div className="space-y-6">
            {/* Meta diaria */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 flex items-center gap-6">
                <div className="text-4xl font-black text-white">{goal.hechos}<span className="text-lg text-slate-500">/{goal.meta}</span></div>
                <div className="flex-1">
                    <b className="text-sm font-black text-white block">Objetivo de seguimientos del día</b>
                    <span className="text-xs text-slate-400">
                        {goal.faltan > 0 ? `Te faltan ${goal.faltan} para la meta.` : 'Meta cumplida. 🏅'}
                    </span>
                    <div className="h-2 rounded-full bg-slate-900 border border-slate-850 overflow-hidden mt-2">
                        <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-violet-500 transition-all" style={{ width: `${goal.pct}%` }} />
                    </div>
                </div>
            </div>

            {/* Asignados para hoy */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                    <div>
                        <h3 className="text-sm font-black text-white">📅 Asignados para hoy</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Bloquean el reporte hasta que los resuelvas</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {atrasados.length > 0 && (
                            <span className="text-[10px] font-black bg-rose-500/10 text-rose-300 border border-rose-500/25 px-3 py-1 rounded-xl">
                                {atrasados.length} atrasado{atrasados.length === 1 ? '' : 's'} · hasta {maxRetraso}d
                            </span>
                        )}
                        <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">{totalHoy}</span>
                    </div>
                </div>
                {totalHoy === 0 ? (
                    <div className="text-center py-8 text-emerald-400 text-xs font-bold">✓ Todos los seguimientos de hoy están resueltos.</div>
                ) : (
                    Object.keys(TIPOS).map(tipo => grouped[tipo].length > 0 && (
                        <div key={tipo} className="space-y-2">
                            <div className="flex items-center gap-2 pt-2">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{TIPOS[tipo].icon} {TIPOS[tipo].label} · {grouped[tipo].length}</span>
                                <span className="flex-1 h-px bg-slate-900" />
                            </div>
                            {grouped[tipo].map(item => (
                                <SeguimientoRow key={item.id} item={item} tipo={tipo} onClick={() => openLead(item, tipo)} />
                            ))}
                        </div>
                    ))
                )}
            </div>

            {/* Pool sin fecha */}
            <div className="bg-[#111219]/95 border border-slate-900 rounded-[2rem] p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-900 pb-4">
                    <div>
                        <h3 className="text-sm font-black text-white">📥 Pool sin fecha asignada</h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide mt-0.5">Base para elegir a quién seguir</p>
                    </div>
                    <span className="text-[10px] font-black bg-slate-900 text-slate-350 border border-slate-800 px-3 py-1 rounded-xl">
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
                                    isActive ? activePoolBtnCls[TIPOS[tipo].cls] : 'bg-slate-900/60 border-slate-850 hover:border-slate-700'
                                }`}
                            >
                                <span className="text-xl">{TIPOS[tipo].icon}</span>
                                <div className="flex-1 min-w-0">
                                    <b className={`text-xs font-black block truncate ${isActive ? 'text-white' : 'text-slate-300'}`}>{TIPOS[tipo].label}</b>
                                    <span className="text-[9px] text-slate-500 font-bold uppercase">{TIPOS[tipo].desc}</span>
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
                                className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
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
                                        className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
                                    >
                                        <option value="">Programa: todos</option>
                                        <option value="AL">Ace Learners</option>
                                        <option value="RR">Residency Roadmap</option>
                                        <option value="SI">Specialist Initiative</option>
                                    </select>
                                    <select
                                        value={poolFilters.deuda}
                                        onChange={(e) => setPoolFilters(prev => ({ ...prev, deuda: e.target.value }))}
                                        className="bg-slate-950 border border-slate-850 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300"
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
                            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1 custom-scrollbar">
                                {poolItems.map(item => (
                                    <SeguimientoRow key={item.id} item={item} tipo={openPool} onClick={() => openLead(item, openPool)} />
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
