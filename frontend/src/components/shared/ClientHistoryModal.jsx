import { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';
import api from '../../services/api';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

// Resumen de un cliente (agendas, ventas, inscripciones/pagos) en una sola vista — reutilizado
// desde la cola de limpieza y desde la búsqueda global del mazo del closer, para que cualquier
// closer pueda consultar (y confirmar) el historial completo de cualquier cliente sin tener que
// abrir cada agenda por separado.
const ClientHistoryModal = ({ clientId, onClose }) => {
    const [history, setHistory] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/closer/clients/${clientId}/full-history`)
            .then(res => setHistory(res.data))
            .catch(err => console.error('Error al cargar historial del cliente:', err))
            .finally(() => setLoading(false));
    }, [clientId]);

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-[2rem] p-6 space-y-5">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-white uppercase italic tracking-tight">
                        {history?.client?.full_name || 'Historial del cliente'}
                    </h3>
                    <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer"><X size={20} /></button>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
                ) : !history ? (
                    <p className="text-slate-500 text-xs font-bold uppercase">No se pudo cargar el historial.</p>
                ) : (
                    <div className="space-y-5 text-left">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide space-x-3">
                            <span>{history.client.email || 'sin email'}</span>
                            <span>@{history.client.instagram || 'sin ig'}</span>
                            <span>{history.client.phone || 'sin teléfono'}</span>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Agendas ({history.appointments.length})</h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {history.appointments.length === 0 && <p className="text-[10px] text-slate-600">Sin agendas registradas.</p>}
                                {history.appointments.map(a => (
                                    <div key={a.id} className="flex justify-between text-[10px] bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
                                        <span className="text-slate-300">{a.start_time ? new Date(a.start_time).toLocaleDateString('es-ES') : '—'} · {a.origin || 'Sin origen'}</span>
                                        <span className="text-slate-500 font-bold uppercase">{a.closer_result || a.result || 'Pendiente'}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Ventas declaradas ({history.financial_sales.length})</h4>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                {history.financial_sales.length === 0 && <p className="text-[10px] text-slate-600">Sin ventas registradas.</p>}
                                {history.financial_sales.map(s => (
                                    <div key={s.id} className="flex justify-between text-[10px] bg-slate-950/40 border border-slate-800 rounded-lg px-3 py-2">
                                        <span className="text-slate-300">{s.date ? new Date(s.date).toLocaleDateString('es-ES') : '—'} · {s.tipo_pago}</span>
                                        <span className="text-emerald-400 font-bold">{money(s.monto)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Inscripciones y pagos ({history.enrollments.length})</h4>
                            {history.enrollments.length === 0 && <p className="text-[10px] text-slate-600">Sin inscripciones registradas.</p>}
                            {history.enrollments.map(e => (
                                <div key={e.id} className="bg-slate-950/40 border border-slate-800 rounded-xl p-3 mb-2">
                                    <div className="flex justify-between text-[10px] font-bold text-slate-300 mb-1.5">
                                        <span>{e.program || 'Programa desconocido'}</span>
                                        <span>{money(e.total_paid)} de {money(e.program_price)}</span>
                                    </div>
                                    <div className="space-y-1">
                                        {e.payments.map(p => (
                                            <div key={p.id} className="flex justify-between text-[9px] text-slate-500">
                                                <span>{p.payment_type} · {p.status}</span>
                                                <span>{money(p.amount)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ClientHistoryModal;
