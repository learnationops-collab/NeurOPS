import { useCallback, useMemo, useRef, useState } from 'react';
import { COLUMNAS } from './metricas';
import { GRUPOS, acotar, anchoDe, piezasDeLaTabla } from './columnasTabla';

/**
 * La vista de columnas de Rendimiento, recordada en este navegador: cuáles se ocultan, qué grupos van
 * juntos en una sola columna y el ancho de cada una (ver `columnasTabla.js`). Como `useColumnasVisibles`,
 * se guardan las OCULTAS: una columna nueva aparece sola.
 */
const CLAVE = 'mk_rendimiento_columnas';

const leer = () => {
    try {
        const v = JSON.parse(window.localStorage.getItem(CLAVE) || 'null');
        return v && typeof v === 'object' ? v : {};
    } catch {
        return {};
    }
};

const lista = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []);

export const useVistaDeColumnas = () => {
    const [estado, setEstado] = useState(() => {
        const g = leer();
        const anchos = g.anchos && typeof g.anchos === 'object' ? g.anchos : {};
        return { ocultas: lista(g.ocultas), juntados: lista(g.juntados), anchos, colores: g.colores !== false };
    });
    const guardar = useCallback((cambio) => setEstado((prev) => {
        const nuevo = { ...prev, ...cambio(prev) };
        try {
            window.localStorage.setItem(CLAVE, JSON.stringify(nuevo));
        } catch {
            // Sin almacenamiento la vista no se recuerda; la tabla sigue andando.
        }
        return nuevo;
    }), []);

    const piezas = useMemo(() => piezasDeLaTabla(estado.ocultas, estado.juntados), [estado.ocultas, estado.juntados]);

    // Al menos una métrica queda a la vista: una tabla con solo nombres no dice nada.
    const alternarColumna = useCallback((key) => guardar(({ ocultas }) => {
        if (ocultas.includes(key)) return { ocultas: ocultas.filter((k) => k !== key) };
        return ocultas.length >= COLUMNAS.length - 1 ? {} : { ocultas: [...ocultas, key] };
    }), [guardar]);
    const alternarGrupo = useCallback((key) => guardar(({ juntados }) => ({
        juntados: juntados.includes(key) ? juntados.filter((k) => k !== key) : [...juntados, key],
    })), [guardar]);
    const juntarTodos = useCallback((si) => guardar(() => ({ juntados: si ? GRUPOS.map((g) => g.key) : [] })), [guardar]);
    const restablecer = useCallback(() => guardar(() => ({ ocultas: [], juntados: [], anchos: {} })), [guardar]);
    // Los colores contra el promedio (`tonos.js`): prendidos de entrada.
    const alternarColores = useCallback(() => guardar(({ colores }) => ({ colores: !colores })), [guardar]);

    const ponerAncho = useCallback((key, px) => guardar(({ anchos }) => {
        const resto = { ...anchos };
        delete resto[key];
        return { anchos: px == null ? resto : { ...resto, [key]: acotar(px) } };
    }), [guardar]);

    // Arrastrar el borde derecho del encabezado: el ancho sigue al puntero mientras se arrastra.
    const arrastre = useRef(null);
    const empezarArrastre = useCallback((key, e) => {
        const th = e.currentTarget.closest('th');
        if (!th) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture?.(e.pointerId);
        arrastre.current = { key, x: e.clientX, ancho: th.getBoundingClientRect().width };
    }, []);
    const moverArrastre = useCallback((e) => {
        const a = arrastre.current;
        if (a) ponerAncho(a.key, a.ancho + e.clientX - a.x);
    }, [ponerAncho]);
    const soltarArrastre = useCallback(() => { arrastre.current = null; }, []);

    const ancho = useCallback((key) => anchoDe(key, estado.anchos), [estado.anchos]);
    const personalizada = estado.ocultas.length > 0 || estado.juntados.length > 0 || Object.keys(estado.anchos).length > 0;

    return {
        piezas, ocultas: estado.ocultas, juntados: estado.juntados, ancho, ponerAncho, personalizada,
        colores: estado.colores, alternarColores,
        alternarColumna, alternarGrupo, juntarTodos, restablecer,
        arrastre: { empezar: empezarArrastre, mover: moverArrastre, soltar: soltarArrastre },
    };
};

export default useVistaDeColumnas;
