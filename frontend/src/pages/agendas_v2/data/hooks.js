// Hooks de React sobre el almacén de datos y el estado de la interfaz.

import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { almacenThalamus } from './almacen';
import { ui } from '../ui/estadoUi';
import { secOk, modoCloser as _modoCloser, puede as _puede, yoPersona as _yoPersona } from '../core/permisos';

export const almacen = almacenThalamus();

// Estado completo de datos: {cargando, d, perfil, integ, reservas}.
export function useDatos() { return useSyncExternalStore(almacen.subscribe, almacen.getState); }
export function useUi() { return useSyncExternalStore(ui.subscribe, ui.getState); }

// Arranca la carga una vez y escucha cambios de otras pestañas.
export function useIniciarAlmacen() {
    useEffect(() => {
        let fin = null, vivo = true;
        almacen.iniciar().then(f => { if (vivo) fin = f; else if (f) f(); });
        return () => { vivo = false; if (fin) fin(); };
    }, []);
}

// Permisos del rol simulado (sin simulación, todo permitido). `lectura`: la sesión solo mira (el
// setter, lo dice el servidor): puede ver cada sección y nada más.
export function usePermisos() {
    const { d, perfil, lectura } = useDatos();
    const { sim } = useUi();
    return useMemo(() => ({
        sim,
        lectura,
        puede: (k) => (lectura ? k.endsWith('.ver') : _puede(d, sim, k)),
        secOk: (id) => secOk(d, sim, perfil, id),
        yo: _yoPersona(d, sim, perfil),
        modoCloser: _modoCloser(d, sim, perfil),
    }), [d, sim, perfil, lectura]);
}
