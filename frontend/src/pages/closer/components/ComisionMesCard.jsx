import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import api from '../../../services/api';
import { money } from '../dashboard/performanceUtils';

// Comisión del mes en curso, visible en el espacio de trabajo del closer (pedido del usuario,
// 10/sep/2026: "que los closers y los setters puedan ver cuanto van ganando de comision del
// mes"). Se auto-contiene y se fetchea sola (no depende de ningún estado de CloserWorkflowPage,
// que ya es enorme) — ver `CommissionService` en el backend para de dónde sale el %.
const ComisionMesCard = () => {
    const [data, setData] = useState(null);

    useEffect(() => {
        let vivo = true;
        api.get('/closer/commission')
            .then(res => { if (vivo) setData(res.data); })
            .catch(() => {});
        return () => { vivo = false; };
    }, []);

    if (!data) return null;

    return (
        <div
            className="flex items-center justify-between gap-4 flex-wrap"
            style={{
                border: '1px solid var(--v6-bd)', borderRadius: 20, background: 'var(--v6-card)',
                padding: '18px 24px', marginBottom: 20,
            }}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div style={{
                    width: 40, height: 40, borderRadius: 99, background: 'rgba(47,191,143,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <DollarSign size={20} style={{ color: 'var(--v6-ok)' }} />
                </div>
                <div className="min-w-0">
                    <div style={{ fontSize: 10.5, fontWeight: 900, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--v6-tx3)' }}>
                        Comisión de este mes
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v6-tx2)', marginTop: 2 }}>
                        {Math.round(data.rate * 100)}% de {money(data.cash_neto)} cobrados netos
                    </div>
                </div>
            </div>
            <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--v6-ok)', letterSpacing: '-.02em', flexShrink: 0 }}>
                {money(data.commission)}
            </div>
        </div>
    );
};

export default ComisionMesCard;
