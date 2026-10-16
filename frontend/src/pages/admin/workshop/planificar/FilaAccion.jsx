import { motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import InlineConfirm from '../../../../components/ui/InlineConfirm';
import { STAGE_ORDER } from '../funnelMath';
import { formatearInicio } from '../agendaTaller';

const etiquetaEtapa = (key) => STAGE_ORDER.find((s) => s.key === key)?.label;

/** Cómo se nombra un taller en un selector: su fecha y hora, o el día si no tiene hora. */
export const nombreTaller = (t) => (t.inicio_at ? formatearInicio(t.inicio_at) : t.date.split('-').reverse().join('/'));

/**
 * Una acción del plan: se tilda, se abre para editar (título) y se borra con deshacer.
 * `talleres` + `onAsignar` agregan el selector de taller (las que todavía no tienen uno).
 */
const FilaAccion = ({ accion, onTildar, onEditar, onBorrar, talleres, onAsignar }) => {
    const reducir = useReducedMotion();
    const hecha = accion.status === 'done';
    const etapa = etiquetaEtapa(accion.stage_key);

    return (
        <motion.li className="wp-accion" data-hecha={hecha ? '1' : undefined} layout={reducir ? false : 'position'}
            initial={reducir ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}>
            <motion.button type="button" className="wp-check" role="checkbox" aria-checked={hecha}
                aria-label={`${hecha ? 'Marcar pendiente' : 'Marcar hecha'}: ${accion.title}`}
                whileTap={reducir ? undefined : { scale: 0.86 }} onClick={() => onTildar(accion)}>
                {hecha && (
                    <motion.span key="ok" initial={reducir ? false : { scale: 0.4, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 26 }}>
                        <Check aria-hidden="true" />
                    </motion.span>
                )}
            </motion.button>
            <div className="wp-accion-txt">
                <button type="button" className="wp-accion-tit" onClick={() => onEditar(accion)} title={accion.title}>
                    {accion.title}
                </button>
                {(etapa || accion.target_delta_pp > 0) && (
                    <span className="wp-accion-meta">
                        {etapa}{etapa && accion.target_delta_pp > 0 ? ' · ' : ''}
                        {accion.target_delta_pp > 0 ? `+${accion.target_delta_pp} pts` : ''}
                    </span>
                )}
            </div>
            {onAsignar && (
                <select className="wp-select wp-select--sm" aria-label={`Taller de ${accion.title}`}
                    value={accion.event_id ?? ''} onChange={(e) => onAsignar(accion, e.target.value ? Number(e.target.value) : null)}>
                    <option value="">Sin taller</option>
                    {accion.event_id != null && !talleres.some((t) => t.id === accion.event_id) && (
                        <option value={accion.event_id}>Taller que ya pasó</option>
                    )}
                    {talleres.map((t) => <option key={t.id} value={t.id}>{nombreTaller(t)}</option>)}
                </select>
            )}
            <InlineConfirm compacto alto={30} tamIcono={13} corner={15} label="Borrar acción"
                question="¿Borrar?" confirmLabel="Sí" doneLabel="Borrada" title={`Borrar «${accion.title}»`}
                onConfirm={() => onBorrar(accion)} />
        </motion.li>
    );
};

export default FilaAccion;
