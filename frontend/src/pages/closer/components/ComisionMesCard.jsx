import { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import api from '../../../services/api';
import { money } from '../dashboard/performanceUtils';
import { Esqueleto, Hueso, Renglon } from '../../../components/huesos/Huesos';

// Comisión del mes en curso, visible en el espacio de trabajo del closer (pedido del usuario,
// 10/sep/2026: "que los closers y los setters puedan ver cuanto van ganando de comision del
// mes"). Se auto-contiene y se fetchea sola (no depende de ningún estado de CloserWorkflowPage,
// que ya es enorme) — ver `CommissionService` en el backend para de dónde sale el %.
//
// Es la tercera de las tarjetas de arriba del mazo, al lado de "Tu siguiente paso" y "Tu día"
// (30/09/2026): antes ocupaba una fila entera. Usa la caja y los rótulos de "Tu día" (`.tud-*`)
// para que las tres se lean como una sola fila.
//
// Mientras carga ocupa su lugar con la forma que va a tener, como el esqueleto del kanban de abajo
// (ver EsqueletoKanban): sin eso, al llegar, la fila cambiaba de forma con el closer a punto de
// tocar algo. El ícono y el rótulo van de verdad (no dependen de nada); en hueso, las dos cifras.
//
// Si la consulta falla la tarjeta no se muestra, como antes: un hueso que no se va nunca sería
// peor que el hueco. Las otras dos se reparten la fila (`.pareja`).
const Rotulo = () => (
    <div className="flex items-start justify-between gap-2">
        <div className="tud-lbl-v6">Comisión de este mes</div>
        <span className="com-ic-v6" aria-hidden="true">
            <DollarSign size={14} />
        </span>
    </div>
);

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
        // Cada hueso dentro del alto de línea de lo que reemplaza: la cifra (`.com-monto-v6`, 34 px
        // de letra en un renglón de 34, 10 de margen) y el detalle (`.tud-foot-v6`, 11 px en uno
        // de 16,5, al pie como el de verdad).
        return (
            <Esqueleto rotulo="Cargando la comisión del mes…" className="tud-v6">
                <div aria-hidden="true"><Rotulo /></div>
                <Renglon alto={34} style={{ marginTop: 10 }}><Hueso alto={26} ancho={112} paso={1} /></Renglon>
                <div className="tud-foot-row-v6" aria-hidden="true">
                    <Renglon alto={16.5}><Hueso alto={10} ancho={190} paso={2} /></Renglon>
                </div>
            </Esqueleto>
        );
    }

    return (
        <div className="tud-v6">
            <Rotulo />
            <div className="com-monto-v6">{money(data.commission)}</div>
            <div className="tud-foot-row-v6">
                <span className="tud-foot-v6">
                    {Math.round(data.rate * 100)}% de {money(data.cash_neto)} cobrados netos
                </span>
            </div>
        </div>
    );
};

export default ComisionMesCard;
