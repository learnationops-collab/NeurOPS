// El alto que le queda a la bandeja sin meterse debajo del dock (Mario, 26/11: el dock tapaba la caja del chat).
// Mide dónde arranca la bandeja en la página y dónde empieza lo fijo de abajo (el dock del espacio del setter, el de
// Thalamus o el que sea: lo que esté `position: fixed` en el borde de abajo, al medio). Se recalcula al cambiar el
// tamaño de la ventana y cuando algo de arriba cambia de alto.
import { useLayoutEffect, useState } from 'react';

const AIRE = 12;

function bordeDeAbajo() {
    const alto = window.innerHeight;
    let tope = alto;
    for (const x of [0.5, 0.25, 0.75]) {
        for (const el of document.elementsFromPoint(window.innerWidth * x, alto - 24)) {
            let n = el;
            while (n && n !== document.body) {
                if (getComputedStyle(n).position === 'fixed') {
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

export default function useAltoLibre(ref, clave, minimo = 420) {
    const [alto, setAlto] = useState(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const medir = () => {
            const arriba = el.getBoundingClientRect().top + window.scrollY;
            setAlto(Math.max(minimo, Math.round(bordeDeAbajo() - arriba - AIRE)));
        };
        medir();
        const tarde = setTimeout(medir, 400); // el dock y las fuentes terminan de acomodarse
        const obs = new ResizeObserver(medir);
        obs.observe(document.body);
        window.addEventListener('resize', medir);
        return () => { clearTimeout(tarde); obs.disconnect(); window.removeEventListener('resize', medir); };
    }, [ref, clave, minimo]);
    return alto;
}
