import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';

const PlaybookContext = createContext(null);

// Estado global del Playbook (jerarquía Roadmap -> Módulo -> Lección de formación interna).
// Se necesita un contexto (y no un simple estado local) porque el botón que lo abre vive en
// headers distintos según el rol (CloserWorkflowPage tiene el suyo propio; el resto de roles
// lo abre desde el Dock), pero el overlay que muestra el contenido es uno solo, montado una
// única vez en App.jsx -- mismo motivo por el que BugReportWidget vive fuera de MainLayout.
export const PlaybookProvider = ({ children }) => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);
    const [initialView, setInitialView] = useState('pending');
    const [pending, setPending] = useState({ lessons: [], pending_count: 0, new_count: 0 });

    const refreshPending = useCallback(() => {
        if (!user) return;
        api.get('/playbook/pending', { skipBugReport: true })
            .then(res => setPending(res.data))
            .catch(() => { });
    }, [user]);

    useEffect(() => { refreshPending(); }, [refreshPending]);

    const openPlaybook = (view = 'pending') => {
        setInitialView(view);
        setIsOpen(true);
    };
    const closePlaybook = () => setIsOpen(false);

    // Siempre el mismo elemento, con o sin sesión (sin ella, `null`: usePlaybook da el no-op). Antes,
    // sin sesión devolvía un fragmento, y al iniciar sesión el cambio de tipo remontaba TODA la app:
    // el login perdía su estado y no llegaba a mostrar la elección de rol.
    return (
        <PlaybookContext.Provider value={user ? {
            isOpen, initialView, openPlaybook, closePlaybook,
            pendingCount: pending.pending_count, newCount: pending.new_count,
            pendingLessons: pending.lessons, refreshPending,
        } : null}>
            {children}
        </PlaybookContext.Provider>
    );
};

export const usePlaybook = () => {
    const ctx = useContext(PlaybookContext);
    if (!ctx) {
        // Fuera de <PlaybookProvider> (o sin sesión activa): no-op seguro en vez de explotar.
        return { isOpen: false, openPlaybook: () => { }, closePlaybook: () => { }, pendingCount: 0, newCount: 0, pendingLessons: [], refreshPending: () => { } };
    }
    return ctx;
};
