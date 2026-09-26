import React from 'react';
import { ArrowLeft } from 'lucide-react';

/**
 * Marco de toda sub-vista del panel: título, cuerpo y el pie con `Volver`.
 *
 * Es la pieza que hace posible la regla "un solo modal": una acción abre una
 * sub-vista DENTRO del panel, nunca un diálogo encima del diálogo. `Volver`
 * siempre a la izquierda y la acción a la derecha, igual en las cuatro pestañas.
 */
const SubVista = ({ titulo, onVolver, acciones = null, aviso = null, children }) => (
    <div style={{ display: 'grid', gap: 'var(--s4)' }}>
        <h3 className="t-h3">{titulo}</h3>
        {aviso}
        {children}
        <div className="fi-pie" style={{ justifyContent: 'space-between' }}>
            <button type="button" className="btn btn--linea" onClick={onVolver}>
                <ArrowLeft size={14} />
                Volver
            </button>
            {acciones && <div className="fi-pie-der">{acciones}</div>}
        </div>
    </div>
);

export default SubVista;
