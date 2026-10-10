import { History, Plus } from 'lucide-react';
import { abrirMisReportes, abrirReporteDeBug, useEstadoDeReportes } from '../../utils/bugReportBus';

/**
 * La opción de reportes para un menú de sesión (`MenuSesion` la agrega sola a todos los docks): «Mis
 * reportes», con la cuenta de respuestas sin leer, y al lado un «+» para reportar un problema nuevo (o
 * continuar el que quedó a medias). Desde el 10/10/2026 es una sola fila; antes eran dos opciones.
 * Reemplazan al botón flotante rosado de antes.
 */
export default function useOpcionesDeReporte() {
    const { sinLeer, enProgreso } = useEstadoDeReportes();
    return {
        sinLeer,
        enProgreso,
        opciones: [
            {
                id: 'mis-reportes',
                label: 'Mis reportes',
                Icono: History,
                cuenta: sinLeer || null,
                titulo: sinLeer ? `${sinLeer} ${sinLeer === 1 ? 'respuesta sin leer' : 'respuestas sin leer'}` : undefined,
                onClick: abrirMisReportes,
                accion: {
                    id: 'reportar-bug',
                    label: enProgreso ? 'Continuar reporte en progreso' : 'Reportar un problema',
                    Icono: Plus,
                    marcada: enProgreso,
                    onClick: abrirReporteDeBug,
                },
            },
        ],
    };
}
