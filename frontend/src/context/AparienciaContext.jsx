// La apariencia de la app, con los temas únicos de Learnation (ADR-W167, iguales en Academy y Leadership):
// un tema (temas/temas.css y temas/temas-unicos.css) y su modo, claro, oscuro o el del equipo. Van a <html>
// como `data-tema` y `data-tema-modo`, junto con los ajustes: `data-efectos` (humo y vidrio), `data-liviano`
// (sin movimiento; se prende solo al simular) y el tamaño de letra.
//
// Se guarda en el navegador y en la cuenta (como el dock: sesion/dockServidor.js, parte «apariencia»), así
// otra compu arranca igual. Sin elegir tema no hay tema: <html> no lleva `data-tema` y cada pantalla se ve
// como siempre. Sin sesión (login, páginas públicas) no se aplica.

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { avisarCambio, registrarParte } from '../sesion/dockServidor';
import '../temas/temas.css';
import '../temas/temas-unicos.css';
import '../temas/tailwind.css';
import '../temas/puente.css';

export const TEMAS = [
    { id: 'learnation', nombre: 'Learnation', descripcion: 'Navy y magenta, con humo' },
    { id: 'solido', nombre: 'Sólido', descripcion: 'Pizarra, sin vidrio' },
    { id: 'relampago', nombre: 'Relámpago', descripcion: 'Índigo y cian' },
    { id: 'puro', nombre: 'Puro', descripcion: 'Negro y blanco, máximo contraste' },
];
export const MODOS = [{ id: 'oscuro', nombre: 'Oscuro' }, { id: 'claro', nombre: 'Claro' }, { id: 'sistema', nombre: 'Como el equipo' }];
export const LETRAS = [{ id: '90', nombre: 'A−' }, { id: '100', nombre: 'A' }, { id: '112', nombre: 'A+' }];
export const VISTAS = [{ id: 'pestanas', nombre: 'Pestañas' }, { id: 'baldosas', nombre: 'Baldosas' }];
const CLAVE = 'app-tema';
export const puedeElegirTema = (rol) => Boolean(rol);

const esTema = (id) => TEMAS.some(t => t.id === id);
const esModo = (id) => MODOS.some(m => m.id === id);
// Lo guardado antes: los temas viejos («closing», «thalamus», Classic y Modern) son Learnation.
const ANTERIORES = { closing: 'learnation', thalamus: 'learnation', classic: 'learnation', modern: 'learnation' };
const temaDe = (id) => (esTema(id) ? id : ANTERIORES[id] || null);
const BASE = { tema: null, modo: 'oscuro', efectos: true, liviano: false, letra: '100', vista: 'pestanas' };

function normalizar(crudo) {
    const v = { ...BASE, ...(crudo && typeof crudo === 'object' ? crudo : {}) };
    return {
        tema: temaDe(v.tema), modo: esModo(v.modo) ? v.modo : 'oscuro', efectos: v.efectos !== false, liviano: v.liviano === true,
        letra: LETRAS.some(l => l.id === String(v.letra)) ? String(v.letra) : '100', vista: VISTAS.some(x => x.id === v.vista) ? v.vista : 'pestanas',
    };
}
function leer() {
    try {
        const crudo = localStorage.getItem(CLAVE);
        if (!crudo) return BASE;
        if (!crudo.startsWith('{')) {
            const [viejo, modo] = crudo.split('-');
            return normalizar({ tema: viejo, modo });
        }
        return normalizar(JSON.parse(crudo));
    } catch {
        return BASE;
    }
}
function escribirLocal(valor) {
    try { localStorage.setItem(CLAVE, JSON.stringify(valor)); } catch { /* sin storage: dura hasta recargar */ }
}

// La parte «apariencia» de las preferencias de la cuenta. `alHidratar` lo pone el provider montado.
let alHidratar = null;
registrarParte('apariencia', {
    leer: () => leer(),
    escribir: (_userId, valor) => { const v = normalizar(valor); escribirLocal(v); alHidratar?.(v); },
});

