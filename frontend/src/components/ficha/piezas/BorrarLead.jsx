import React from 'react';
import BorrarConConfirmacion from '../historial/BorrarConConfirmacion';

/**
 * La papelera de la cabecera de la ficha: elimina el lead ENTERO —el cliente, todas sus agendas, su registro de
 * eventos, sus respuestas y su lugar en el libro de agendas— para los leads de prueba (Kerwin, 28/10/2026: «no puedo
 * eliminar leads y agendas de testeo»). Borrar solo UNA agenda sigue en Historial › Agendas.
 *
 * Solo la dirección (`permisos.eliminar_lead`) y el backend se niega si el lead tiene pagos, ventas, plan de cuotas o
 * suscripción (`app/services/lead_prueba_service.py`): con plata no es de prueba. El motivo sale en el modal.
 */
const BorrarLead = ({ ficha, puedeEditar, onAccion }) => {
    if (!puedeEditar || ficha?.permisos?.eliminar_lead !== true) return null;
    const nombre = ficha?.identidad?.nombre || 'Este lead';
    return (
        <BorrarConConfirmacion chico={false} etiqueta="Eliminar el lead y todas sus agendas"
            titulo="¿Eliminar este lead de prueba?" confirmar="Eliminar lead"
            onBorrar={() => onAccion?.('eliminar_lead')}>
            <span><strong>{nombre}</strong></span>
            <span>
                Se borran el lead, todas sus agendas, su registro de eventos, sus respuestas del formulario y su lugar en el libro de
                agendas, así deja de contar en Marketing y en Revisar. No se puede deshacer.
            </span>
            <span>Solo se puede si no tiene pagos, plan de cuotas ni suscripción.</span>
        </BorrarConConfirmacion>
    );
};

export default BorrarLead;
