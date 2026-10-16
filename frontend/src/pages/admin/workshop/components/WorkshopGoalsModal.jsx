import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../../../services/api';
import { Tip } from '../../../comercial/components/Shared';
import { STAGE_ORDER } from '../funnelMath';
import '../../../comercial/comercial.css';
import '../resumen/resumen.css';

/**
 * Las metas del embudo: las 8 tasas de WorkshopGoals más la banda «al límite». Una sola fila para
 * todo Workshop (Resumen, Simulador, Acciones).
 *
 * Es el modal del dashboard comercial (`.scrim` + `.modal`) en un portal con la clase `dc-shell`
 * encima: la página todavía lo monta dentro del envoltorio viejo (`Legado`), y así no hereda nada
 * de ahí.
 */
const WorkshopGoalsModal = ({ goals, onClose, onSaved }) => {
    const reducir = useReducedMotion();
    const [form, setForm] = useState(() => ({ ...goals }));
    const [saving, setSaving] = useState(false);
    const primero = useRef(null);

    const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    // La página le pasa un `onClose` nuevo en cada render (el polling de 20 s la re-renderiza): por
    // ref, para que el foco no salte al primer campo a mitad de la carga.
    const cerrar = useRef(onClose);
    cerrar.current = onClose;
    useEffect(() => {
        primero.current?.focus();
        const escape = (e) => { if (e.key === 'Escape') cerrar.current(); };
        document.addEventListener('keydown', escape);
        return () => document.removeEventListener('keydown', escape);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.put('workshop/goals', form);
            toast.success('Metas actualizadas');
            onSaved(res.data);
        } catch (err) {
            console.error('Error guardando metas:', err);
            toast.error('No se pudieron guardar las metas');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="dc-shell scrim" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <motion.form onSubmit={handleSubmit} className="modal wr-metas" role="dialog" aria-modal="true"
                aria-label="Metas del embudo"
                initial={reducir ? false : { opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
                <div className="wr-metas-cab">
                    <h2 className="t-h3">Metas del embudo</h2>
                    <Tip titulo="Metas del embudo"
                        texto="La tasa que se espera de cada etapa, en %: de cada 100 que llegaron al paso anterior, cuántos llegan a este. La banda es cuántos puntos por debajo de la meta todavía cuentan como «al límite» y no como bajo meta." />
                    <button type="button" className="ibtn ibtn--sm wr-metas-cerrar" onClick={onClose} aria-label="Cerrar">
                        <X aria-hidden="true" />
                    </button>
                </div>

                <div className="wr-metas-grilla">
                    {STAGE_ORDER.map((s, i) => (
                        <label key={s.key} className="wr-meta">
                            <span className="t-cap">{s.label}</span>
                            <span className="wr-meta-campo">
                                <input ref={i === 0 ? primero : undefined} className="num"
                                    type="number" step="0.1" min="0" max="100"
                                    value={form[s.goalKey] ?? 0}
                                    onChange={(e) => setField(s.goalKey, parseFloat(e.target.value) || 0)} />
                                <small>%</small>
                            </span>
                        </label>
                    ))}
                </div>
                <label className="wr-meta wr-meta--banda">
                    <span className="t-cap">Banda «al límite»</span>
                    <span className="wr-meta-campo">
                        <input className="num" type="number" step="0.5" min="0" value={form.banda_limite ?? 0}
                            onChange={(e) => setField('banda_limite', parseFloat(e.target.value) || 0)} />
                        <small>pts</small>
                    </span>
                </label>

                <div className="wr-metas-pie">
                    <button type="button" className="btn btn--linea btn--sm" onClick={onClose}>Cancelar</button>
                    <button type="submit" className="btn btn--cta btn--sm" disabled={saving}>
                        {saving && <Loader2 className="ws-gira" aria-hidden="true" />} Guardar metas
                    </button>
                </div>
            </motion.form>
        </div>,
        document.body
    );
};

export default WorkshopGoalsModal;
