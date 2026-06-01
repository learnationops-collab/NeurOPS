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
    Ghost,
    Activity,
    CalendarDays,
    Target,
    Link2Off,
    Layers,
    DollarSign
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
        const isTriage = user?.role === 'triage';

        if (isCloser) {
            return [
                { id: 'stats', icon: BarChart3, label: 'Dashboard', path: '/closer/stats' },
                { id: 'deck', icon: Layers, label: 'Gestión de Leads', path: '/closer/deck' },
                { id: 'new-sale', icon: DollarSign, label: 'Declarar Venta', path: '/closer/sales/new' },
                { id: 'report', icon: ClipboardList, label: 'Reporte Diario', path: '/closer/report' },
                { id: 'unattributed', icon: Link2Off, label: 'Sin Anuncio', path: '/unattributed-leads' },
                { id: 'clients', icon: Users, label: 'Clientes', path: '/closer/clients' }
            ];
        } else if (isSetter) {
            return [
                { id: 'stats', icon: BarChart3, label: 'Dashboard', path: '/setter/statistics' },
                { id: 'deck', icon: Layers, label: 'Gestión de Leads', path: '/setter/deck' },
                { id: 'report', icon: ClipboardList, label: 'Reporte Diario', path: '/setter/report' },
                { id: 'unattributed', icon: Link2Off, label: 'Sin Anuncio', path: '/unattributed-leads' }
            ];
        } else if (isTriage) {
            return [
                { id: 'report', icon: ClipboardList, label: 'Reporte Diario', path: '/triage/report' }
            ];
        } else if (user?.role === 'operator') {
            return [
                { id: 'settings', icon: Settings, label: 'Control Técnico', path: '/ops/dashboard' }
            ];
        } else if (user?.role === 'sales_admin') {
            return [];
        } else if (user?.role === 'admin') {
            return [
                { id: 'ventas', icon: TrendingUp, label: 'Ventas', path: '/admin/ventas' },
                { id: 'marketing', icon: Target, label: 'Marketing', path: '/admin/marketing' },
                { id: 'unattributed', icon: Link2Off, label: 'Sin Anuncio', path: '/unattributed-leads' },
                { id: 'clients', icon: Users, label: 'Clientes', path: '/closer/clients' },
                { id: 'sheets', icon: CalendarDays, label: 'Importaciones Sheets', path: '/admin/sheets' }
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

        // Secciones para Sales Admin Dashboard
        if (activePage.id === 'dashboard' && user?.role === 'sales_admin') {
            return [
                { id: 'overview', icon: LayoutDashboard, label: 'Resumen' },
                { id: 'activity', icon: Activity, label: 'Rendimiento' }
            ];
        }

        // Secciones para Team Management
        if (activePage.id === 'team') {
            return [
                { id: 'management', icon: Users, label: 'Gestión' },
                { id: 'stats', icon: BarChart3, label: 'Estadísticas' }
            ];
        }

        // Secciones para Settings (Común para todos)
        if (activePage.id === 'settings') {
            return [
                { id: 'profile', icon: Users, label: 'Perfil' },
                { id: 'team', icon: Users, label: 'Equipo' },
                { id: 'appearance', icon: Settings, label: 'Apariencia' }
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
