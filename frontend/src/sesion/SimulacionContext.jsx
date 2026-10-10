// La tecla «w» (y la píldora de MainLayout) abren «Simular a alguien», que vive en el Portal
// (/portal?simular=1, pages/auth/SimularEnPortal.jsx). Este provider registra cómo llegar ahí con el
// router (sesion/simulacion.js); si la persona no puede simular, no hace nada.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { puedeSimular, registrarSimulacion, RUTA_SIMULAR } from './simulacion';

export function SimulacionProvider({ children }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const puede = puedeSimular(user);
    useEffect(() => registrarSimulacion(() => { if (puede) navigate(RUTA_SIMULAR); }), [puede, navigate]);
    return children;
}
