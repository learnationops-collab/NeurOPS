import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CopyCheck, Loader2, RotateCcw, CalendarClock, Phone, CheckCircle2, Info } from 'lucide-react';
import api from '../../../services/api';
import Modal from '../../../components/ui/Modal';

// Color por motivo. El orden de lectura importa: primero lo que casi seguro sobra.
const ESTILO_MOTIVO = {
    duplicado_del_webhook: { color: 'rose', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
    reprogramacion: { color: 'amber', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    volvio_a_agendar: { color: 'slate', chip: 'bg-slate-500/15 text-slate-300 border-slate-600/40' }
};

const fecha = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleString('es-BO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
};

/**
 * Panel de agendas repetidas del Tablero de Agendas.
 *
 * Agrupa por identidad (mail, instagram o teléfono normalizados) las agendas del recorte
 * que el usuario está viendo y deja elegir cuál se conserva. La repetida no se borra: se
 * marca, desaparece del libro y del embudo del taller, y se puede devolver desde la
 * pestaña "Descartadas". Por eso la acción no pide confirmación — es reversible entera.
 */
const AgendasDuplicadosModal = ({ filterParams, onClose, onDone }) => {
    const [pestana, setPestana] = useState('pendientes');
    const [datos, setDatos] = useState(null);
    const [descartadas, setDescartadas] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);
    const [conservar, setConservar] = useState({});   // clave de grupo -> id elegido
    const [trabajando, setTrabajando] = useState(null);
    const [cancelarCitas, setCancelarCitas] = useState(true);
    const [hechos, setHechos] = useState(0);

    const cargar = useCallback(async () => {
        setCargando(true);
        setError(null);
        try {
            const res = await api.get('/public/financial-agendas/duplicados', { params: filterParams });
            setDatos(res.data);
            setConservar(Object.fromEntries(res.data.grupos.map(g => [g.clave, g.conservar_sugerida_id])));
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudieron cargar los duplicados.');
        } finally {
            setCargando(false);
        }
    }, [filterParams]);

    useEffect(() => { cargar(); }, [cargar]);

    const cargarDescartadas = useCallback(async () => {
        try {
            const res = await api.get('/public/financial-agendas/duplicados/descartadas');
            setDescartadas(res.data);
        } catch {
            setDescartadas([]);
        }
    }, []);

    useEffect(() => {
        if (pestana === 'descartadas' && descartadas === null) cargarDescartadas();
    }, [pestana, descartadas, cargarDescartadas]);

    const resolver = async (grupo) => {
        const conservadaId = conservar[grupo.clave];
        const descartarIds = grupo.agendas.map(a => a.id).filter(id => id !== conservadaId);
        if (!conservadaId || descartarIds.length === 0) return;

        setTrabajando(grupo.clave);
        setError(null);
        try {
            await api.post('/public/financial-agendas/duplicados/resolver', {
                conservada_id: conservadaId,
                descartar_ids: descartarIds,
                cancelar_citas: cancelarCitas
            });
            setDatos(prev => ({
                ...prev,
                grupos: prev.grupos.filter(g => g.clave !== grupo.clave),
                total_grupos: prev.total_grupos - 1
            }));
            setDescartadas(null);
            setHechos(n => n + descartarIds.length);
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudo guardar.');
        } finally {
            setTrabajando(null);
        }
    };

    const restaurar = async (id) => {
        setTrabajando(`r${id}`);
        try {
            await api.post('/public/financial-agendas/duplicados/restaurar', { agenda_ids: [id] });
            setDescartadas(prev => prev.filter(a => a.id !== id));
            setHechos(n => Math.max(0, n - 1));
            setDatos(null);
        } catch (e) {
            setError(e.response?.data?.error || 'No se pudo restaurar.');
        } finally {
            setTrabajando(null);
        }
    };

    const cerrar = () => {
        if (hechos > 0 && onDone) onDone();
        onClose();
    };

    const grupos = datos?.grupos || [];

    // Cascarón compartido (portal, cabecera y pie fijos, Escape y fondo cierran): el mismo de
    // los demás modales del tablero. Las pestañas van en `barra`, fijas sobre la lista.
    return (
        <Modal
            ancho="4xl"
            titulo="Agendas repetidas"
            subtitulo="El mismo lead agendado más de una vez"
            icono={<CopyCheck size={18} className="text-rose-400" />}
            onCerrar={cerrar}
            cuerpoClassName="space-y-4"
            barra={(
                <div className="flex flex-wrap items-center gap-2">
                    {[
                        ['pendientes', `Por resolver${datos ? ` (${grupos.length})` : ''}`],
                        ['descartadas', 'Descartadas']
                    ].map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setPestana(id)}
                            className={`px-4 py-2 rounded-xl border transition-all cursor-pointer ${
                                pestana === id
                                    ? 'bg-rose-600/20 border-rose-500/40 text-white'
                                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                            }`}
                        >
                            <small className="text-[9px] font-black uppercase tracking-widest">{label}</small>
                        </button>
                    ))}
                </div>
            )}
            pie={(
                <>
                    <small className="mr-auto text-[10px] text-slate-500 font-semibold">
                        {hechos > 0 ? `${hechos} agenda(s) descartadas en esta sesión` : 'Nada descartado todavía'}
                    </small>
                    <button
                        type="button"
                        onClick={cerrar}
                        className="px-6 py-3 bg-slate-800 border border-slate-700 text-slate-300 rounded-xl hover:text-white transition-colors cursor-pointer"
                    >
                        <small className="text-xs font-black uppercase tracking-widest">Cerrar</small>
                    </button>
                </>
            )}
        >
            {error && (
                <p className="text-xs font-bold text-rose-400 bg-rose-500/5 border border-rose-500/20 rounded-xl p-3">{error}</p>
            )}

            {pestana === 'pendientes' && (
                <>
                    {cargando ? (
                        <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
                            <Loader2 size={18} className="animate-spin" /> Buscando repetidas…
                        </div>
                    ) : grupos.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <CheckCircle2 size={28} className="text-emerald-400" />
                            <p className="text-sm font-bold text-slate-300">
                                {hechos > 0 ? 'Listo, no queda nada por resolver.' : 'No hay agendas repetidas en este recorte.'}
                            </p>
                            <small className="text-[10px] text-slate-500 font-semibold">
                                Se busca dentro de los filtros que tenés puestos en el tablero.
                            </small>
                        </div>
                    ) : (
                        <>
                            {datos?.hay_mas && (
                                <p className="text-[11px] text-amber-300/80 font-semibold bg-amber-500/5 border border-amber-500/20 rounded-xl p-3">
                                    Hay más grupos de los que entran acá. Acotá el filtro de fechas del tablero
                                    para revisarlos por tramos.
                                </p>
                            )}

                            <label className="flex items-start gap-3 bg-slate-950 border border-slate-800 rounded-2xl p-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={cancelarCitas}
                                    onChange={(e) => setCancelarCitas(e.target.checked)}
                                    className="mt-0.5 accent-rose-500"
                                />
                                <span className="text-[11px] text-slate-300 font-semibold leading-relaxed">
                                    Cancelar también la llamada de la agenda descartada, para que el closer no la vea dos veces.
                                    <span className="block text-slate-500 font-medium mt-0.5">
                                        Esto no toca Calendly: la invitación del lead se cancela desde ahí.
                                    </span>
                                </span>
                            </label>

                            <AnimatePresence initial={false}>
                                {grupos.map(grupo => {
                                    const estilo = ESTILO_MOTIVO[grupo.motivo] || ESTILO_MOTIVO.volvio_a_agendar;
                                    const elegida = conservar[grupo.clave];
                                    const aDescartar = grupo.agendas.length - 1;
                                    return (
                                        <motion.div
                                            key={grupo.clave}
                                            layout
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
                                            transition={{ duration: 0.18 }}
                                            className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden"
                                        >
                                            <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-slate-800/60">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-white truncate">{grupo.agendas[0].lead}</p>
                                                    <small className="block text-[10px] text-slate-500 font-medium mt-0.5">{grupo.detalle}</small>
                                                </div>
                                                <span className={`shrink-0 px-2.5 py-1 rounded-lg border ${estilo.chip}`}>
                                                    <small className="text-[9px] font-black uppercase tracking-widest">{grupo.etiqueta}</small>
                                                </span>
                                            </div>

                                            <div className="p-3 space-y-2">
                                                {grupo.agendas.map(a => {
                                                    const activa = a.id === elegida;
                                                    return (
                                                        <button
                                                            key={a.id}
                                                            type="button"
                                                            onClick={() => setConservar(p => ({ ...p, [grupo.clave]: a.id }))}
                                                            className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${
                                                                activa
                                                                    ? 'bg-emerald-500/10 border-emerald-500/40'
                                                                    : 'bg-slate-900 border-slate-800 hover:border-slate-700 opacity-70'
                                                            }`}
                                                        >
                                                            <div className="flex items-center justify-between gap-3 flex-wrap">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${activa ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                                                                    <span className="text-xs font-bold text-slate-200">#{a.id}</span>
                                                                    <span className="text-xs text-slate-400 truncate">{a.estado}</span>
                                                                    {a.fuente && (
                                                                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400">
                                                                            <small className="text-[9px] font-black uppercase tracking-widest">{a.fuente}</small>
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <span className={activa ? 'text-emerald-300' : 'text-slate-600'}>
                                                                    <small className="text-[9px] font-black uppercase tracking-widest">
                                                                        {activa ? 'Se conserva' : 'Se descarta'}
                                                                    </small>
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500 font-medium flex-wrap">
                                                                <span className="flex items-center gap-1.5">
                                                                    <CalendarClock size={12} /> Reunión {fecha(a.date)}
                                                                </span>
                                                                <span>Alta {fecha(a.created_at)}</span>
                                                                {a.closer && <span>Closer {a.closer}</span>}
                                                                {a.appointment_id && (
                                                                    <span className="flex items-center gap-1.5">
                                                                        <Phone size={11} /> llamada #{a.appointment_id}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </button>
                                                    );
                                                })}
                                            </div>

                                            <div className="px-3 pb-3 flex items-center justify-between gap-3">
                                                <small className="text-[10px] text-slate-500 font-semibold flex items-center gap-1.5">
                                                    <Info size={11} /> Se puede deshacer desde “Descartadas”.
                                                </small>
                                                <button
                                                    type="button"
                                                    disabled={trabajando === grupo.clave}
                                                    onClick={() => resolver(grupo)}
                                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white rounded-xl transition-colors shadow-lg shadow-rose-600/20 cursor-pointer flex items-center gap-2"
                                                >
                                                    {trabajando === grupo.clave && <Loader2 size={13} className="animate-spin" />}
                                                    <small className="text-[10px] font-black uppercase tracking-widest">
                                                        Descartar {aDescartar}
                                                    </small>
                                                </button>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        </>
                    )}
                </>
            )}

            {pestana === 'descartadas' && (
                descartadas === null ? (
                    <div className="flex items-center justify-center py-16 text-slate-500 gap-3">
                        <Loader2 size={18} className="animate-spin" /> Cargando…
                    </div>
                ) : descartadas.length === 0 ? (
                    <p className="text-center py-16 text-sm text-slate-500 font-semibold">
                        Todavía no se descartó ninguna agenda.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {descartadas.map(a => (
                            <div key={a.id} className="bg-slate-950 border border-slate-800 rounded-2xl p-3 flex items-center justify-between gap-3 flex-wrap">
                                <div className="min-w-0">
                                    <p className="text-xs font-bold text-slate-300 truncate">
                                        #{a.id} · {a.lead}
                                    </p>
                                    <small className="block text-[10px] text-slate-500 font-medium mt-0.5">
                                        Reunión {fecha(a.date)} · se conservó la #{a.duplicada_de_id}
                                        {a.descartada_por ? ` · por ${a.descartada_por}` : ''}
                                    </small>
                                </div>
                                <button
                                    type="button"
                                    disabled={trabajando === `r${a.id}`}
                                    onClick={() => restaurar(a.id)}
                                    className="px-3 py-2 bg-slate-800 border border-slate-700 hover:text-white text-slate-300 rounded-xl transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-40"
                                >
                                    {trabajando === `r${a.id}` ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
                                    <small className="text-[9px] font-black uppercase tracking-widest">Restaurar</small>
                                </button>
                            </div>
                        ))}
                    </div>
                )
            )}
        </Modal>
    );
};

export default AgendasDuplicadosModal;