const oscuroDelEquipo = () => !window.matchMedia?.('(prefers-color-scheme: light)').matches;
function useModoDelEquipo() {
    const [oscuro, setOscuro] = useState(oscuroDelEquipo);
    useEffect(() => {
        const mq = window.matchMedia?.('(prefers-color-scheme: light)');
        if (!mq) return undefined;
        const cambio = () => setOscuro(!mq.matches);
        mq.addEventListener('change', cambio);
        return () => mq.removeEventListener('change', cambio);
    }, []);
    return oscuro ? 'oscuro' : 'claro';
}

const AparienciaContext = createContext({
    tema: null, modo: null, modoGuardado: 'oscuro', elegido: false, ajustes: BASE,
    setTema: () => {}, setModo: () => {}, setAjuste: () => {}, temas: TEMAS, modos: MODOS,
});

export function AparienciaProvider({ children }) {
    const { user } = useAuth();
    const [guardado, setGuardado] = useState(leer);
    useEffect(() => { alHidratar = setGuardado; return () => { alHidratar = null; }; }, []);
    const delEquipo = useModoDelEquipo();
    const habilitado = puedeElegirTema(user?.role) && guardado.tema !== null;
    const tema = habilitado ? guardado.tema : null;
    const modo = habilitado ? (guardado.modo === 'sistema' ? delEquipo : guardado.modo) : null;
    const liviano = guardado.liviano || Boolean(user?.is_impersonating);

    useLayoutEffect(() => {
        const raiz = document.documentElement;
        if (tema) {
            Object.assign(raiz.dataset, { tema, temaModo: modo, efectos: guardado.efectos && !liviano ? 'si' : 'no', liviano: liviano ? 'si' : 'no' });
            raiz.style.fontSize = guardado.letra === '100' ? '' : `${guardado.letra}%`;
        } else {
            ['tema', 'temaModo', 'efectos', 'liviano'].forEach(k => delete raiz.dataset[k]);
            raiz.style.fontSize = '';
        }
    }, [tema, modo, guardado.efectos, guardado.letra, liviano]);

    const guardar = useCallback((cambiar) => {
        setGuardado(prev => {
            const nuevo = normalizar(cambiar(prev));
            escribirLocal(nuevo);
            setTimeout(() => avisarCambio('apariencia', user?.id), 0);
            return nuevo;
        });
    }, [user?.id]);
    const setTema = useCallback((id) => { if (esTema(id)) guardar(prev => ({ ...prev, tema: id })); }, [guardar]);
    // El modo siempre es de un tema: elegirlo sin tema elegido pone Learnation.
    const setModo = useCallback((id) => { if (esModo(id)) guardar(prev => ({ ...prev, tema: prev.tema ?? 'learnation', modo: id })); }, [guardar]);
    const setAjuste = useCallback((clave, valor) => guardar(prev => ({ ...prev, tema: prev.tema ?? 'learnation', [clave]: valor })), [guardar]);

    const valor = useMemo(
        () => ({ tema, modo, modoGuardado: guardado.modo, elegido: tema !== null, ajustes: { ...guardado, liviano }, livianoPorSimular: Boolean(user?.is_impersonating),
            setTema, setModo, setAjuste, temas: TEMAS, modos: MODOS }),
        [tema, modo, guardado, liviano, user?.is_impersonating, setTema, setModo, setAjuste],
    );
    return <AparienciaContext.Provider value={valor}>{children}</AparienciaContext.Provider>;
}

export const useApariencia = () => useContext(AparienciaContext);

// El `data-theme` de las piezas de Thalamus: con tema elegido, su modo; si no, `respaldo` (lo que cada
// una decidía antes).
export const dataThemeDe = ({ elegido, modo }, respaldo) => (elegido ? (modo === 'claro' ? 'light' : 'dark') : respaldo);
