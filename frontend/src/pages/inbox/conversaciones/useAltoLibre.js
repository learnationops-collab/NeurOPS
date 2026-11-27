// El alto que le queda a la bandeja sin meterse debajo del dock (Mario, 26/11: el dock tapaba la caja del chat).
// Mide dónde arranca la bandeja en la página y dónde empieza lo fijo de abajo (el dock del espacio del setter, el de
// Thalamus o el que sea: lo que esté `fixed` o `sticky` en el borde de abajo). Devuelve [ref, alto]: el ref es una
// función, así mide apenas aparece la bandeja (antes de cargar no está) y vuelve a medir con cada cambio de tamaño.
import { useCallback, useLayoutEffect, useState } from 'react';

const AIRE = 16;
const RESERVA = 112; // lo que ocupa el dock de abajo con su margen, si todavía no se lo encuentra

// Dónde empieza el dock: se lee de su CSS (`bottom` + alto sin transformar), no de dónde se lo ve, porque entra
// animado desde abajo y antes se medía en ese momento (la bandeja terminaba debajo del dock).
function topeDelDock(alto) {
    let tope = null;
    for (const el of document.querySelectorAll('.dock-barra, nav.dock')) {
        const cs = getComputedStyle(el);
        if (cs.position !== 'fixed' || cs.display === 'none' || !el.offsetHeight || el.offsetHeight > alto / 2) continue;
        const top = alto - (parseFloat(cs.bottom) || 0) - el.offsetHeight;
        tope = tope == null ? top : Math.min(tope, top);
    }
    return tope;
}

function bordeDeAbajo() {
    const alto = window.innerHeight;
    let tope = topeDelDock(alto);
    if (tope == null) tope = document.querySelector('.dock-lado') ? alto : alto - RESERVA; // con la barra lateral no hay dock abajo
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
        // El dock puede montarse o cambiar después (fijadas, modo lateral): se vuelve a mirar cada 1,5 s. Es barato y
        // React no redibuja si el alto no cambió.
        const cada = setInterval(medir, 1500);
        const obs = new ResizeObserver(medir);
        obs.observe(document.body);
        window.addEventListener('resize', medir);
        return () => { clearInterval(cada); obs.disconnect(); window.removeEventListener('resize', medir); };
    }, [nodo, minimo]);
    return [ref, alto];
}
