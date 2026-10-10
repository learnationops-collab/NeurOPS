// La apariencia de la app: un tema de una lista plana (temas/temas.css). Cada tema ya trae su modo
// claro u oscuro, así que no hay que combinar nada ni adivinarlo mirando colores. El tema elegido va
// a `data-tema` en <html> y se guarda en este navegador.
//
// Convive con el ThemeContext viejo (elegant/clean/custom × glass/solid) mientras se migran las
// pantallas: el tema nuevo solo pinta lo que ya lee sus variables.

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import '../temas/temas.css';

export const TEMAS = [
    { id: 'closing-oscuro', nombre: 'Closing', modo: 'oscuro' },
    { id: 'thalamus-oscuro', nombre: 'Thalamus', modo: 'oscuro' },
    { id: 'thalamus-claro', nombre: 'Thalamus', modo: 'claro' },
];
// El look actual del closer: con este nadie nota el cambio.
export const TEMA_POR_DEFECTO = 'closing-oscuro';
const CLAVE = 'app-tema';

const existe = (id) => TEMAS.some(t => t.id === id);
function leerTema() {
    try {
        const guardado = localStorage.getItem(CLAVE);
        return existe(guardado) ? guardado : TEMA_POR_DEFECTO;
    } catch {
        return TEMA_POR_DEFECTO;
    }
}
const modoDe = (id) => (TEMAS.find(t => t.id === id) || TEMAS[0]).modo;

const AparienciaContext = createContext({ tema: TEMA_POR_DEFECTO, modo: modoDe(TEMA_POR_DEFECTO), setTema: () => {}, temas: TEMAS });

export function AparienciaProvider({ children }) {
    const [tema, setTemaEstado] = useState(leerTema);

    useLayoutEffect(() => { document.documentElement.dataset.tema = tema; }, [tema]);

    const setTema = useCallback((id) => {
        if (!existe(id)) return;
        try { localStorage.setItem(CLAVE, id); } catch { /* sin storage: dura hasta recargar */ }
        setTemaEstado(id);
    }, []);

    const valor = useMemo(() => ({ tema, modo: modoDe(tema), setTema, temas: TEMAS }), [tema, setTema]);
    return <AparienciaContext.Provider value={valor}>{children}</AparienciaContext.Provider>;
}

export const useApariencia = () => useContext(AparienciaContext);
