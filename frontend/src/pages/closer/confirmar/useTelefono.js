// Si la pantalla es de teléfono (≤ 720 px, el mismo corte del CSS de Confirmar) y se actualiza al girarlo.
import { useEffect, useState } from 'react';

const CONSULTA = '(max-width: 720px)';

export function useTelefono() {
    const [telefono, setTelefono] = useState(() => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches);
    useEffect(() => {
        const mq = window.matchMedia(CONSULTA);
        const cambio = () => setTelefono(mq.matches);
        mq.addEventListener('change', cambio);
        return () => mq.removeEventListener('change', cambio);
    }, []);
    return telefono;
}
