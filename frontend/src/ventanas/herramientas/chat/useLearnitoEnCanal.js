// @Learnito en el canal (ADR-W174): la pregunta va a la conversación de Learnito de quien pregunta (sale de su tope,
// decisión de Santi del 17/11, y la ve también en su Learnito) y la respuesta se publica en el canal, firmada por
// Learnito y colgada del mensaje que lo nombró. Si respondía a un mensaje, ese mensaje viaja de contexto.
import { useCallback, useState } from 'react';
import { toast } from '../../../components/standard';
import { useLearnito } from '../../../sesion/LearnitoContext';

const sinMarcadores = (texto) => texto.replace(/\[\[[A-Z]\]\]/g, '').trim();

export default function useLearnitoEnCanal(enviarAlCanal) {
    const learnito = useLearnito();
    const [pensando, setPensando] = useState(false);

    const preguntar = useCallback(async (texto, mensajeId, cita) => {
        const pregunta = texto.replace(/@Learnito/gi, '').trim() || '¿Qué sabés de esto?';
        const contexto = cita
            ? `En el chat Equipo del equipo, sobre este mensaje de ${cita.autor.nombre}: «${cita.texto || cita.tarjeta?.titulo || ''}». `
            : 'En el chat Equipo del equipo: ';
        setPensando(true);
        try {
            const error = await learnito.enviar(contexto + pregunta, `En Equipo: ${pregunta}`);
            if (error) { toast(error, 'error'); return; }
            const respuesta = sinMarcadores(learnito.ultimaRespuesta());
            if (respuesta) await enviarAlCanal(respuesta, { como: 'learnito', parentId: mensajeId });
        } catch {
            toast('Learnito no pudo responder en el canal. Probá de nuevo.', 'error');
        } finally {
            setPensando(false);
        }
    }, [learnito, enviarAlCanal]);

    return { pensando, preguntar };
}
