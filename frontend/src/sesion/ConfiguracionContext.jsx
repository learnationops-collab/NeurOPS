// Abrir «Configuración» desde cualquier pantalla: `useConfiguracion().abrir(pestaña?)`. Desde ADR-W169 es una
// ventana flotante más (ventanas/herramientas.js, `configuracion`): se minimiza al dock y se maximiza como
// las otras. Este contexto solo la abre, la cierra y dice si está abierta.
//
// `?vista=configuracion` en la URL la abre al entrar: es a donde vuelve Google después de conectar el
// calendario y a donde entra Agendamiento cuando simula a un closer para configurarlo. Al cerrarla se
// limpian esos parámetros.

import { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { abrirVentana, cerrarVentana, useVentanas } from '../ventanas/ventanasStore';

const ConfiguracionContext = createContext({ abierta: false, abrir: () => {}, cerrar: () => {} });

const PARAMS_DE_ENTRADA = ['vista', 'google_connected', 'google_error'];
const pideAbrir = () => new URLSearchParams(window.location.search).get('vista') === 'configuracion';
const limpiarUrl = () => {
    if (!pideAbrir()) return;
    const url = new URL(window.location.href);
    PARAMS_DE_ENTRADA.forEach((k) => url.searchParams.delete(k));
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
};

export function ConfiguracionProvider({ children }) {
    const { user } = useAuth();
    const item = useVentanas().find(x => x.key === 'configuracion');
    const abierta = item?.estado === 'abierta';

    const abrir = useCallback((pestana = null) => abrirVentana('configuracion', { tab: pestana }), []);
    const cerrar = useCallback(() => { cerrarVentana('configuracion'); limpiarUrl(); }, []);

    // Volviendo de Google (o entrando con ?vista=configuracion), se abre sola; Configuracion elige Integraciones.
    useEffect(() => {
        if (!user || !pideAbrir()) return;
        abrirVentana('configuracion', { tab: new URLSearchParams(window.location.search).get('google_connected') ? 'google' : null });
        limpiarUrl();
    }, [user]);

    const valor = useMemo(() => ({ abierta, abrir, cerrar }), [abierta, abrir, cerrar]);
    return <ConfiguracionContext.Provider value={valor}>{children}</ConfiguracionContext.Provider>;
}

export const useConfiguracion = () => useContext(ConfiguracionContext);
