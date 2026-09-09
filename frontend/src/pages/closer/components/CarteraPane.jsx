import { useState } from 'react';
import MiCarteraPane from './MiCarteraPane';
import CarteraAgendasPane from './CarteraAgendasPane';

// Pestañas de "06 · Mi cartera": "Clientes" (lo que siempre fue Mi cartera: a quién le vendió el
// closer y cómo va con los pagos) y "Agendas" (todas sus citas con su estado, para corroborar
// totales — pedido del usuario, 9/sep/2026). Cada pestaña carga sus datos al montarse, así que
// cambiar de una a otra no pide nada de más.
const TABS = [
    { key: 'clientes', label: 'Clientes' },
    { key: 'agendas', label: 'Agendas' },
];

const CarteraPane = ({ onOpenLead }) => {
    const [tab, setTab] = useState('clientes');

    return (
        <div className="space-y-5">
            <div className="ltabs">
                {TABS.map(t => (
                    <button
                        key={t.key}
                        type="button"
                        className={`ltab ${tab === t.key ? 'on' : ''}`}
                        onClick={() => setTab(t.key)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            {tab === 'agendas'
                ? <CarteraAgendasPane onOpenLead={onOpenLead} />
                : <MiCarteraPane onOpenLead={onOpenLead} />}
        </div>
    );
};

export default CarteraPane;
