import { useCallback, useMemo, useRef } from 'react';
import { useEstadoGuardado } from '../../../../hooks/useEstadoGuardado';
import {
    COLUMNAS_TABLA, GRUPOS, OCULTAS_INICIALES, PRESETS, acotar, anchoDe, columnasEnOrden, mismaVista, moverColumna,
    piezasDeLaTabla, soltarColumna,
} from './columnasTabla';

/**
 * La vista de columnas de Rendimiento, recordada POR USUARIO (`useEstadoGuardado`; antes era por navegador):
 * cuáles se ocultan, en qué orden van, qué grupos van juntos en una sola columna, el ancho de cada una
 * (ver `columnasTabla.js`) y las vistas que se guardaron con nombre. Como `useColumnasVisibles`, se guardan
 * las OCULTAS: una columna nueva aparece sola.
 */
const CLAVE = 'mk_rendimiento_columnas';
const MAXIMO_DE_VISTAS = 8;
const VERSION = 2;

const lista = (v) => (Array.isArray(v) ? v.filter((k) => typeof k === 'string') : []);

const vistaGuardada = (p) => (p && typeof p === 'object' && typeof p.nombre === 'string' && p.nombre.trim()
    ? [{ id: String(p.id || p.nombre), nombre: p.nombre.trim().slice(0, 30), ocultas: lista(p.ocultas),
        juntados: lista(p.juntados), orden: lista(p.orden) }] : []);

const INICIAL = {
    v: VERSION, ocultas: OCULTAS_INICIALES, juntados: [], orden: [], anchos: {}, colores: true, vistas: [],
};

// Lo guardado puede venir de otra versión (o de la clave vieja por navegador): se limpia campo a campo.
const normalizar = (m, inicial, g) => {
    // Antes de la v2 no existía el «% de calificación»: queda oculto salvo que se lo pida.
    const ocultas = g.v === VERSION ? lista(g.ocultas) : [...new Set([...lista(g.ocultas), ...OCULTAS_INICIALES])];
    return {
        v: VERSION, ocultas, juntados: lista(g.juntados), orden: lista(g.orden),
        anchos: g.anchos && typeof g.anchos === 'object' && !Array.isArray(g.anchos) ? g.anchos : inicial.anchos,
        colores: g.colores !== false,
        vistas: (Array.isArray(g.vistas) ? g.vistas : []).flatMap(vistaGuardada).slice(0, MAXIMO_DE_VISTAS),
    };
};
const OPCIONES = { normalizar, heredar: CLAVE };

export const useVistaDeColumnas = () => {
    // El guardado lo hace `useEstadoGuardado` en un efecto, no dentro del updater (que React puede repetir).
    const [estado, guardar] = useEstadoGuardado(CLAVE, INICIAL, OPCIONES);

    const piezas = useMemo(() => piezasDeLaTabla(estado.ocultas, estado.juntados, estado.orden),
        [estado.ocultas, estado.juntados, estado.orden]);
    // Todas las columnas, en el orden elegido, para la lista del panel.
    const columnas = useMemo(() => columnasEnOrden(estado.orden), [estado.orden]);

    // Al menos una métrica queda a la vista: una tabla con solo nombres no dice nada.
    const alternarColumna = useCallback((key) => guardar(({ ocultas }) => {
        if (ocultas.includes(key)) return { ocultas: ocultas.filter((k) => k !== key) };
        return ocultas.length >= COLUMNAS_TABLA.length - 1 ? {} : { ocultas: [...ocultas, key] };
    }), [guardar]);
    const mover = useCallback((key, delta) => guardar(({ orden }) => ({ orden: moverColumna(orden, key, delta) })), [guardar]);
    const soltar = useCallback((key, destino) => guardar(({ orden }) => ({ orden: soltarColumna(orden, key, destino) })), [guardar]);
    const alternarGrupo = useCallback((key) => guardar(({ juntados }) => ({
        juntados: juntados.includes(key) ? juntados.filter((k) => k !== key) : [...juntados, key],
    })), [guardar]);
    const juntarTodos = useCallback((si) => guardar(() => ({ juntados: si ? GRUPOS.map((g) => g.key) : [] })), [guardar]);
    const restablecer = useCallback(() => guardar(() => ({ ocultas: OCULTAS_INICIALES, juntados: [], orden: [], anchos: {} })), [guardar]);
    // Los colores contra el promedio (`tonos.js`): prendidos de entrada.
    const alternarColores = useCallback(() => guardar(({ colores }) => ({ colores: !colores })), [guardar]);

    // Una vista hecha o guardada: cambia columnas, orden y grupos; los anchos se dejan como están.
    const aplicar = useCallback((v) => guardar(() => ({ ocultas: [...v.ocultas], juntados: [...v.juntados], orden: [...v.orden] })), [guardar]);
    const guardarVista = useCallback((nombre) => guardar(({ vistas, ocultas, juntados, orden }) => {
        const limpio = String(nombre || '').trim().slice(0, 30);
        if (!limpio) return {};
        const nueva = { id: limpio.toLowerCase(), nombre: limpio, ocultas, juntados, orden: columnasEnOrden(orden).map((c) => c.key) };
        const resto = vistas.filter((x) => x.id !== nueva.id);
        return { vistas: [...resto, nueva].slice(-MAXIMO_DE_VISTAS) };
    }), [guardar]);
    const borrarVista = useCallback((id) => guardar(({ vistas }) => ({ vistas: vistas.filter((x) => x.id !== id) })), [guardar]);

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
    const personalizada = !mismaVista(estado, PRESETS[0]) || Object.keys(estado.anchos).length > 0;
    // Cuál de las vistas (hechas o guardadas) es la que se está viendo, si alguna.
    const activa = [...PRESETS, ...estado.vistas].find((v) => mismaVista(estado, v))?.id || null;

    return {
        piezas, columnas, ocultas: estado.ocultas, juntados: estado.juntados, ancho, ponerAncho, personalizada,
        colores: estado.colores, alternarColores, vistas: estado.vistas, activa,
        alternarColumna, mover, soltar, alternarGrupo, juntarTodos, restablecer, aplicar, guardarVista, borrarVista,
        arrastre: { empezar: empezarArrastre, mover: moverArrastre, soltar: soltarArrastre },
    };
};

export default useVistaDeColumnas;
