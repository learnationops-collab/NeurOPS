import React from 'react';
import TalleresVista from '../talleres/TalleresVista';

/**
 * Pestaña Talleres: el historial de los talleres realizados con todo lo de cada uno — su embudo, los
 * anuncios de Meta que lo llenaron y su grabación —, en el estilo del dashboard comercial. Antes eran
 * cuatro pestañas sueltas (Historial, Embudo, Anuncios, Landing grabación); desde el 16/10/2026 es
 * una sola vista (`talleres/TalleresVista.jsx`).
 *
 * `onDelete` de la página ya no se usa acá: eliminar va con `InlineConfirm` (deshacer) en vez de
 * `window.confirm`, y el pedido lo hace la vista.
 */
const HistorialTab = ({ events, realizados, onEdit, onRefresh, formatDate }) => (
    <div className="dc-shell dc-shell--embebido">
        <TalleresVista events={events} realizados={realizados} onEdit={onEdit} onRefresh={onRefresh}
            formatDate={formatDate} />
    </div>
);

export default HistorialTab;
