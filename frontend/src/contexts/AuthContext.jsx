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
            // Las cuentas vinculadas y los roles se agregaron después del login: una sesión guardada antes
            // no los trae, y nunca se pedían de nuevo. Se refrescan solo ellos; el rol activo sigue siendo el guardado.
            if (!savedUser.is_impersonating) {
                api.get('/auth/me').then((res) => {
                    const me = res.data?.user || {};
                    const cuentas = me.cuentas_vinculadas || [];
                    const roles = me.roles || [];
                    if (JSON.stringify([cuentas, roles]) === JSON.stringify([savedUser.cuentas_vinculadas || [], savedUser.roles || []])) return;
                    const actualizado = { ...savedUser, cuentas_vinculadas: cuentas, roles };
                    saveSession(actualizado);
                    setUser((u) => (u && u.id === actualizado.id ? { ...u, cuentas_vinculadas: cuentas, roles } : u));
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

    const guardar = ({ user: userData, token }) => {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        if (token) {
            localStorage.setItem('auth_token', token);
        }
        return userData;
    };

    const login = async (username, password) => {
        const response = await api.post('/auth/login', { username, password, timezone: browserTimezone() });
        return guardar(response.data);
    };

    // «Entrar con Google»: va a Google y vuelve a /login?google=ok con la sesión de cookie, que
    // completarLoginGoogle canjea por el token (ver app/services/login_google.py).
    const entrarConGoogle = async () => {
        const response = await api.get('/auth/google');
        window.location.href = response.data.auth_url;
    };

    const completarLoginGoogle = async () => {
        const response = await api.post('/auth/google/sesion');
        return guardar(response.data);
    };

    // El usuario sin email lo carga al entrar, para poder entrar con Google la próxima vez.
    const cargarEmail = async (email) => {
        const response = await api.put('/auth/me/email', { email });
        return guardar({ user: { ...user, ...response.data.user } });
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
        entrarConGoogle,
        completarLoginGoogle,
        cargarEmail,
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
