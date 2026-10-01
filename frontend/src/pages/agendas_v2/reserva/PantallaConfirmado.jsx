import React from 'react';
import { ArrowRight, CalendarPlus, MessageCircle, User, Video } from 'lucide-react';
import { formatFechaLarga, formatHora, tzCiudad } from '../shared/time';
import { closerPorId } from '../shared/mockData';

// Primera pantalla después de agendar. El objetivo ya no es convertir sino que el lead se presente:
// por eso empuja a la preparación (videos) en vez de cerrar con un "gracias" genérico.
export default function PantallaConfirmado({ reserva, nombre, whatsapp, email, tz, reunion, onPreparar }) {
    const primerNombre = (nombre || '').trim().split(' ')[0];
    const closer = closerPorId(reserva.closer);

    return (
        <div className="ag2-screen">
            <h1 className="ag2-display">Listo{primerNombre ? `, ${primerNombre}` : ''}. Tu llamada quedó <span className="ag2-hl">agendada</span>.</h1>

            <div className="ag2-when">
                <div className="ag2-when-date">{formatFechaLarga(reserva.utc, tz)} · {formatHora(reserva.utc, tz)}</div>
                <div className="ag2-when-row"><User size={16} /> Te atiende {closer?.nombre.split(' ')[0] || 'alguien del equipo'}, del equipo de Learnation</div>
                <div className="ag2-when-row"><Video size={16} /> {reunion.duracion} minutos por Google Meet · hora de {tzCiudad(tz)}</div>
                <div className="ag2-when-row"><MessageCircle size={16} /> Te escribimos por WhatsApp al {whatsapp?.prefijo} {whatsapp?.numero}</div>
                {email && <div className="ag2-when-row"><CalendarPlus size={16} /> La invitación con el link de Meet te llega a {email}</div>}
            </div>

            <p className="ag2-lede">
                Antes de la llamada, mirá tres videos cortos. Así usamos los {reunion.duracion} minutos en tu caso y no en explicarte cómo funciona todo.
            </p>
            <div className="ag2-actions">
                <button type="button" className="ag2-btn" onClick={onPreparar}>Prepararme <ArrowRight size={16} /></button>
                <span className="ag2-hint">10 minutos en total</span>
            </div>
        </div>
    );
}
