// El Portal (pages/auth/Portal.jsx) es una pantalla que se abre encima de lo que se está viendo, no una
// ruta: este provider la monta, una sola para toda la app, y registra en sesion/portalBus.js cómo
// abrirla (el menú de sesión, la tecla «w», el login). Simular sin poder simular no abre nada.
//
// /portal (y las viejas /inicio y /vistas) siguen andando por los links guardados: llevan a la pantalla
// de su rol con el Portal abierto encima (PortalRuta).

import { useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Portal from '../pages/auth/Portal';
import { destinoDeEntrada } from '../utils/portal';
import { abrirPortal, registrarPortal } from './portalBus';
import { puedeSimular } from './simulacion';

export function PortalProvider({ children }) {
    const { user } = useAuth();
    // { paso, vez }: `vez` cambia en cada apertura para que el Portal arranque de cero. Al iniciar sesión se
    // pide abrirlo antes de que llegue la cuenta nueva: se muestra con la que haya al dibujar.
    const [abierto, setAbierto] = useState(null);
    // Al cerrar sesión se cierra (para que no reaparezca en la próxima entrada).
    const [cuenta, setCuenta] = useState(user?.id ?? null);
    if ((user?.id ?? null) !== cuenta) {
        setCuenta(user?.id ?? null);
        if (!user) setAbierto(null);
    }
    useEffect(() => registrarPortal((paso) => {
        if (paso === 'simular' && !puedeSimular(user)) return;
        setAbierto((a) => ({ paso, vez: (a?.vez || 0) + 1 }));
    }), [user]);
    return (
        <>
            {children}
            {abierto && user && <Portal key={`${abierto.vez}-${user.id}`} user={user} pasoInicial={abierto.paso} onCerrar={() => setAbierto(null)} />}
        </>
    );
}

/** /portal: un link viejo o guardado. Va a la pantalla de su rol y abre el Portal encima. */
export function PortalRuta() {
    const { user } = useAuth();
    const [params] = useSearchParams();
    const paso = params.get('simular') === '1' ? 'simular' : null;
    useEffect(() => { abrirPortal(paso); }, [paso]);
    return <Navigate to={destinoDeEntrada(user)} replace />;
}
