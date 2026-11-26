// El alto que le queda a la bandeja sin meterse debajo del dock (Mario, 26/11: el dock tapaba la caja del chat).
// Mide dónde arranca la bandeja en la página y dónde empieza lo fijo de abajo (el dock del espacio del setter, el de
// Thalamus o el que sea: lo que esté `fixed` o `sticky` en el borde de abajo). Devuelve [ref, alto]: el ref es una
// función, así mide apenas aparece la bandeja (antes de cargar no está) y vuelve a medir con cada cambio de tamaño.
import { useCallback, useLayoutEffect, useState } from 'react';

const AIRE = 14;

function bordeDeAbajo() {
    const alto = window.innerHeight;
    let tope = alto;
    for (const x of [0.5, 0.3, 0.7]) {
        for (const el of document.elementsFromPoint(window.innerWidth * x, alto - 20)) {
            let n = el;
            while (n && n !== document.body) {
                const pos = getComputedStyle(n).position;
                if (pos === 'fixed' || pos === 'sticky') {
                    const r = n.getBoundingClientRect();
                    if (r.height < alto / 2) tope = Math.min(tope, r.top); // un fondo fijo a pantalla completa no cuenta
                    break;
                }
                n = n.parentElement;
            }
        }
    }
    return tope;
}

export default function useAltoLibre(minimo = 380) {
    const [nodo, setNodo] = useState(null);
    const [alto, setAlto] = useState(null);
    const ref = useCallback((el) => setNodo(el), []);
    useLayoutEffect(() => {
        if (!nodo) return undefined;
        const medir = () => {
            const arriba = nodo.getBoundingClientRect().top + window.scrollY;
            setAlto(Math.max(minimo, Math.round(bordeDeAbajo() - arriba - AIRE)));
        };
        medir();
        const tardes = [300, 1000, 2500].map((ms) => setTimeout(medir, ms)); // el dock y las fuentes terminan de acomodarse
        const obs = new ResizeObserver(medir);
        obs.observe(document.body);
        const dock = document.querySelector('.dock-barra');
        if (dock) obs.observe(dock);
        window.addEventListener('resize', medir);
        return () => { tardes.forEach(clearTimeout); obs.disconnect(); window.removeEventListener('resize', medir); };
    }, [nodo, minimo]);
    return [ref, alto];
}
