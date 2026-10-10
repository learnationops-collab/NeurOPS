// La apariencia de la app: un tema de una lista plana (temas/temas.css). Cada tema ya trae su modo
// claro u oscuro, así que no hay que combinar nada ni adivinarlo mirando colores. El tema elegido va
// a `data-tema` en <html> y se guarda en este navegador.
//
// Sin elegir no hay tema: <html> no lleva `data-tema` y cada pantalla se ve como siempre (sus
// variables caen a su valor de hoy). Convive así con el ThemeContext viejo (elegant/clean/custom ×
// glass/solid) mientras se migran las pantallas.
//
// El tema se guarda por navegador pero se aplica solo si el rol de la sesión puede elegirlo: un admin
// que eligió uno y simula a un closer en el mismo navegador ve al closer como lo ve el closer.

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import '../temas/temas.css';

export const TEMAS = [
    { id: 'closing-oscuro', nombre: 'Closing', modo: 'oscuro' },
    { id: 'thalamus-oscuro', nombre: 'Thalamus', modo: 'oscuro' },
    { id: 'thalamus-claro', nombre: 'Thalamus', modo: 'claro' },
];
const CLAVE = 'app-tema';
// Quiénes ven el selector: los roles con todas sus pantallas ya leyendo los temas. Al closer se le
// suma cuando el deck esté migrado (hoy cambiarían la Ficha y el Dock, pero no el deck).
const ROLES_CON_TEMA = ['admin', 'director_comercial'];
export const puedeElegirTema = (rol) => ROLES_CON_TEMA.includes(rol);

const existe = (id) => TEMAS.some(t => t.id === id);
function leerTema() {
    try {
        const guardado = localStorage.getItem(CLAVE);
        return existe(guardado) ? guardado : null;
    } catch {
        return null;
    }
}
const modoDe = (id) => TEMAS.find(t => t.id === id)?.modo ?? null;

const AparienciaContext = createContext({ tema: null, modo: null, elegido: false, setTema: () => {}, temas: TEMAS });

export function AparienciaProvider({ children }) {
    const { user } = useAuth();
    const [guardado, setTemaEstado] = useState(leerTema);
    const tema = puedeElegirTema(user?.role) ? guardado : null;

    useLayoutEffect(() => {
        const raiz = document.documentElement;
        if (tema) raiz.dataset.tema = tema;
        else delete raiz.dataset.tema;
    }, [tema]);

    const setTema = useCallback((id) => {
        if (!existe(id)) return;
        try { localStorage.setItem(CLAVE, id); } catch { /* sin storage: dura hasta recargar */ }
        setTemaEstado(id);
    }, []);

    const valor = useMemo(() => ({ tema, modo: modoDe(tema), elegido: tema !== null, setTema, temas: TEMAS }), [tema, setTema]);
    return <AparienciaContext.Provider value={valor}>{children}</AparienciaContext.Provider>;
}

export const useApariencia = () => useContext(AparienciaContext);

// El `data-theme` de las piezas de Thalamus: con tema elegido, el modo del tema; si no, `respaldo`
// (lo que cada una decidía antes).
export const dataThemeDe = ({ elegido, modo }, respaldo) => (elegido ? (modo === 'claro' ? 'light' : 'dark') : respaldo);
