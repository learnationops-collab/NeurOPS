// Un desplegable de la tarjeta del lead: abierto o no, y se cierra al tocar afuera o con Escape.
import { useEffect, useRef, useState } from 'react';

export default function useDesplegable() {
    const [abierto, setAbierto] = useState(false);
    const caja = useRef(null);
    useEffect(() => {
        if (!abierto) return undefined;
        const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
        const tecla = (e) => { if (e.key === 'Escape') setAbierto(false); };
        document.addEventListener('mousedown', fuera);
        document.addEventListener('keydown', tecla);
        return () => { document.removeEventListener('mousedown', fuera); document.removeEventListener('keydown', tecla); };
    }, [abierto]);
    return { abierto, setAbierto, caja };
}
