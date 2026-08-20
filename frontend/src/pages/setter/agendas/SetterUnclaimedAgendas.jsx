import { useState } from 'react';
import { HelpCircle, Check, X, Instagram, Phone, Mail, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import toast from 'react-hot-toast';

/**
 * Agendas que entraron por setting pero sin saber de qué setter son.
 *
 * Los tres setters comparten el mismo evento de Calendly, así que el webhook solo
 * puede decir 'setting'; el nombre viaja en el formulario. Cuando el formulario no
 * llegó o vino como "No identificado", la agenda queda huérfana y se le pregunta
 * al equipo en vez de dejarla sin atribuir.
 *
 * Solo aparecen las posteriores al ingreso de cada setter, y lo que uno descarta
 * deja de mostrársele a él pero le sigue apareciendo al resto.
 */
const SetterUnclaimedAgendas = ({ agendas, onResuelta }) => {
    const [enviando, setEnviando] = useState(null);

    if (!agendas || agendas.length === 0) return null;

    const responder = async (agenda, accion) => {
        setEnviando(`${agenda.id}-${accion}`);
        try {
            const res = await api.post(`/setter/agendas/${agenda.id}/reclamar`, { accion });
            toast.success(accion === 'mia'
                ? `"${agenda.lead_name}" quedó como tuya`
                : `"${agenda.lead_name}" ya no te aparecerá`);
            onResuelta(agenda.id, res.data);
        } catch (err) {
            console.error('Error al responder por la agenda sin asignar:', err);
            toast.error(err.response?.data?.error || 'No se pudo registrar tu respuesta');
        } finally {
            setEnviando(null);
        }
    };

    const fecha = (iso) => {
        if (!iso) return 'Sin fecha';
        const d = new Date(iso);
        return `${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    };

    return (
        <div className="bg-slate-950 border border-amber-500/40 rounded-[2rem] p-6 space-y-5 shadow-xl">
            <div className="space-y-1">
                <h3 className="text-xs font-black uppercase tracking-widest text-amber-300 flex items-center gap-2">
                    <HelpCircle size={15} />
                    ¿Alguna de estas agendas es tuya? ({agendas.length})
                </h3>
                <p className="text-[11px] text-amber-100/80 font-medium leading-relaxed max-w-3xl">
                    Entraron por un link de setting pero el formulario no dice de quién son. Si la
                    reclamás, queda con tu fuente y tus respuestas del formulario se vinculan a vos.
                    Si no es tuya, deja de aparecerte (les sigue apareciendo a los demás).
                </p>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {agendas.map(a => (
                    <div
                        key={a.id}
                        className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4"
                    >
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-black text-white truncate">{a.lead_name}</span>
                                <span className="px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700 text-[8px] font-black uppercase tracking-widest text-slate-300">
                                    {a.fuente || 'sin fuente'}
                                </span>
                            </div>
                            <p className="text-[10px] font-bold text-amber-300/90 uppercase tracking-wider">
                                Cita: {fecha(a.start_time)}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-medium">
                                {a.instagram && (
                                    <span className="flex items-center gap-1"><Instagram size={10} />@{a.instagram.replace('@', '')}</span>
                                )}
                                {a.phone && <span className="flex items-center gap-1"><Phone size={10} />{a.phone}</span>}
                                {a.mail && <span className="flex items-center gap-1 truncate max-w-[180px]"><Mail size={10} />{a.mail}</span>}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => responder(a, 'mia')}
                                disabled={!!enviando}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 cursor-pointer"
                            >
                                {enviando === `${a.id}-mia` ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                                Es mía
                            </button>
                            <button
                                onClick={() => responder(a, 'no_mia')}
                                disabled={!!enviando}
                                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors disabled:opacity-40 cursor-pointer"
                            >
                                {enviando === `${a.id}-no_mia` ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                                No es mía
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SetterUnclaimedAgendas;
