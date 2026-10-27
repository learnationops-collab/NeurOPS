import { useEffect, useState } from 'react';
import { Scale } from 'lucide-react';
import api from '../../services/api';

/** «Conflictos» en el menú de sesión, solo para quien tiene casos abiertos (el responsable o la dirección). */
export default function useOpcionesDeConflictos() {
    const [abiertos, setAbiertos] = useState(0);
    useEffect(() => {
        let vivo = true;
        api.get('/conflictos/cuenta').then(({ data }) => { if (vivo) setAbiertos(data?.abiertos || 0); }).catch(() => {});
        return () => { vivo = false; };
    }, []);
    return {
        abiertos,
        opciones: abiertos ? [{
            id: 'conflictos',
            label: 'Conflictos',
            Icono: Scale,
            cuenta: abiertos,
            titulo: `${abiertos} ${abiertos === 1 ? 'caso abierto' : 'casos abiertos'}`,
            onClick: () => window.location.assign('/conflictos'),
        }] : [],
    };
}
