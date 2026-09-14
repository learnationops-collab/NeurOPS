import { useMemo, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

// 620px en el mockup: lista agrupada por área, radio + chip "Acá está" para el
// módulo donde ya vive la lección, más al-principio/al-final del módulo
// destino. Llama al mismo endpoint de reorder que el drag y el teclado.
const MoveLessonModal = ({ lesson, flatModules, onClose, onConfirm }) => {
    const [moduleId, setModuleId] = useState(lesson.module_id);
    const [position, setPosition] = useState('end');
    const [saving, setSaving] = useState(false);

    const byArea = useMemo(() => {
        const groups = {};
        flatModules.forEach((m) => {
            groups[m.areaName] = groups[m.areaName] || [];
            groups[m.areaName].push(m);
        });
        return groups;
    }, [flatModules]);

    const handleConfirm = async () => {
        if (saving) return;
        setSaving(true);
        try {
            await onConfirm(moduleId, position);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="ce-modal-overlay" onClick={onClose}>
            <div className="ce-modal is-narrow" onClick={(e) => e.stopPropagation()}>
                <div className="ce-modal__header">
                    <div>
                        <p className="ce-modal__breadcrumb">Mover lección</p>
                        <h3 className="ce-modal__title">{lesson.title}</h3>
                    </div>
                    <button type="button" className="ce-modal__close" onClick={onClose} aria-label="Cerrar"><X size={16} /></button>
                </div>

                <div className="ce-modal__body">
                    <div className="move-modal__list">
                        {Object.entries(byArea).map(([areaName, mods]) => (
                            <div key={areaName}>
                                <p className="move-modal__area">{areaName}</p>
                                {mods.map((m) => (
                                    <label key={m.moduleId} className={`move-modal__option${moduleId === m.moduleId ? ' is-selected' : ''}`}>
                                        <input type="radio" name="move-target" checked={moduleId === m.moduleId} onChange={() => setModuleId(m.moduleId)} />
                                        <span className="move-modal__option-label">{m.moduleName}</span>
                                        {lesson.module_id === m.moduleId && <span className="move-modal__here-badge">Acá está</span>}
                                    </label>
                                ))}
                            </div>
                        ))}
                    </div>

                    <div>
                        <p className="form-label" style={{ marginBottom: 8 }}>Posición en el módulo destino</p>
                        <div className="move-modal__position">
                            <button type="button" className={position === 'start' ? 'is-selected' : ''} onClick={() => setPosition('start')}>Al principio</button>
                            <button type="button" className={position === 'end' ? 'is-selected' : ''} onClick={() => setPosition('end')}>Al final</button>
                        </div>
                    </div>
                </div>

                <div className="ce-modal__footer">
                    <button type="button" className="btn-ghost" onClick={onClose}>Cancelar</button>
                    <button type="button" className="btn-primary-pill" disabled={saving} onClick={handleConfirm}>
                        {saving && <Loader2 size={14} className="animate-spin" />} Mover lección
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MoveLessonModal;
