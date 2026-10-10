// El `data-theme` de lo que va adentro de una hoja (HojaModal) con las clases de Thalamus: Configuración
// y Simular a alguien. Con tema elegido, el modo del tema (y la hoja lo sigue, components/ui/hoja-modal.css).
// Sin tema, el modo de la hoja que las contiene y no el de la página: en el estilo glass la hoja
// (.bg-surface) es navy aunque la app esté en claro (Elegant Blue), y con el modo de la clase `dark` el
// texto salía oscuro sobre oscuro. Se decide por el color del texto de la hoja: si es claro, el fondo es
// oscuro.

import { useLayoutEffect, useRef, useState } from 'react';
import { dataThemeDe, useApariencia } from '../context/AparienciaContext';

const temaApp = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

function temaDeLaHoja(nodo) {
    const hoja = nodo?.closest('.bg-surface');
    const rgb = hoja && getComputedStyle(hoja).color.match(/\d+(\.\d+)?/g);
    if (!rgb || rgb.length < 3) return temaApp();
    const [r, g, b] = rgb.map(Number);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? 'dark' : 'light';
}

/** [ref para el contenedor, su data-theme]. */
export function useTemaDeHoja() {
    const raiz = useRef(null);
    const apariencia = useApariencia();
    const [temaHoja, setTemaHoja] = useState(temaApp);
    useLayoutEffect(() => { setTemaHoja(temaDeLaHoja(raiz.current)); }, []);
    return [raiz, dataThemeDe(apariencia, temaHoja)];
}
