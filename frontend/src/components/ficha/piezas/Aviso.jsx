import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

const ICONOS = { success: CheckCircle2, error: AlertTriangle, warning: AlertTriangle, info: Info, idle: Info };

/**
 * Aviso descartable del panel. Lo usa el cascarón después de cada acción y también
 * las sub-vistas para advertir antes de algo irreversible.
 */
const Aviso = ({ tono = 'success', titulo, children = null, onCerrar = null }) => {
    const Icono = ICONOS[tono] || Info;
    return (
        <div role="status" className="tarjeta"
            style={{ '--c': `var(--${tono})`, display: 'flex', alignItems: 'flex-start',
                gap: 'var(--s3)', background: `var(--${tono}-surface)`,
                borderColor: `var(--${tono}-border)` }}>
            <Icono size={18} style={{ color: `var(--${tono})`, flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>{titulo}</span>
                {children && <span className="t-cap mut">{children}</span>}
            </div>
            {onCerrar && (
                <button type="button" className="ibtn ibtn--sm" aria-label="Descartar aviso" onClick={onCerrar}>
                    <X size={14} />
                </button>
            )}
        </div>
    );
};

export default Aviso;
