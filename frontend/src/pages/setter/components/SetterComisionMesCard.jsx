import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import api from '../../../services/api';

const money = (n) => '$' + Math.round(n || 0).toLocaleString('en-US');

// Comisión del mes en curso, visible en el espacio de trabajo del setter (pedido del usuario,
// 10/sep/2026: "que los closers y los setters puedan ver cuanto van ganando de comision del
// mes"). Se auto-contiene y se fetchea sola — ver `CommissionService` en el backend para de
// dónde sale el %.
const SetterComisionMesCard = () => {
    const [data, setData] = useState(null);

    useEffect(() => {
        let vivo = true;
        api.get('/setter/commission')
            .then(res => { if (vivo) setData(res.data); })
            .catch(() => {});
        return () => { vivo = false; };
    }, []);

    if (!data) return null;

    return (
        <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                    <DollarSign size={18} className="text-violet-400" />
                </div>
                <div className="min-w-0">
                    <div className="text-[10.5px] font-black uppercase tracking-[.22em] text-slate-500">
                        Comisión de este mes
                    </div>
                    <div className="text-[11px] font-semibold text-slate-400 mt-0.5">
                        {Math.round(data.rate * 100)}% de {money(data.cash_neto)} cobrados netos
                    </div>
                </div>
            </div>
            <div className="text-3xl font-black text-emerald-400 tracking-tight flex-shrink-0">
                {money(data.commission)}
            </div>
        </div>
    );
};

export default SetterComisionMesCard;
