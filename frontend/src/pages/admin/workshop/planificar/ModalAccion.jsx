import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import ModalPlan from './ModalPlan';
import { nombreTaller } from './FilaAccion';
import { STAGE_ORDER } from '../funnelMath';

const PUNTAJES = [
    { key: 'value_score', label: 'Valor' },
    { key: 'speed_score', label: 'Velocidad' },
    { key: 'simplicity_score', label: 'Simplicidad' },
    { key: 'urgency_score', label: 'Urgencia' },
];

export const ACCION_VACIA = {
    title: '', stage_key: '', target_delta_pp: 0, event_id: null, note: '',
    value_score: 3, speed_score: 3, simplicity_score: 3, urgency_score: 3,
};

/**
 * Crear o editar una acción. Llega con un borrador (vacío, de un taller, o de una palanca del
 * simulador: etapa y puntos ya puestos) y devuelve el borrador a `onGuardar`, que hace el pedido.
 */
const ModalAccion = ({ borrador, talleres, onGuardar, onCerrar }) => {
    const [form, setForm] = useState({ ...ACCION_VACIA, ...borrador, note: borrador.note || '', stage_key: borrador.stage_key || '' });
    const [guardando, setGuardando] = useState(false);
    const editando = Boolean(borrador.id);

    const campo = (clave, conv = (v) => v) => ({
        value: form[clave] ?? '',
        onChange: (e) => setForm((p) => ({ ...p, [clave]: conv(e.target.value) })),
    });

    const guardar = async () => {
        if (!form.title.trim() || guardando) return;
        setGuardando(true);
        const ok = await onGuardar(form);
        setGuardando(false);
        if (ok) onCerrar();
    };

    return (
        <ModalPlan titulo={editando ? 'Editar acción' : 'Nueva acción'} cerrable={!guardando}
            eyebrow={borrador.origen ? `Del simulador · ${borrador.origen.desde}% → ${borrador.origen.hasta}%` : 'Plan de acciones'}
            onCerrar={onCerrar} onSubmit={guardar}
            pie={(
                <>
                    <button type="button" className="btn btn--linea btn--sm" onClick={onCerrar} disabled={guardando}>Cancelar</button>
                    <button type="submit" className="btn btn--cta btn--sm" disabled={guardando || !form.title.trim()}>
                        {guardando ? <Loader2 className="ws-gira" aria-hidden="true" /> : <Check aria-hidden="true" />}
                        {editando ? 'Guardar' : 'Crear acción'}
                    </button>
                </>
            )}>
            <label className="wp-campo">
                <span className="t-rotulo">Qué hay que hacer</span>
                <input type="text" required autoFocus maxLength={200} placeholder="Ej: recordatorio por WhatsApp 1 h antes"
                    {...campo('title')} />
            </label>
            <div className="wp-campos-2">
                <label className="wp-campo">
                    <span className="t-rotulo">Taller</span>
                    <select className="wp-select" {...campo('event_id', (v) => (v ? Number(v) : null))}>
                        <option value="">Sin taller</option>
                        {talleres.map((t) => <option key={t.id} value={t.id}>{nombreTaller(t)}</option>)}
                    </select>
                </label>
                <label className="wp-campo">
                    <span className="t-rotulo">Etapa que mueve</span>
                    <select className="wp-select" {...campo('stage_key')}>
                        <option value="">General</option>
                        {STAGE_ORDER.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                </label>
            </div>
            <div className="wp-campos-2">
                <label className="wp-campo">
                    <span className="t-rotulo">Puntos que sube</span>
                    <input type="number" step="0.1" min="0" max="100" {...campo('target_delta_pp')} />
                </label>
                <label className="wp-campo">
                    <span className="t-rotulo">Nota</span>
                    <input type="text" placeholder="Opcional" {...campo('note')} />
                </label>
            </div>
            <fieldset className="wp-puntajes">
                <legend className="t-rotulo">Prioridad (1 a 5)</legend>
                {PUNTAJES.map((p) => (
                    <label key={p.key} className="wp-campo">
                        <span className="t-cap mut">{p.label}</span>
                        <select className="wp-select" {...campo(p.key, (v) => parseInt(v, 10))}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                    </label>
                ))}
            </fieldset>
        </ModalPlan>
    );
};

export default ModalAccion;
