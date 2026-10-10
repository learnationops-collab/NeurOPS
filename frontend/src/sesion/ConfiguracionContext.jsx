// Abrir «Configuración» desde cualquier pantalla: `useConfiguracion().abrir()` (lo usa la opción del
// menú de sesión, sesion/menuSesion.js). La hoja vive acá, una sola para toda la app.
//
// `?vista=configuracion` en la URL la abre al entrar: es a donde vuelve Google después de conectar el
// calendario y a donde entra Agendamiento cuando simula a un closer para configurarlo. Al cerrarla se
// limpian esos parámetros.

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import HojaModal from '../components/ui/HojaModal';
import Configuracion from './Configuracion';

const ConfiguracionContext = createContext({ abierta: false, abrir: () => {}, cerrar: () => {} });

const PARAMS_DE_ENTRADA = ['vista', 'google_connected', 'google_error'];
const pideAbrir = () => new URLSearchParams(window.location.search).get('vista') === 'configuracion';

export function ConfiguracionProvider({ children }) {
    const { user } = useAuth();
    const [abierta, setAbierta] = useState(pideAbrir);
    const [tab, setTab] = useState(null);

    const abrir = useCallback((pestana = null) => { setTab(pestana); setAbierta(true); }, []);
    const cerrar = useCallback(() => {
        setAbierta(false);
        if (pideAbrir()) {
            const url = new URL(window.location.href);
            PARAMS_DE_ENTRADA.forEach((k) => url.searchParams.delete(k));
            window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
        }
    }, []);

    const valor = useMemo(() => ({ abierta, abrir, cerrar }), [abierta, abrir, cerrar]);
    return (
        <ConfiguracionContext.Provider value={valor}>
            {children}
            {abierta && user && (
                <HojaModal titulo="Configuración" onCerrar={cerrar} amplia={tab === 'equipo'}>
                    <Configuracion user={user} tabInicial={tab} onTab={setTab} />
                </HojaModal>
            )}
        </ConfiguracionContext.Provider>
    );
}

export const useConfiguracion = () => useContext(ConfiguracionContext);
