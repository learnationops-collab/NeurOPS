import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { loadSession } from '../../utils/sessionStore';

// Punto de entrada de una pestaña de simulación aislada (clic derecho sobre "Simular" ->
// se abre esta ruta con el token en la URL). El propio token ya se guardó en sessionStorage
// de forma síncrona en main.jsx, ANTES de que React montara nada, y la URL ya llegó aquí sin
// el token/usuario, solo con "next" - ver el bootstrap en main.jsx.
//
// "next" se captura UNA sola vez con un inicializador perezoso de useState, no leyendo
// window.location.search directo dentro del useEffect: en desarrollo, StrictMode invoca el
// efecto dos veces (monta -> limpia -> vuelve a montar) y la primera pasada ya navegó a
// "next", así que para la segunda pasada window.location.search ya no es el original - leerlo
// de nuevo ahí adentro terminaba navegando por segunda vez, esta vez al fallback "/publico".
//
// setUser() se llama directo (en vez de esperar al useEffect propio de AuthProvider) porque
// React monta los efectos de hijos ANTES que los del padre: si este componente navegara a
// "next" sin más, ProtectedRoute podía llegar a evaluarse todavía con el user=null inicial de
// AuthProvider y mandar a /login antes de que el efecto de AuthProvider asentara el usuario real.
const SessionEntry = () => {
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const [next] = useState(() => new URLSearchParams(window.location.search).get('next') || '/publico');

    useEffect(() => {
        const savedUser = loadSession();
        if (savedUser) setUser(savedUser);
        navigate(next, { replace: true });
    }, [navigate, setUser, next]);

    return null;
};

export default SessionEntry;
