// Dictado con la Web Speech API del navegador (Chrome y Edge; Safari a medias; Firefox no).
// Gratis y sin pasar por nuestro servidor. `onFinal` recibe cada frase confirmada; lo provisorio
// queda en `parcial` para mostrarlo mientras el closer habla.
import { useCallback, useEffect, useRef, useState } from 'react';
import { leerResultados, mensajeDeError } from './dictado';

function reconocedor() {
    if (typeof window === 'undefined') return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function useDictado(onFinal) {
    const [escuchando, setEscuchando] = useState(false);
    const [parcial, setParcial] = useState('');
    const [error, setError] = useState(null);
    const recRef = useRef(null);
    const onFinalRef = useRef(onFinal);
    useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

    const detener = useCallback(() => { recRef.current?.stop(); }, []);

    const empezar = useCallback(() => {
        const Reconocimiento = reconocedor();
        if (!Reconocimiento || recRef.current) return;
        const rec = new Reconocimiento();
        rec.lang = 'es-AR';
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (evento) => {
            const { final, parcial: provisorio } = leerResultados(evento);
            if (final) onFinalRef.current(final);
            setParcial(provisorio);
        };
        rec.onerror = (evento) => setError(mensajeDeError(evento.error));
        rec.onend = () => {
            recRef.current = null;
            setParcial('');
            setEscuchando(false);
        };
        recRef.current = rec;
        setError(null);
        setEscuchando(true);
        rec.start();
    }, []);

    useEffect(() => () => recRef.current?.abort(), []);

    return { soportado: Boolean(reconocedor()), escuchando, parcial, error, empezar, detener };
}
