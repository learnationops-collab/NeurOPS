import { useState, useEffect, useCallback } from 'react';
import { Loader2, X } from 'lucide-react';
import api from '../../../services/api';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

const SEVERITY_CLS = {
    3: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    2: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    1: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const CleanupRow = ({ item, onClick }) => (
    <div
        onClick={onClick}
        className="p-4 rounded-2xl border border-slate-900/60 bg-black/20 hover:bg-slate-900/50 hover:border-slate-800 transition-all cursor-pointer flex items-center justify-between gap-4"
    >
        <div className="min-w-0 flex-1">
            <b className="text-sm font-black text-white truncate block">{item.client_name}</b>
            <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${SEVERITY_CLS[item.severity] || SEVERITY_CLS[1]}`}>
                    {item.reason}
                </span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium mt-1.5 truncate">{item.detail}</p>
        </div>
    </div>
);

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

const ClientCleanupPane = () => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClientId, setSelectedClientId] = useState(null);

    const fetchQueue = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/closer/cleanup-queue');
            setItems(res.data || []);
        } catch (err) {
            console.error('Error al cargar la cola de limpieza:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchQueue(); }, [fetchQueue]);

    return (
        <div className="space-y-6 text-left">
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">🧹 Cola de limpieza diaria</h3>
                <p className="text-xs text-slate-400 mt-1.5">
                    Clientes cuyo registro de agendas o pagos tiene algo que revisar — no significa que hiciste algo mal, la mayoría viene de datos históricos. Andá cliente por cliente confirmando que todo esté en orden.
                </p>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="animate-spin text-violet-400" size={28} /></div>
            ) : items.length === 0 ? (
                <div className="text-center py-16 text-slate-500 text-xs font-bold uppercase tracking-wide">
                    👏 No hay nada pendiente de revisar hoy.
                </div>
            ) : (
                <div className="space-y-3">
                    {items.map(it => (
                        <CleanupRow key={it.client_id} item={it} onClick={() => setSelectedClientId(it.client_id)} />
                    ))}
                </div>
            )}

            {selectedClientId && (
                <ClientHistoryModal clientId={selectedClientId} onClose={() => setSelectedClientId(null)} />
            )}
        </div>
    );
};

export default ClientCleanupPane;
