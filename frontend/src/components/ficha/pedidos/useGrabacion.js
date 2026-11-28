// Graba un audio y, a la vez, lo dicta como Learnito (Web Speech API): queda el audio y su texto.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useDictado } from '../../../pages/copiloto/useDictado';

const MAXIMO_S = 300;

export default function useGrabacion(onTexto) {
    const dictado = useDictado(onTexto);
    const [grabando, setGrabando] = useState(false);
    const [segundos, setSegundos] = useState(0);
    const [audio, setAudio] = useState(null);
    const [error, setError] = useState(null);
    const rec = useRef(null);

    const detener = useCallback(() => {
        if (rec.current?.state === 'recording') rec.current.stop();
        dictado.detener();
    }, [dictado]);

    const empezar = useCallback(async () => {
        setError(null);
        let stream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            setError('Permití el micrófono en el navegador para grabar.');
            return;
        }
        const partes = [];
        const r = new MediaRecorder(stream);
        r.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
        r.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            setAudio(new Blob(partes, { type: r.mimeType || 'audio/webm' }));
            setGrabando(false);
        };
        rec.current = r;
        setAudio(null);
        setSegundos(0);
        r.start();
        setGrabando(true);
        if (dictado.soportado) dictado.empezar();
    }, [dictado]);

    useEffect(() => {
        if (!grabando) return undefined;
        const id = setInterval(() => setSegundos((s) => s + 1), 1000);
        return () => clearInterval(id);
    }, [grabando]);

    useEffect(() => { if (segundos >= MAXIMO_S) detener(); }, [segundos, detener]);

    useEffect(() => () => {
        if (rec.current?.state === 'recording') rec.current.stop();
    }, []);

    return {
        grabando, segundos, audio, error: error || dictado.error, parcial: dictado.parcial,
        transcribe: dictado.soportado, empezar, detener, borrar: () => setAudio(null),
    };
}
