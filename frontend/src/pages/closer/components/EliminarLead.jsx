// Papelera de la tarjeta del tablero: borra la agenda de alguien que agendó por otra cosa (no era
// una llamada de venta) para que no cuente en asistencia, comisión ni métricas. Usa el mismo
// borrado que la dirección comercial (`BookingService.eliminar_agenda`).
import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmDelete, IconButton } from '../../../components/standard';
import api from '../../../services/api';

export default function EliminarLead({ agenda, onEliminado }) {
    const [confirmando, setConfirmando] = useState(false);
    const [borrando, setBorrando] = useState(false);
    const nombre = agenda.lead_name || 'Sin Nombre';

    const eliminar = async () => {
        setBorrando(true);
        try {
            await api.delete(`/closer/deck/${agenda.id}`);
            toast.success('Lead eliminado');
            onEliminado(agenda.id);
        } catch (err) {
            toast.error(err.response?.data?.error || 'No se pudo eliminar el lead');
            setBorrando(false);
            setConfirmando(false);
        }
    };

    // La tarjeta entera abre la ficha y se arrastra: nada de acá tiene que llegarle.
    const frenar = (e) => e.stopPropagation();

    if (confirmando) {
        return (
            <div className="kc-eliminar-confirma" onClick={frenar} onMouseDown={frenar} draggable={false} onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                <ConfirmDelete name={nombre} article="a " detail="No era una llamada: deja de contar en tus números." icon={<Trash2 />}
                    onCancel={() => setConfirmando(false)} onConfirm={borrando ? undefined : eliminar} />
            </div>
        );
    }

    return (
        <span className="kc-eliminar" onClick={frenar}>
            <IconButton label={`Eliminar ${nombre}`} icon={<Trash2 />} size="sm" danger data-tip="Eliminar|No era una llamada"
                onClick={() => setConfirmando(true)} />
        </span>
    );
}
