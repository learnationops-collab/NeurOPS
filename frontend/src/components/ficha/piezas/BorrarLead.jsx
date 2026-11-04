import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import ModalEliminarLead from './ModalEliminarLead';

/**
 * La papelera de la cabecera de la ficha: elimina el lead ENTERO —el cliente, todas sus agendas, su registro de
 * eventos, sus respuestas y su lugar en el libro de agendas— para los leads de prueba (Kerwin, 28/10/2026: «no puedo
 * eliminar leads y agendas de testeo»). Borrar solo UNA agenda sigue en Historial › Agendas.
 *
 * La ve quien tenga `permisos.eliminar_lead` (desde el 03/11/2026: la dirección, el director de marketing, los closers
 * y triage), también con la ficha en solo lectura. Con pagos o ventas la confirmación pide confirmar aparte y solo la
 * dirección y el director de marketing pueden (`ModalEliminarLead`); una suscripción frena a todos.
 */
const BorrarLead = ({ ficha, onAccion }) => {
    const [abierto, setAbierto] = useState(false);
    const agendaId = ficha?.identidad?.appointment_id;
    if (ficha?.permisos?.eliminar_lead !== true || !agendaId) return null;
    const nombre = ficha?.identidad?.nombre || 'Este lead';
    return (
        <>
            <button type="button" className="ibtn ibtn--borrar" aria-haspopup="dialog"
                aria-label="Eliminar el lead y todas sus agendas" title="Eliminar el lead y todas sus agendas"
                onClick={() => setAbierto(true)}>
                <Trash2 />
            </button>
            {abierto && (
                <ModalEliminarLead agendaId={agendaId} nombre={nombre} onCerrar={() => setAbierto(false)}
                    eliminar={(conPlata) => onAccion?.('eliminar_lead', conPlata ? { con_plata: true } : {})} />
            )}
        </>
    );
};

export default BorrarLead;
