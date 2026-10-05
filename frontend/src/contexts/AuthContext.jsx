import { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../services/api';
import { browserTimezone } from '../utils/datetime';
import { loadSession, saveSession, clearSession } from '../utils/sessionStore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Inicializar desde sessionStorage (pestaña de simulación aislada) o localStorage
        // (flujo normal) para evitar parpadeos - ver utils/sessionStore.js.
        const savedUser = loadSession();
        if (savedUser) {
            setUser(savedUser);
            // Las cuentas vinculadas se agregaron después del login: una sesión guardada antes no las
            // trae, y nunca se pedían de nuevo. Se refrescan solo ellas; el rol sigue siendo el guardado.
            if (!savedUser.is_impersonating) {
                api.get('/auth/me').then((res) => {
                    const cuentas = res.data?.user?.cuentas_vinculadas || [];
                    if (JSON.stringify(cuentas) === JSON.stringify(savedUser.cuentas_vinculadas || [])) return;
                    const actualizado = { ...savedUser, cuentas_vinculadas: cuentas };
                    saveSession(actualizado);
                    setUser((u) => (u && u.id === actualizado.id ? { ...u, cuentas_vinculadas: cuentas } : u));
                }).catch(() => { /* sin cuentas que mostrar: el menú queda como estaba */ });
            }
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
        const response = await api.post('/auth/login', { username, password, timezone: browserTimezone() });
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
            // Limpia solo el store activo de ESTA pestaña (sessionStorage si es una pestaña
            // de simulación aislada, localStorage si es la pestaña normal) - no debe apagar
            // la sesión de otras pestañas simuladas ni la de la pestaña "real".
            clearSession();
            window.location.href = '/login';
        }
    };

    const value = useMemo(() => ({
        user,
        role: user?.role,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        setUser
    }), [user, loading]);

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
