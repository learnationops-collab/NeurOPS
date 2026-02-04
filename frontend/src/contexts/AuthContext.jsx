import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Inicializar desde localStorage para evitar parpadeos
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
            setUser(JSON.parse(savedUser));
        }
        setLoading(false);

        // Listen for 401 Unauthorized events from apiInterceptor
        const handleUnauthorized = () => {
            logout();
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);

        return () => {
            window.removeEventListener('auth-unauthorized', handleUnauthorized);
        };
    }, []);

    const login = async (username, password) => {
        const response = await api.post('/auth/login', { username, password });
        const { user: userData, token } = response.data;

        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        if (token) {
            localStorage.setItem('auth_token', token);
        }
        return userData;
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) { /* ignore */ }
        finally {
            setUser(null);
            localStorage.removeItem('user');
            localStorage.removeItem('auth_token');
            if (window.confirm("Sesión Cerrada (401 Unauthorized).\n\nHaz clic en Cancelar para NO recargar y ver los logs.\nHaz clic en Aceptar para ir al login.")) {
                window.location.href = '/login';
            } else {
                console.warn("Logout cancelado por debug. El usuario sigue en estado deslogueado pero en la misma página.");
            }
        }
    };

    const value = {
        user,
        role: user?.role,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        setUser
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
};
