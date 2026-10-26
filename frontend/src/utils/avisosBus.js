import { useSyncExternalStore } from 'react';

// La campanita (docs/plan_notas_avisos_settings.md, etapa 3), igual que los reportes (bugReportBus.js):
// `CentroDeAvisos` (montado una vez en App) sondea la cuenta y dibuja la lista; los menús de sesión de
// todos los docks leen la cuenta de acá y le piden abrir la lista con AVISOS_EVENT.
export const AVISOS_EVENT = 'neurops:abrir-avisos';

export const abrirAvisos = () => window.dispatchEvent(new CustomEvent(AVISOS_EVENT));

let estado = { sinLeer: 0 };
const oyentes = new Set();

export function publicarSinLeer(sinLeer) {
    if (sinLeer === estado.sinLeer) return;
    estado = { sinLeer };
    oyentes.forEach((avisar) => avisar());
}

const suscribir = (avisar) => {
    oyentes.add(avisar);
    return () => oyentes.delete(avisar);
};

export const useAvisosSinLeer = () => useSyncExternalStore(suscribir, () => estado, () => estado).sinLeer;
