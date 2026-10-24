import { useCallback, useState } from 'react';

/**
 * Las capas de Variabilidad: lo que se superpone a la serie diaria. Son globales a la pestaña —no
 * una por panel— por la misma razón que la vista: comparar dos paneles solo sirve si los dos se
 * están leyendo igual. Apagadas, la pestaña es la serie de siempre.
 *
 * Los textos de `tip` son una sola idea y caben en una línea.
 */
export const CAPAS = [
    { key: 'comparar', label: 'Comparar', tip: 'Superpone el período anterior, día contra día.' },
    { key: 'atipicos', label: 'Picos y caídas', tip: 'Marca los días que salen de la banda normal.' },
    { key: 'tendencia', label: 'Tendencia', tip: 'Media móvil, acumulado y ritmo del período.' },
    { key: 'personas', label: 'Personas', tip: 'Reparte cada día entre quienes lo explican.' },
];

export const REFERENCIAS = [
    { key: 'previo', label: 'Período anterior' },
    { key: 'semana', label: 'Semana anterior' },
];

// Comparar y marcar lo atípico vienen prendidos: son lo que el director pidió ver primero. La
// tendencia y las personas agregan capas de lectura y arrancan apagadas para no saturar.
const INICIAL = { comparar: true, atipicos: true, tendencia: false, personas: false };
const CLAVE = 'neurops.variabilidad.capas';

const leer = () => {
    try {
        const guardado = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
        return guardado && typeof guardado === 'object' ? { ...INICIAL, ...guardado } : INICIAL;
    } catch {
        // Sin almacenamiento (ventana privada, bloqueado) la pestaña anda igual, sin recordar.
        return INICIAL;
    }
};

/** Las capas prendidas y la referencia elegida; se recuerdan en este navegador. */
export const useCapas = () => {
    const [estado, setEstado] = useState(() => ({ ...leer(), referencia: leer().referencia || 'previo' }));

    const poner = useCallback((cambio) => setEstado(actual => {
        const nuevo = { ...actual, ...cambio };
        try {
            window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
        } catch {
            // Recordar es una comodidad: no poder no es un error que mostrar.
        }
        return nuevo;
    }), []);

    const alternar = useCallback((key) => setEstado(actual => {
        const nuevo = { ...actual, [key]: !actual[key] };
        try {
            window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
        } catch {
            // ídem
        }
        return nuevo;
    }), []);

    return { capas: estado, alternar, poner };
};
