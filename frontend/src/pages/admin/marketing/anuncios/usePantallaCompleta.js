import { useCallback, useEffect, useState } from 'react';

/**
 * La tabla a pantalla completa (Kerwin, 23/10/2026: «hay muchas configuraciones, que ocupe toda la
 * pantalla»). Es una capa `fixed` sobre toda la ventana (clase `mk-pantalla`, ver anuncios.css) y, si el
 * navegador deja, además se pasa el navegador a pantalla completa. Escape sale; si se sale del modo del
 * navegador (Escape, F11), también se cierra la capa. La capa sola ya sirve donde no hay API (jsdom, iOS).
 */
export const usePantallaCompleta = () => {
    const [completa, setCompleta] = useState(false);

    const alternar = useCallback(() => setCompleta((c) => !c), []);

    useEffect(() => {
        if (!completa) return undefined;
        const raiz = document.documentElement;
        const pedido = raiz.requestFullscreen?.();
        pedido?.catch?.(() => {}); // sin permiso queda la capa, que es lo que importa
        const escape = (e) => { if (e.key === 'Escape' && !document.querySelector('.mk-pantalla [role="menu"], .mk-editor, .mk-pantalla [role="dialog"]')) setCompleta(false); };
        const salio = () => { if (!document.fullscreenElement) setCompleta(false); };
        document.addEventListener('keydown', escape);
        document.addEventListener('fullscreenchange', salio);
        return () => {
            document.removeEventListener('keydown', escape);
            document.removeEventListener('fullscreenchange', salio);
            if (document.fullscreenElement) document.exitFullscreen?.().catch?.(() => {});
        };
    }, [completa]);

    return { completa, alternar };
};

export default usePantallaCompleta;
