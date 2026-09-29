import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import api from '../../../services/api';
import { money } from '../dashboard/performanceUtils';
import { Esqueleto, Hueso } from '../../../components/huesos/Huesos';

const CAJA = {
    border: '1px solid var(--v6-bd)', borderRadius: 20, background: 'var(--v6-card)',
    padding: '18px 24px', marginBottom: 20,
};

const ICONO = {
    width: 40, height: 40, borderRadius: 99, background: 'rgba(47,191,143,.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};

const ROTULO = { fontSize: 10.5, fontWeight: 900, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--v6-tx3)' };

// Comisión del mes en curso, visible en el espacio de trabajo del closer (pedido del usuario,
// 10/sep/2026: "que los closers y los setters puedan ver cuanto van ganando de comision del
// mes"). Se auto-contiene y se fetchea sola (no depende de ningún estado de CloserWorkflowPage,
// que ya es enorme) — ver `CommissionService` en el backend para de dónde sale el %.
//
// Mientras carga ocupa su lugar con la forma que va a tener (pedido del usuario, 29/sep/2026: ver
// el esqueleto mientras cargan las cosas del mazo). Antes no dibujaba nada hasta tener el dato, y
// como está ARRIBA de la navegación y del kanban, al llegar empujaba el mazo entero 100 px hacia
// abajo —con el esqueleto del kanban ya a la vista, o con el closer a punto de tocar una tarjeta—.
// El ícono y el rótulo van de verdad (no dependen de nada); en hueso, las dos cifras.
//
// Si la consulta falla la tarjeta no se muestra, como antes: un hueso que no se va nunca sería
// peor que el hueco.
const ComisionMesCard = () => {
    const [data, setData] = useState(null);
    const [fallo, setFallo] = useState(false);

    useEffect(() => {
        let vivo = true;
        api.get('/closer/commission')
            .then(res => {
                if (!vivo) return;
                if (res.data) setData(res.data);
                else setFallo(true);
            })
            .catch(() => { if (vivo) setFallo(true); });
        return () => { vivo = false; };
    }, []);

    if (fallo) return null;

    if (!data) {
        // Cada hueso dentro del alto de línea de lo que reemplaza: el detalle (11 px de letra,
        // línea de 16,5 y 2 de margen) y la cifra (30 px de letra, línea de 45).
        return (
            <Esqueleto rotulo="Cargando la comisión del mes…" className="flex items-center justify-between gap-4 flex-wrap" style={CAJA}>
                <div className="flex items-center gap-3 min-w-0" aria-hidden="true">
                    <div style={ICONO}>
                        <DollarSign size={20} style={{ color: 'var(--v6-ok)' }} />
                    </div>
                    <div className="min-w-0">
                        <div style={ROTULO}>Comisión de este mes</div>
                        <Hueso alto={10} ancho={190} style={{ margin: '5px 0 3.5px' }} />
                    </div>
                </div>
                <Hueso alto={28} ancho={112} paso={1} style={{ margin: '8.5px 0', flexShrink: 0 }} />
            </Esqueleto>
        );
    }

    return (
        <div className="flex items-center justify-between gap-4 flex-wrap" style={CAJA}>
            <div className="flex items-center gap-3 min-w-0">
                <div style={ICONO}>
                    <DollarSign size={20} style={{ color: 'var(--v6-ok)' }} />
                </div>
                <div className="min-w-0">
                    <div style={ROTULO}>
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
