import { useSyncExternalStore } from 'react';

// Bus de eventos minimo para disparar el widget de reporte de bugs desde
// cualquier punto de la app (ErrorBoundary, interceptor de axios, etc.)
// sin acoplar esos módulos al componente del widget.
export const BUG_REPORT_EVENT = 'neurops:open-bug-report';

// context: { message, status, url, method, stack, autoOpen }
export function triggerBugReport(context = {}) {
    window.dispatchEvent(new CustomEvent(BUG_REPORT_EVENT, { detail: context }));
}

// --- Abrir el reporte a mano, desde el menú del usuario ---
//
// El botón flotante rosado se fue (07/10/2026): ahora «Reportar un problema» y «Mis reportes» son
// opciones del menú de sesión que abre el avatar del dock (ver `MenuSesion`). El widget global sigue
// siendo quien tiene el chat, el historial y el aviso reactivo de errores; las opciones del menú le
// piden que abra una u otra vista con este evento.
export const BUG_REPORT_VISTA_EVENT = 'neurops:bug-report-vista';

const pedirVista = (vista) => window.dispatchEvent(new CustomEvent(BUG_REPORT_VISTA_EVENT, { detail: { vista } }));

/** Abre el chat de reporte (o retoma el que estaba en progreso). */
export const abrirReporteDeBug = () => pedirVista('chat');

/** Abre «Mis reportes», con el historial y las respuestas. */
export const abrirMisReportes = () => pedirVista('historial');

// --- Estado compartido: lo que el menú muestra sobre los reportes ---
//
// `sinLeer`: respuestas a mis reportes que todavía no abrí. `enProgreso`: dejé un reporte a medias
// (minimizado) y se puede retomar. Lo publica el widget (que es quien hace el sondeo) y lo leen los
// menús de sesión de todos los docks.
let estado = { sinLeer: 0, enProgreso: false };
const oyentes = new Set();

export function publicarEstadoDeReportes(parcial) {
    const nuevo = { ...estado, ...parcial };
    if (nuevo.sinLeer === estado.sinLeer && nuevo.enProgreso === estado.enProgreso) return;
    estado = nuevo;
    oyentes.forEach((avisar) => avisar());
}

const suscribir = (avisar) => {
    oyentes.add(avisar);
    return () => oyentes.delete(avisar);
};

export const useEstadoDeReportes = () => useSyncExternalStore(suscribir, () => estado, () => estado);
