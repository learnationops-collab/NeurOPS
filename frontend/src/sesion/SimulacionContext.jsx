// La hoja «Simular a alguien» (Simular.jsx), una sola para toda la app. Se abre con `abrirSimulacion()`
// (sesion/simulacion.js) desde cualquier lado: la opción del menú de sesión, la tecla «w» de cada
// pantalla o la píldora de MainLayout. Si la persona no puede simular, no hace nada.

import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { puedeSimular, registrarSimulacion } from './simulacion';
import Simular from './Simular';

export function SimulacionProvider({ children }) {
    const { user } = useAuth();
    const [abierta, setAbierta] = useState(false);
    const puede = puedeSimular(user);
    useEffect(() => registrarSimulacion(() => { if (puede) setAbierta(true); }), [puede]);
    return (
        <>
            {children}
            {abierta && puede && <Simular onCerrar={() => setAbierta(false)} />}
        </>
    );
}
