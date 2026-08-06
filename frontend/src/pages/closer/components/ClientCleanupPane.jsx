import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import api from '../../../services/api';
import ClientHistoryModal from '../../../components/shared/ClientHistoryModal';

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
