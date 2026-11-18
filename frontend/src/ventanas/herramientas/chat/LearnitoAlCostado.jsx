// Learnito al costado del canal (mockup chat-cruzado): lo que se le pregunta acá lo ve solo quien pregunta. Arriba,
// el mensaje sobre el que se pregunta (la chispa lo cita y deja el comienzo de la pregunta en el campo, sin
// mandarla); abajo, «Compartir en el canal» publica su última respuesta, firmada por Learnito.
import { useState } from 'react';
import { Share2, Sparkles, X } from 'lucide-react';
import { Button, IconButton, toast } from '../../../components/standard';
import LearnitoChat from '../../../pages/copiloto/LearnitoChat';
import { useLearnito } from '../../../sesion/LearnitoContext';
import TemaLearnito from './TemaLearnito';

const sinMarcadores = (texto) => texto.replace(/\[\[[A-Z]\]\]/g, '').trim();

export default function LearnitoAlCostado({ cita, onSinCita, onCompartir }) {
    const { mensajes } = useLearnito();
    const [compartiendo, setCompartiendo] = useState(false);
    const ultima = [...mensajes].reverse().find(m => m.role === 'assistant' && m.content);

    const compartir = async () => {
        if (!ultima || compartiendo) return;
        setCompartiendo(true);
        try {
            await onCompartir(sinMarcadores(ultima.content), { como: 'learnito', parentId: cita?.id });
            toast('Compartido en Equipo', 'success');
        } catch {
            toast('No se pudo compartir. Probá de nuevo.', 'error');
        } finally {
            setCompartiendo(false);
        }
    };

    return (
        <div className="ch-lcost">
            <p className="ch-lado__tit"><span><Sparkles size={14} aria-hidden="true" /> Learnito</span><small>Al costado · lo ves solo vos</small></p>
            {cita && (
                <div className="ch-lcost__cita">
                    <small>Sobre esto</small>
                    <b>{cita.autor.nombre}</b>
                    <span>{cita.texto || cita.tarjeta?.titulo}</span>
                    <IconButton size="xs" label="Quitar el mensaje" icon={<X size={12} />} onClick={onSinCita} />
                </div>
            )}
            <TemaLearnito className="ch-lcost__chat"><LearnitoChat /></TemaLearnito>
            <Button size="sm" icon={<Share2 size={14} />} onClick={compartir} disabled={!ultima || compartiendo}>
                Compartir la última respuesta en el canal
            </Button>
        </div>
    );
}
