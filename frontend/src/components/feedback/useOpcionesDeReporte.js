import { Bug, History } from 'lucide-react';
import { abrirMisReportes, abrirReporteDeBug, useEstadoDeReportes } from '../../utils/bugReportBus';

/**
 * Las opciones de reporte para un menú de sesión (`MenuSesion` las agrega solo a todos los docks):
 * «Reportar un problema» (o «Continuar reporte en progreso» si quedó uno a medias) y «Mis reportes»,
 * que lleva la cuenta de respuestas sin leer. Reemplazan al botón flotante rosado de antes.
 */
export default function useOpcionesDeReporte() {
    const { sinLeer, enProgreso } = useEstadoDeReportes();
    return {
        sinLeer,
        enProgreso,
        opciones: [
            {
                id: 'reportar-bug',
                label: enProgreso ? 'Continuar reporte en progreso' : 'Reportar un problema',
                Icono: Bug,
                onClick: abrirReporteDeBug,
            },
            {
                id: 'mis-reportes',
                label: 'Mis reportes',
                Icono: History,
                cuenta: sinLeer || null,
                titulo: sinLeer ? `${sinLeer} ${sinLeer === 1 ? 'respuesta sin leer' : 'respuestas sin leer'}` : undefined,
                onClick: abrirMisReportes,
            },
        ],
    };
}
