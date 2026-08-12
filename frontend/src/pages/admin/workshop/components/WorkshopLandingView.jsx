import React, { useState, useEffect, useCallback } from 'react';
import {
    Loader2, Users, PlayCircle, Timer, Target, RefreshCw,
    MonitorSmartphone, Video, MousePointerClick, Radio
} from 'lucide-react';
import api from '../../../../services/api';
import toast from 'react-hot-toast';

/*
 * Panel de la landing de la GRABACIÓN (/replay/).
 *
 * Ojo con no confundir los dos embudos que viven en esta pestaña:
 *   · Workshop en vivo  -> la clase en vivo, fuente 'workshop'
 *   · Workshop landing  -> esta grabación, fuente 'workshop landing'
 * Hasta ahora las agendas de los dos caían en la misma bolsa porque la fuente
 * se detectaba con un substring de 'workshop'.
 */

const fmtDuracion = (segundos) => {
    const s = Math.max(0, Math.round(segundos || 0));
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m < 60) return `${m}m ${String(r).padStart(2, '0')}s`;
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
};

const fmtFecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const ETAPAS = {
    entro: { texto: 'Entró', color: 'bg-slate-800 text-slate-400 border-slate-700' },
    abrio_gate: { texto: 'Abrió el form', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    completo_gate: { texto: 'Se registró', color: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
    dio_play: { texto: 'Dio play', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
    vio_oferta: { texto: 'Vio la oferta', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
    clic_agenda: { texto: 'Clic en agendar', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
};

const Chip = ({ etapa }) => {
    const e = ETAPAS[etapa] || ETAPAS.entro;
    return (
        <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider border whitespace-nowrap ${e.color}`}>
            {e.texto}
        </span>
    );
};

const Kpi = ({ label, value, sub, icon: Icon, colorClass }) => (
    <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-3xl relative overflow-hidden">
        <div className="flex justify-between items-start">
            <div className="space-y-1 min-w-0">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</p>
                <p className="text-2xl md:text-3xl font-black text-white italic tracking-tighter">{value}</p>
                {sub && <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">{sub}</p>}
            </div>
            <div className={`p-3 rounded-2xl bg-slate-950 border border-slate-800 shrink-0 ${colorClass}`}>
                <Icon size={20} />
            </div>
        </div>
    </div>
);

/* Barra del embudo. El ancho es relativo a las VISITAS, no al paso anterior:
   así se ve de un vistazo dónde se cae la gente respecto del total. */
const PasoEmbudo = ({ label, valor, base, pctPaso }) => {
    const ancho = base > 0 ? Math.max(2, (valor / base) * 100) : 0;
    return (
        <div className="space-y-1.5">
            <div className="flex justify-between items-baseline gap-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
                <span className="text-xs font-black text-white tabular-nums">
                    {valor}
                    {pctPaso !== null && <span className="text-slate-500 font-bold ml-2">{pctPaso}%</span>}
                </span>
            </div>
            <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all"
                     style={{ width: `${ancho}%` }} />
            </div>
        </div>
    );
};

const WorkshopLandingView = () => {
    const [stats, setStats] = useState(null);
    const [sesiones, setSesiones] = useState([]);
    const [agendas, setAgendas] = useState(null);
    const [loading, setLoading] = useState(true);
    const [filtro, setFiltro] = useState('todas');   // 'todas' | 'dio_play' | 'sin_registro'
    const [dias, setDias] = useState(30);

    const cargar = useCallback(async () => {
        setLoading(true);
        try {
            const hasta = new Date();
            const desde = new Date(hasta.getTime() - dias * 86400000);
            const rango = `desde=${desde.toISOString().slice(0, 10)}&hasta=${hasta.toISOString().slice(0, 10)}`;
            const etapa = filtro === 'todas' ? '' : `&etapa=${filtro}`;

            const [rStats, rSes, rAg] = await Promise.all([
                api.get(`/workshop/landing/stats?${rango}`),
                api.get(`/workshop/landing/sesiones?${rango}${etapa}`),
                api.get(`/workshop/landing/agendas?${rango}`),
            ]);
            setStats(rStats.data);
            setSesiones(rSes.data || []);
            setAgendas(rAg.data);
        } catch (e) {
            console.error('[landing] Error al cargar', e);
            toast.error('No se pudieron cargar las métricas de la landing');
        } finally {
            setLoading(false);
        }
    }, [dias, filtro]);

    useEffect(() => { cargar(); }, [cargar]);

    if (loading && !stats) {
        return (
            <div className="flex flex-col items-center justify-center py-40 space-y-4">
                <Loader2 size={48} className="animate-spin text-indigo-500" />
                <p className="text-slate-500 font-black uppercase tracking-[0.3em] text-xs">Cargando métricas de la grabación...</p>
            </div>
        );
    }

    const e = stats?.embudo || {};
    const c = stats?.conversion || {};
    const p = stats?.permanencia || {};
    const visitas = e.visitas || 0;

    return (
        <div className="space-y-8">

            {/* Controles */}
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-2xl p-1">
                    {[7, 30, 90].map(d => (
                        <button key={d} onClick={() => setDias(d)}
                            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                                dias === d ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                            {d} días
                        </button>
                    ))}
                </div>
                <button onClick={cargar}
                    className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-white text-[10px] font-black uppercase tracking-widest cursor-pointer">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar
                </button>
                {stats?.rango && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {stats.rango.desde} → {stats.rango.hasta}
                    </span>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <Kpi label="Visitas" value={visitas} sub="sesiones únicas"
                     icon={MonitorSmartphone} colorClass="text-sky-400" />
                <Kpi label="Registrados" value={e.completo_gate || 0}
                     sub={`${c.visita_a_registro || 0}% de las visitas`}
                     icon={Users} colorClass="text-indigo-400" />
                <Kpi label="Dieron play" value={e.dio_play || 0}
                     sub={`${c.registro_a_play || 0}% de los registrados`}
                     icon={PlayCircle} colorClass="text-violet-400" />
                <Kpi label="Permanencia media" value={fmtDuracion(p.mediana_segundos)}
                     sub={`promedio ${fmtDuracion(p.promedio_segundos)}`}
                     icon={Timer} colorClass="text-emerald-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Embudo */}
                <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-5">
                    <div className="flex items-center gap-2">
                        <Target size={16} className="text-indigo-400" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-white">Embudo de la grabación</h3>
                    </div>
                    <div className="space-y-4">
                        <PasoEmbudo label="Entraron" valor={visitas} base={visitas} pctPaso={null} />
                        <PasoEmbudo label="Abrieron el formulario" valor={e.abrio_gate || 0} base={visitas} pctPaso={c.visita_a_gate} />
                        <PasoEmbudo label="Se registraron" valor={e.completo_gate || 0} base={visitas} pctPaso={c.gate_a_registro} />
                        <PasoEmbudo label="Dieron play" valor={e.dio_play || 0} base={visitas} pctPaso={c.registro_a_play} />
                        <PasoEmbudo label="Llegaron a la oferta" valor={e.vio_oferta || 0} base={visitas} pctPaso={c.play_a_oferta} />
                        <PasoEmbudo label="Clic en agendar" valor={e.clic_agenda || 0} base={visitas} pctPaso={c.oferta_a_agenda} />
                    </div>
                    <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider leading-relaxed">
                        El porcentaje es respecto del paso anterior. La barra, respecto del total de visitas.
                    </p>
                </div>

                <div className="space-y-6">
                    {/* Fuente: vivo vs grabación */}
                    <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-4">
                        <div className="flex items-center gap-2">
                            <Radio size={16} className="text-emerald-400" />
                            <h3 className="text-xs font-black uppercase tracking-widest text-white">Agendas por fuente</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Workshop en vivo</p>
                                <p className="text-3xl font-black text-white italic tracking-tighter">{agendas?.workshop_vivo?.total ?? 0}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase">{agendas?.workshop_vivo?.con_closer ?? 0} con closer</p>
                            </div>
                            <div className="bg-slate-950/60 border border-indigo-500/20 rounded-2xl p-4">
                                <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">Workshop landing</p>
                                <p className="text-3xl font-black text-white italic tracking-tighter">{agendas?.workshop_landing?.total ?? 0}</p>
                                <p className="text-[9px] text-slate-500 font-bold uppercase">{agendas?.workshop_landing?.con_closer ?? 0} con closer</p>
                            </div>
                        </div>
                        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider leading-relaxed">
                            Antes las dos caían juntas: la fuente se detectaba buscando "workshop" dentro del texto,
                            así que "workshop landing" también entraba en el vivo.
                        </p>
                    </div>

                    {/* Video + reparto */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Kpi label="Video visto" value={fmtDuracion(p.promedio_video_segundos)}
                             sub="promedio de quienes dieron play" icon={Video} colorClass="text-rose-400" />
                        <Kpi label="Clic en agendar" value={e.clic_agenda || 0}
                             sub={`${c.oferta_a_agenda || 0}% de los que vieron la oferta`}
                             icon={MousePointerClick} colorClass="text-emerald-400" />
                    </div>

                    {(stats?.por_examen?.length > 0) && (
                        <div className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 space-y-3">
                            <h3 className="text-xs font-black uppercase tracking-widest text-white">Registrados por examen</h3>
                            <div className="flex flex-wrap gap-2">
                                {stats.por_examen.map(x => (
                                    <span key={x.examen} className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-300">
                                        {x.examen} <span className="text-indigo-400 ml-1">{x.total}</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Listado */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-3xl overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5 border-b border-slate-800">
                    <h3 className="text-xs font-black uppercase tracking-widest text-white">
                        Personas que entraron ({sesiones.length})
                    </h3>
                    <div className="flex gap-1 bg-slate-950 border border-slate-800 rounded-2xl p-1">
                        {[
                            { k: 'todas', t: 'Todas' },
                            { k: 'dio_play', t: 'Dieron play' },
                            { k: 'sin_registro', t: 'Sin registrarse' },
                        ].map(o => (
                            <button key={o.k} onClick={() => setFiltro(o.k)}
                                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                                    filtro === o.k ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                                {o.t}
                            </button>
                        ))}
                    </div>
                </div>

                {sesiones.length === 0 ? (
                    <div className="py-20 text-center space-y-3">
                        <Users size={40} className="mx-auto text-slate-700" />
                        <p className="text-slate-400 font-black uppercase text-xs">Todavía no hay visitas en este rango</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-slate-800">
                                    <th className="px-5 py-3">Persona</th>
                                    <th className="px-5 py-3">Examen</th>
                                    <th className="px-5 py-3">Etapa</th>
                                    <th className="px-5 py-3 text-right">Permanencia</th>
                                    <th className="px-5 py-3 text-right">Video</th>
                                    <th className="px-5 py-3">Origen</th>
                                    <th className="px-5 py-3">Entró</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-900">
                                {sesiones.map(s => (
                                    <tr key={s.id} className="hover:bg-slate-900/40 transition-colors">
                                        <td className="px-5 py-3">
                                            {s.lead ? (
                                                <span className="text-sm font-bold text-white">{s.lead.full_name}</span>
                                            ) : (
                                                <span className="text-xs font-bold text-slate-600 italic">Sin registrarse</span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-xs font-bold text-slate-400">{s.lead?.examen || '—'}</td>
                                        <td className="px-5 py-3"><Chip etapa={s.etapa} /></td>
                                        <td className="px-5 py-3 text-right text-xs font-black text-white tabular-nums">{fmtDuracion(s.segundos_visible)}</td>
                                        <td className="px-5 py-3 text-right text-xs font-bold text-slate-400 tabular-nums">
                                            {s.dio_play ? fmtDuracion(s.segundos_video) : '—'}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                {s.utm_source || 'directo'}
                                                {s.dispositivo === 'movil' && <span className="ml-1 text-slate-700">· móvil</span>}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-[10px] font-bold text-slate-500 tabular-nums">{fmtFecha(s.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default WorkshopLandingView;
