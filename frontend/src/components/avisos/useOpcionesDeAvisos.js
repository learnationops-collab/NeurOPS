import { Bell } from 'lucide-react';
import { abrirAvisos, useAvisosSinLeer } from '../../utils/avisosBus';

/** La opción «Avisos» del menú de sesión (`MenuSesion` la agrega sola a todos los docks), con la cuenta. */
export default function useOpcionesDeAvisos() {
    const sinLeer = useAvisosSinLeer();
    return {
        sinLeer,
        opciones: [{
            id: 'avisos',
            label: 'Avisos',
            Icono: Bell,
            cuenta: sinLeer || null,
            titulo: sinLeer ? `${sinLeer} ${sinLeer === 1 ? 'aviso sin leer' : 'avisos sin leer'}` : undefined,
            onClick: abrirAvisos,
        }],
    };
}
