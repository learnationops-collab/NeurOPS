// La apariencia de la app, como en academy: un tema (temas/temas.css) y su modo, claro u oscuro. Van
// a <html> como `data-tema` y `data-tema-modo`, y se guardan en este navegador.
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
import '../temas/tailwind.css';
import '../temas/puente.css';

export const TEMAS = [
    { id: 'classic', nombre: 'Learnation Classic', descripcion: 'El de siempre del closer' },
    { id: 'modern', nombre: 'Learnation Modern', descripcion: 'El de Agendamiento' },
];
export const MODOS = [{ id: 'oscuro', nombre: 'Oscuro' }, { id: 'claro', nombre: 'Claro' }];
const CLAVE = 'app-tema';
// Quiénes ven el selector: los roles con todas sus pantallas ya leyendo los temas (el closer, desde
// que el mazo los lee).
const ROLES_CON_TEMA = ['admin', 'director_comercial', 'closer'];
export const puedeElegirTema = (rol) => ROLES_CON_TEMA.includes(rol);

const esTema = (id) => TEMAS.some(t => t.id === id);
const esModo = (id) => MODOS.some(m => m.id === id);
// Lo guardado antes de que el modo fuera aparte ("closing-oscuro", "thalamus-claro") se traduce.
const ANTERIORES = { closing: 'classic', thalamus: 'modern' };
const NADA = { tema: null, modo: 'oscuro' };

function leer() {
    try {
        const crudo = localStorage.getItem(CLAVE);
        if (!crudo) return NADA;
        if (!crudo.startsWith('{')) {
            const [viejo, modo] = crudo.split('-');
            return esTema(ANTERIORES[viejo]) && esModo(modo) ? { tema: ANTERIORES[viejo], modo } : NADA;
        }
        const { tema, modo } = JSON.parse(crudo);
        return { tema: esTema(tema) ? tema : null, modo: esModo(modo) ? modo : 'oscuro' };
    } catch {
        return NADA;
    }
}

const AparienciaContext = createContext({
    tema: null, modo: null, modoGuardado: 'oscuro', elegido: false, setTema: () => {}, setModo: () => {}, temas: TEMAS, modos: MODOS,
});

export function AparienciaProvider({ children }) {
    const { user } = useAuth();
    const [guardado, setGuardado] = useState(leer);
    const habilitado = puedeElegirTema(user?.role) && guardado.tema !== null;
    const tema = habilitado ? guardado.tema : null;
    const modo = habilitado ? guardado.modo : null;

    useLayoutEffect(() => {
        const raiz = document.documentElement;
        if (tema) { raiz.dataset.tema = tema; raiz.dataset.temaModo = modo; }
        else { delete raiz.dataset.tema; delete raiz.dataset.temaModo; }
    }, [tema, modo]);

    const guardar = useCallback((cambiar) => {
        setGuardado(prev => {
            const nuevo = cambiar(prev);
            try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* sin storage: dura hasta recargar */ }
            return nuevo;
        });
    }, []);
    const setTema = useCallback((id) => { if (esTema(id)) guardar(prev => ({ ...prev, tema: id })); }, [guardar]);
    // El modo siempre es de un tema: elegirlo sin tema elegido pone Classic.
    const setModo = useCallback((id) => { if (esModo(id)) guardar(prev => ({ tema: prev.tema ?? 'classic', modo: id })); }, [guardar]);

    const valor = useMemo(
        () => ({ tema, modo, modoGuardado: guardado.modo, elegido: tema !== null, setTema, setModo, temas: TEMAS, modos: MODOS }),
        [tema, modo, guardado.modo, setTema, setModo],
    );
    return <AparienciaContext.Provider value={valor}>{children}</AparienciaContext.Provider>;
}

export const useApariencia = () => useContext(AparienciaContext);

// El `data-theme` de las piezas de Thalamus: con tema elegido, su modo; si no, `respaldo` (lo que cada
// una decidía antes).
export const dataThemeDe = ({ elegido, modo }, respaldo) => (elegido ? (modo === 'claro' ? 'light' : 'dark') : respaldo);
