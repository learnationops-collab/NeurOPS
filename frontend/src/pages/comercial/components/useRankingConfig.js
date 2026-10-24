import { useCallback, useMemo, useState } from 'react';
import { loadSession } from '../../../utils/sessionStore';
import { CONFIG_BASE, normalizar } from './rankingConfig';

/**
 * La configuración del ranking de una persona, guardada en su navegador (sin backend).
 *
 * La clave lleva el usuario y el rol que se compara (closers / setters): cada uno tiene la suya, y
 * en una pestaña de simulación (sessionStorage) la clave es la de quien se simula. El storage puede
 * fallar o venir vacío (ventana privada, datos bloqueados): se lee y se escribe siempre con
 * try/catch y la pantalla anda igual con la configuración base.
 */

const usuarioActual = () => {
    try {
        return loadSession()?.id ?? 'anon';
    } catch {
        return 'anon';
    }
};

const claveDe = (rol) => (rol ? `ln:ranking:v1:${usuarioActual()}:${rol}` : null);

const leer = (clave) => {
    if (!clave) return CONFIG_BASE;
    try {
        const crudo = localStorage.getItem(clave);
        return crudo ? normalizar(JSON.parse(crudo)) : CONFIG_BASE;
    } catch {
        return CONFIG_BASE;
    }
};

const escribir = (clave, config) => {
    if (!clave) return;
    try {
        localStorage.setItem(clave, JSON.stringify(config));
    } catch {
        // Sin storage la configuración dura hasta recargar: no es un error para quien mira.
    }
};

/** `[config, cambiar, restablecer]`. `cambiar` recibe la configuración completa. */
export const useRankingConfig = (rol) => {
    const clave = claveDe(rol);
    const [guardado, setGuardado] = useState({ clave, config: leer(clave) });
    // El rol llega con los datos: la primera vez es null y después closers o setters.
    const config = useMemo(
        () => (guardado.clave === clave ? guardado.config : leer(clave)),
        [guardado, clave],
    );

    const cambiar = useCallback((siguiente) => {
        const limpia = normalizar(siguiente);
        escribir(clave, limpia);
        setGuardado({ clave, config: limpia });
    }, [clave]);

    const restablecer = useCallback(() => {
        try {
            if (clave) localStorage.removeItem(clave);
        } catch {
            // Igual que al escribir: se vuelve a la base en pantalla.
        }
        setGuardado({ clave, config: CONFIG_BASE });
    }, [clave]);

    return [config, cambiar, restablecer];
};
