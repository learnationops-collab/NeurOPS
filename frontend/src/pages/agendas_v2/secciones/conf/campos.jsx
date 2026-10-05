// Campos de texto de Configuración. Mientras se escribe, el campo muestra lo que se tipea tal cual
// (con espacios al final o vacío); el valor normalizado se guarda aparte. Al salir del campo vuelve
// a mostrar lo guardado.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

export function InputVivo({ valor, onCambio, filtro, ...props }) {
    const [v, setV] = useState(valor);
    const ref = useRef(null);
    useEffect(() => { if (document.activeElement !== ref.current) setV(valor); }, [valor]);
    return (
        <input {...props} ref={ref} value={v}
            onChange={e => { const t = filtro ? filtro(e.target.value) : e.target.value; setV(t); onCambio(t); }}
            onBlur={e => { setV(valor); if (props.onBlur) props.onBlur(e); }} />
    );
}

// Guarda con una pausa (600 ms), como el prototipo, y guarda lo pendiente al desmontar.
export function useDiferido(fn, ms = 600) {
    const t = useRef(null), ult = useRef(null), fnRef = useRef(fn);
    useLayoutEffect(() => { fnRef.current = fn; });
    useEffect(() => () => { if (t.current) { clearTimeout(t.current); fnRef.current(ult.current); } }, []);
    return (x) => {
        ult.current = x;
        clearTimeout(t.current);
        t.current = setTimeout(() => { t.current = null; fnRef.current(x); }, ms);
    };
}
