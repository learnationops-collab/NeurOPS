// Las vistas de Confirmar de cada uno (ADR-W201): tipo (tablero, lista o calendario), propiedades, filtro,
// orden y agrupación; el calendario guarda también cuántos días ve y el zoom. Se guardan en la cuenta junto con el dock (`dock_prefs.confirmar`, ADR-W164), así
// otra compu arranca igual; el navegador guarda una copia para leer al instante.
import { useCallback, useSyncExternalStore } from 'react';
import { avisarCambio, registrarParte } from '../../../sesion/dockServidor';

// La clave `semana` queda por las vistas ya guardadas; hoy es el calendario de 1, 2, 3 o 7 días.
export const TIPOS_DE_VISTA = { tablero: 'Tablero', lista: 'Lista', semana: 'Calendario' };
export const DIAS_CALENDARIO = [1, 2, 3, 7];
export const ALTOS_CALENDARIO = [56, 80, 104, 136];
const PROPS_CALENDARIO = ['etapa', 'segmento', 'decision', 'inversion'];
const MAX_VISTAS = 8;
const PARTE = 'confirmar';
const clave = (userId) => `confirmar-vistas:${userId}`;
const filtroVacio = () => ({ closers: [], etapas: [], segmentos: [] });

// Lo que mostraba la tarjeta del tablero antes de las vistas: entrar no cambia nada.
const PROPS_TABLERO = ['hora', 'telefono', 'closer', 'segmento', 'examen', 'avisos', 'inversion', 'decision', 'origen', 'notas_setter'];

export function vistasDeFabrica(esTriage) {
    const base = { orden: 'hora', asc: true, filtro: filtroVacio() };
    const sinCloser = (props) => (esTriage ? props : props.filter(p => p !== 'closer'));
    return [
        { ...base, id: 'etapa', nombre: 'Por etapa', tipo: 'tablero', agrupar: 'etapa', props: sinCloser(PROPS_TABLERO) },
        { ...base, filtro: filtroVacio(), id: 'hora', nombre: esTriage ? 'Por hora' : 'Mis llamadas', tipo: 'lista', agrupar: 'urgencia',
            props: sinCloser(['hora', 'closer', 'etapa', 'segmento', 'avisos', 'inversion', 'decision']) },
        { ...base, filtro: filtroVacio(), id: 'semana', nombre: esTriage ? 'Calendario' : 'Mi calendario', tipo: 'semana', agrupar: 'ninguno',
            dias: 7, alto: 104, cal: 2, props: PROPS_CALENDARIO },
    ];
}

// Una vista que llega del navegador o de la cuenta se completa con lo que le falte; si está rota, no va.
function sana(v) {
    if (!v || typeof v !== 'object' || !TIPOS_DE_VISTA[v.tipo] || typeof v.id !== 'string') return null;
    const f = v.filtro && typeof v.filtro === 'object' ? v.filtro : {};
    const lista = (x) => (Array.isArray(x) ? x.filter(y => typeof y === 'string') : []);
    let nombre = String(v.nombre || TIPOS_DE_VISTA[v.tipo]).slice(0, 40);
    let props = lista(v.props);
    // La «Semana» de fábrica pasó a ser el «Calendario» (25/11/2026).
    if (v.id === 'semana') nombre = { Semana: 'Calendario', 'Mi semana': 'Mi calendario' }[nombre] || nombre;
    // Todo calendario guardado antes de la versión 2 suma etapa, segmento, decisor e inversión adelante, sin
    // sacar lo que la persona había prendido.
    if (v.tipo === 'semana' && !(v.cal >= 2)) props = [...new Set([...PROPS_CALENDARIO, ...props])];
    return {
        id: v.id, tipo: v.tipo, nombre,
        agrupar: typeof v.agrupar === 'string' ? v.agrupar : 'etapa', orden: typeof v.orden === 'string' ? v.orden : 'hora', asc: v.asc !== false,
        props, filtro: { closers: lista(f.closers), etapas: lista(f.etapas), segmentos: lista(f.segmentos) },
        dias: DIAS_CALENDARIO.includes(v.dias) ? v.dias : 7,
        alto: ALTOS_CALENDARIO.includes(v.alto) ? v.alto : 104,
        cal: 2,
    };
}
const sanas = (lista) => {
    const v = Array.isArray(lista) ? lista.map(sana).filter(Boolean).slice(0, MAX_VISTAS) : [];
    return v.length ? v : null;
};

const oyentes = new Set();
const cache = new Map();

function leerNavegador(userId) {
    try { return sanas(JSON.parse(window.localStorage.getItem(clave(userId)) || 'null')); } catch { return null; }
}
function escribir(userId, vistas) {
    cache.set(userId, vistas);
    try { window.localStorage.setItem(clave(userId), JSON.stringify(vistas)); } catch { /* queda en memoria */ }
    oyentes.forEach(fn => fn());
}

// En la cuenta: null mientras no armó ninguna (valen las de fábrica).
registrarParte(PARTE, {
    leer: (userId) => cache.get(userId) ?? leerNavegador(userId),
    escribir: (userId, valor) => { const v = sanas(valor); if (v?.length) escribir(userId, v); },
});

function leer(user, esTriage) {
    const id = user?.id;
    if (cache.has(id)) return cache.get(id);
    // Lo de la cuenta pisa lo del navegador: el módulo puede registrarse después de hidratar el dock.
    const vistas = sanas(user?.dock_prefs?.[PARTE]) || leerNavegador(id) || vistasDeFabrica(esTriage);
    cache.set(id, vistas);
    return vistas;
}

/** Las vistas del usuario y cómo cambiarlas. Cada cambio se guarda en la cuenta. */
export function useVistasConfirmar(user, esTriage) {
    const suscribir = useCallback((fn) => { oyentes.add(fn); return () => oyentes.delete(fn); }, []);
    const vistas = useSyncExternalStore(suscribir, () => leer(user, esTriage));
    const guardar = useCallback((nuevas) => {
        escribir(user?.id, nuevas);
        avisarCambio(PARTE, user?.id);
    }, [user?.id]);

    const actualizar = useCallback((id, cambios) => {
        guardar(vistas.map(v => (v.id === id ? { ...v, ...(typeof cambios === 'function' ? cambios(v) : cambios) } : v)));
    }, [vistas, guardar]);

    const crear = useCallback((tipo) => {
        if (vistas.length >= MAX_VISTAS) return null;
        const molde = vistasDeFabrica(esTriage).find(v => v.tipo === tipo);
        const nueva = { dias: 7, alto: 104, cal: 2, ...molde, filtro: filtroVacio(), id: `v${Date.now().toString(36)}`, nombre: { tablero: 'Tablero nuevo', lista: 'Lista nueva', semana: 'Calendario nuevo' }[tipo] };
        guardar([...vistas, nueva]);
        return nueva.id;
    }, [vistas, guardar, esTriage]);

    const borrar = useCallback((id) => { if (vistas.length > 1) guardar(vistas.filter(v => v.id !== id)); }, [vistas, guardar]);
    const restablecer = useCallback(() => guardar(vistasDeFabrica(esTriage)), [guardar, esTriage]);

    return { vistas, actualizar, crear, borrar, restablecer, puedeCrear: vistas.length < MAX_VISTAS };
}
