import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import WorkshopProximosView from '../components/WorkshopProximosView';
import WorkshopSimuladorView from '../components/WorkshopSimuladorView';
import WorkshopAccionesView from '../components/WorkshopAccionesView';
import ModalAccion from '../planificar/ModalAccion';
import { agruparAcciones, cuerpoAccion, siguienteTaller, talleresPorDelante } from '../planificar/plan';
import { EsqueletoAcciones, EsqueletoProximos, EsqueletoSimulador } from '../planificar/EsqueletosPlan';
import '../planificar/planificar.css';

/**
 * Planificar: configurar los próximos talleres, simular qué cambiar y convertirlo en acciones que
 * hay que cumplir en un taller concreto. Antes eran tres pestañas sueltas (Próximos, Simulador,
 * Acciones); desde el 16/10/2026 es una sola vista:
 *
 *  - Próximos talleres: fecha, hora y links, y el checklist de acciones de cada uno.
 *  - Plan de acciones: los números del plan y las acciones sin un próximo taller.
 *  - Simulador: cada palanca subida se vuelve una acción («Acción»), que va al siguiente taller.
 *
 * `enfoque` es lo que pidió otra pestaña al mandar acá («Simular mejora» del Resumen, la cuenta
 * regresiva de la cabecera): `{ vista, etapa }`. Lleva a esa sección y resalta la etapa.
 */

const SECCION = { proximos: 'wp-proximos', simulador: 'wp-simulador', acciones: 'wp-acciones' };

const PlanificarTab = ({
    events, realizados, goals, onGoalsUpdated, actions, onActionsChanged, enfoque,
    onEdit, onDelete, onProgramado, formatCurrency,
}) => {
    const reducir = useReducedMotion();
    // El estado tildado se ve al instante; vuelve a mandar la lista apenas llega del backend.
    const [tildadas, setTildadas] = useState({});
    const [accionesVistas, setAccionesVistas] = useState(actions);
    if (actions !== accionesVistas) {
        setAccionesVistas(actions);
        setTildadas({});
    }
    const [borrador, setBorrador] = useState(null);

    // Talleres, metas o acciones en null: todavía no llegaron. Cada panel espera solo lo suyo.
    const talleres = useMemo(() => talleresPorDelante(events || []), [events]);
    const lista = useMemo(
        () => (actions || []).map((a) => (a.id in tildadas ? { ...a, status: tildadas[a.id] } : a)),
        [actions, tildadas],
    );
    const grupos = useMemo(() => agruparAcciones(lista, talleres), [lista, talleres]);

    useEffect(() => {
        const id = SECCION[enfoque?.vista];
        if (!id) return;
        document.getElementById(id)?.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'start' });
    }, [enfoque, reducir]);

    const guardar = async (form) => {
        const cuerpo = cuerpoAccion(form);
        try {
            if (form.id) await api.put(`workshop/actions/${form.id}`, cuerpo);
            else await api.post('workshop/actions', cuerpo);
            toast.success(form.id ? 'Acción guardada' : 'Acción creada');
            onActionsChanged();
            return true;
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo guardar la acción');
            return false;
        }
    };

    const tildar = async (accion) => {
        const status = accion.status === 'done' ? 'pending' : 'done';
        setTildadas((t) => ({ ...t, [accion.id]: status }));
        try {
            await api.put(`workshop/actions/${accion.id}`, { status });
            onActionsChanged();
        } catch {
            setTildadas((t) => { const resto = { ...t }; delete resto[accion.id]; return resto; });
            toast.error('No se pudo actualizar la acción');
        }
    };

    const asignar = async (accion, eventId) => {
        try {
            await api.put(`workshop/actions/${accion.id}`, { event_id: eventId });
            onActionsChanged();
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo mover la acción');
        }
    };

    const borrar = async (accion) => {
        try {
            await api.delete(`workshop/actions/${accion.id}`);
            onActionsChanged();
        } catch {
            toast.error('No se pudo borrar la acción');
        }
    };

    const siguiente = siguienteTaller(events || []);
    // Sin taller elegido, va al siguiente que todavía no empezó (se cambia en el modal).
    const nueva = (extra = {}) => setBorrador({ ...extra, event_id: extra.event_id ?? siguiente?.id ?? null });

    return (
        <div className="dc-shell dc-shell--embebido wp-plan">
            <div className="wp-arriba">
                {events && actions ? (
                    <WorkshopProximosView
                        events={events} onEdit={onEdit} onDelete={onDelete} onProgramado={onProgramado}
                        acciones={grupos.porTaller}
                        onNuevaAccion={(taller) => nueva({ event_id: taller.id })}
                        onTildar={tildar} onEditarAccion={setBorrador} onBorrarAccion={borrar}
                    />
                ) : <EsqueletoProximos />}
                {events && goals && actions ? (
                    <WorkshopAccionesView
                        events={realizados} goals={goals} actions={lista}
                        sinTaller={grupos.sinTaller} pasadas={grupos.pasadas} talleres={talleres}
                        formatCurrency={formatCurrency}
                        onNueva={() => nueva()} onTildar={tildar} onEditar={setBorrador} onBorrar={borrar} onAsignar={asignar}
                    />
                ) : <EsqueletoAcciones />}
            </div>
            {events && goals ? (
                <WorkshopSimuladorView
                    events={realizados} goals={goals} onGoalsUpdated={onGoalsUpdated} formatCurrency={formatCurrency}
                    etapaEnfocada={enfoque?.vista === 'simulador' ? enfoque.etapa || null : null}
                    onCrearAccion={(b) => b && nueva(b)}
                />
            ) : <EsqueletoSimulador />}

            {borrador && (
                <ModalAccion borrador={borrador} talleres={talleres} onGuardar={guardar} onCerrar={() => setBorrador(null)} />
            )}
        </div>
    );
};

export default PlanificarTab;
