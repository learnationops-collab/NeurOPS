import React, { useState } from 'react';
import Legado from './Legado';
import { CalendarClock, Target, Zap } from 'lucide-react';
import WorkshopProximosView from '../components/WorkshopProximosView';
import WorkshopSimuladorView from '../components/WorkshopSimuladorView';
import WorkshopAccionesView from '../components/WorkshopAccionesView';

/**
 * Planificar: configurar los próximos talleres, simular qué cambiar y convertirlo en acciones para
 * los que vienen. Antes eran tres pestañas sueltas (Próximos, Simulador, Acciones); desde el
 * 16/10/2026 son una sola.
 *
 * `enfoque` es lo que pidió otra pestaña al mandar acá («Simular mejora» del Resumen, la cuenta
 * regresiva de la cabecera): `{ vista, etapa }`.
 */

const VISTAS = [
    { key: 'proximos', label: 'Próximos', Icono: CalendarClock },
    { key: 'simulador', label: 'Simulador', Icono: Target },
    { key: 'acciones', label: 'Acciones', Icono: Zap },
];

const PlanificarTab = ({
    events, realizados, goals, onGoalsUpdated, actions, onActionsChanged, enfoque,
    onEdit, onDelete, onProgramado, formatCurrency,
}) => {
    const [vista, setVista] = useState(enfoque?.vista || 'proximos');
    // Un pedido nuevo de otra pestaña (objeto nuevo) cambia la vista; se ajusta en el render, sin efecto.
    const [enfoqueVisto, setEnfoqueVisto] = useState(enfoque);
    if (enfoque !== enfoqueVisto) {
        setEnfoqueVisto(enfoque);
        if (enfoque?.vista) setVista(enfoque.vista);
    }

    const cantidadProximos = events.length - realizados.length;
    const pendientes = actions.filter((a) => a.status === 'pending').length;
    const cuenta = { proximos: cantidadProximos, acciones: pendientes };

    return (
        <Legado>
            <div className="section-tabs" role="tablist" aria-label="Planificar" style={{ width: 'fit-content', marginBottom: 18 }}>
                {VISTAS.map(({ key, label, Icono }) => (
                    <button key={key} type="button" className={vista === key ? 'active' : ''} onClick={() => setVista(key)}
                        aria-current={vista === key ? 'page' : undefined}>
                        <Icono size={14} /> {label}{cuenta[key] > 0 ? ` (${cuenta[key]})` : ''}
                    </button>
                ))}
            </div>

            {vista === 'proximos' ? (
                <WorkshopProximosView events={events} onEdit={onEdit} onDelete={onDelete} onProgramado={onProgramado} />
            ) : vista === 'simulador' ? (
                <WorkshopSimuladorView
                    events={realizados}
                    goals={goals}
                    highlightStage={enfoque?.etapa || null}
                    onGoalsUpdated={onGoalsUpdated}
                    formatCurrency={formatCurrency}
                />
            ) : (
                <WorkshopAccionesView
                    events={realizados}
                    goals={goals}
                    actions={actions}
                    onActionsChanged={onActionsChanged}
                    formatCurrency={formatCurrency}
                />
            )}
        </Legado>
    );
};

export default PlanificarTab;
