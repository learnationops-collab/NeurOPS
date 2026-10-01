// Estrategia del laboratorio guardada en el navegador, una por embudo: así lo que se edita en el
// constructor se prueba enseguida en la página de reserva. Es solo una comodidad de las pantallas de
// prueba; la estrategia real va a vivir en sched_strategies.

import { ESTRATEGIA_BASE } from './mockData';

const clave = (funnelId) => `agendas_v2_lab_estrategia_${funnelId}`;

export function cargarEstrategia(funnelId) {
    try {
        const raw = localStorage.getItem(clave(funnelId));
        if (raw) return JSON.parse(raw);
    } catch { /* sin storage: se usa la base */ }
    return structuredClone(ESTRATEGIA_BASE);
}

export function guardarEstrategia(funnelId, estrategia) {
    try { localStorage.setItem(clave(funnelId), JSON.stringify(estrategia)); } catch { /* sin storage */ }
}

export function restablecerEstrategia(funnelId) {
    try { localStorage.removeItem(clave(funnelId)); } catch { /* sin storage */ }
    return structuredClone(ESTRATEGIA_BASE);
}
