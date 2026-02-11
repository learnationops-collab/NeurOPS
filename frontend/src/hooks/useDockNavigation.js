import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
    LayoutDashboard,
    Users,
    BarChart3,
    Bell,
    ClipboardList,
    TrendingUp,
    Settings,
    Zap,
    Ghost
} from 'lucide-react';

/**
 * useDockNavigation - Hook personalizado para manejar la navegación del Dock
 * 
 * Maneja:
 * - Detección de página y sección actual desde la URL
 * - Navegación entre páginas y secciones
 * - Sincronización con eventos de teclado (ArrowUp/Down)
 * - Datos estructurados para WheelSelector
 */
const useDockNavigation = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [activeSection, setActiveSection] = useState(0);

    // Definir páginas según el rol del usuario
    const pages = useMemo(() => {
        const isCloser = user?.role === 'closer';
        const isSetter = user?.role === 'setter';

        if (isCloser) {
            return [
                { id: 'board', icon: LayoutDashboard, label: 'Board', path: '/closer/dashboard' },
                { id: 'leads', icon: Users, label: 'Leads', path: '/closer/leads' },
                { id: 'stats', icon: BarChart3, label: 'Stats', path: '/closer/stats' },
                { id: 'settings', icon: Settings, label: 'Ajustes', path: '/closer/settings' }
            ];
        } else if (isSetter) {
            return [
                { id: 'board', icon: LayoutDashboard, label: 'Board', path: '/setter/dashboard' },
                { id: 'stats', icon: BarChart3, label: 'Stats', path: '/setter/stats' }
            ];
        } else if (user?.role === 'operator') {
            return [
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/ops/dashboard' },
                { id: 'database', icon: Zap, label: 'Base de Datos', path: '/ops/database' },
                { id: 'settings', icon: Settings, label: 'Ajustes Técnicos', path: '/ops/settings' }
            ];
        } else if (user?.role === 'sales_admin') {
            return [
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/sales-admin/dashboard' },
                { id: 'team', icon: Users, label: 'Equipo', path: '/sales-admin/team' },
                { id: 'settings', icon: Settings, label: 'Ajustes', path: '/sales-admin/settings' }
            ];
        } else if (user?.role === 'admin') {
            return [
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard', path: '/admin/dashboard' },
                { id: 'leads', icon: Users, label: 'Leads', path: '/admin/leads' },
                { id: 'finances', icon: TrendingUp, label: 'Finanzas', path: '/admin/finance' },
                { id: 'team', icon: Users, label: 'Equipo', path: '/admin/team' },
                { id: 'settings', icon: Settings, label: 'Ajustes', path: '/admin/settings' }
            ];
        }

        return [];
    }, [user?.role]);

    // Detectar página activa desde la URL
    const activePageIndex = useMemo(() => {
        const index = pages.findIndex(page => location.pathname.startsWith(page.path));
        return index >= 0 ? index : 0;
    }, [location.pathname, pages]);

    const activePage = pages[activePageIndex];

    // Resetear sección al cambiar de página para evitar estados inconsistentes
    useEffect(() => {
        setActiveSection(0);
    }, [activePageIndex]);

    // Definir secciones según la página actual
    const sections = useMemo(() => {
        if (!activePage) return [];

        // Secciones para Closer Dashboard
        if (activePage.id === 'board' && user?.role === 'closer') {
            return [
                { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
                { id: 'summary', icon: ClipboardList, label: 'Resumen' }
            ];
        }

        // Secciones para Closer Leads
        if (activePage.id === 'leads' && user?.role === 'closer') {
            return [
                { id: 'kanban', icon: LayoutDashboard, label: 'Pipeline' },
                { id: 'table', icon: Users, label: 'Tabla' }
            ];
        }

        // Secciones para Setter Dashboard
        if (activePage.id === 'board' && user?.role === 'setter') {
            return [
                { id: 'notifications', icon: Bell, label: 'Notificaciones' },
                { id: 'report', icon: ClipboardList, label: 'Reporte' }
            ];
        }

        // Secciones para Admin Dashboard
        if (activePage.id === 'dashboard' && user?.role === 'admin') {
            return [
                { id: 'home', icon: LayoutDashboard, label: 'Inicio' },
                { id: 'summary', icon: ClipboardList, label: 'Resumen' }
            ];
        }

        // Sin secciones para Stats
        return [];
    }, [activePage, user?.role]);

    // Escuchar eventos de teclado para navegación (Left/Right para Páginas, Up/Down para Secciones)
    useEffect(() => {
        const handleKeys = (e) => {
            // No interferir si el usuario está escribiendo
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

            if (e.key === 'ArrowLeft') {
                onPageChange((activePageIndex - 1 + pages.length) % pages.length);
            } else if (e.key === 'ArrowRight') {
                onPageChange((activePageIndex + 1) % pages.length);
            } else if (e.key === 'ArrowUp') {
                if (sections.length > 0) {
                    onSectionChange((activeSection - 1 + sections.length) % sections.length);
                }
            } else if (e.key === 'ArrowDown') {
                if (sections.length > 0) {
                    onSectionChange((activeSection + 1) % sections.length);
                }
            }
        };

        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, [activePageIndex, activeSection, pages, sections]);

    // Escuchar eventos de cambio de sección desde las páginas (sincronización inversa)
    useEffect(() => {
        const handleSectionChange = (e) => {
            const { activeSection: newSection } = e.detail;
            if (typeof newSection === 'number' && newSection !== activeSection) {
                setActiveSection(newSection);
            }
        };

        window.addEventListener('page-section-changed', handleSectionChange);
        return () => window.removeEventListener('page-section-changed', handleSectionChange);
    }, [activeSection]);

    // Handlers para cambiar página/sección
    const onPageChange = (index) => {
        if (index >= 0 && index < pages.length) {
            navigate(pages[index].path);
            setActiveSection(0); // Reset section al cambiar de página
        }
    };

    const onSectionChange = (index) => {
        if (index >= 0 && index < sections.length) {
            setActiveSection(index);
            // Dispatch evento para que la página cambie de sección
            window.dispatchEvent(new CustomEvent('request-section-change', {
                detail: { index }
            }));
        }
    };

    // Labels para mostrar en el Dock
    const currentPageLabel = activePage?.label || '';
    const currentSectionLabel = sections[activeSection]?.label || '';

    return {
        pages,
        activePageIndex,
        sections,
        activeSectionIndex: activeSection,
        onPageChange,
        onSectionChange,
        currentPageLabel,
        currentSectionLabel,
        activePage
    };
};

export default useDockNavigation;
