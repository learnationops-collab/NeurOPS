import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Compass, Ghost, LogOut, Palette, Settings, VenetianMask } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import useDockNavigation from '../../hooks/useDockNavigation';
import DockSecciones from '../../pages/comercial/components/DockSecciones';
import MenuSesion from '../../pages/comercial/components/MenuSesion';
import { opcionesDeFinanzas, opcionesDeRol } from '../../utils/cuentasVinculadas';
import { revertImpersonation } from '../../utils/impersonation';
import '../../pages/comercial/comercial.css';

const TEMAS = [
    { id: 'elegant', label: 'Elegant Blue · claro con vidrio' },
    { id: 'clean', label: 'Clean Mac · claro sólido' },
    { id: 'custom', label: 'Custom Pro · oscuro' },
];

/**
 * El dock del admin: el MISMO de los demás roles (DockSecciones + MenuSesion), en lugar de la
 * píldora flotante vieja. Las secciones son las páginas de siempre (useDockNavigation) y el menú
 * de sesión junta lo que estaba repartido en la píldora: Playbook, tema, ajustes, simular, cambiar
 * de rol y cerrar sesión. Con «ver finanzas», además «Pasar a Finances» (/finanzas, 08/10/2026).
 *
 * En main no hay áreas (Administración · Dirección · Agendamiento, de develop): sin «Cambiar de área».
 */
const DockAdmin = ({ onSettingsClick, onImpersonateClick }) => {
    const { user, logout } = useAuth();
    const { theme, setTheme } = useTheme();
    const { pendingCount, openPlaybook } = usePlaybook();
    const { pages, activePageIndex, onPageChange } = useDockNavigation();
    const navigate = useNavigate();

    const secciones = pages.map((p) => ({ id: p.id, label: p.label, Icono: p.icon }));
    const grupos = [
        [
            { id: 'playbook', label: 'Playbook', Icono: Compass, cuenta: pendingCount || null, onClick: () => openPlaybook('pending') },
            {
                id: 'tema', label: 'Tema', Icono: Palette,
                panel: {
                    titulo: 'Apariencia',
                    vacio: '',
                    cargar: () => TEMAS.map((t) => ({ id: t.id, label: `${theme === t.id ? '✓ ' : ''}${t.label}`, onClick: () => setTheme(t.id) })),
                },
            },
            { id: 'ajustes', label: 'Ajustes generales', Icono: Settings, onClick: onSettingsClick },
            { id: 'simular', label: 'Simular acceso', Icono: VenetianMask, onClick: onImpersonateClick },
        ],
        [...opcionesDeRol(user, (m) => toast.error(m)), ...opcionesDeFinanzas(user, navigate)],
        [
            ...(user?.is_impersonating ? [{ id: 'volver', label: 'Volver a mi sesión', Icono: Ghost, onClick: () => revertImpersonation() }] : []),
            { id: 'salir', label: 'Cerrar sesión', Icono: LogOut, peligro: true, onClick: () => { if (window.confirm('¿Cerrar sesión?')) logout(); } },
        ],
    ];

    return (
        <div className="dc-shell dc-shell--embebido">
            <DockSecciones
                secciones={secciones}
                activa={pages[activePageIndex]?.id}
                onElegir={(id) => onPageChange(pages.findIndex((p) => p.id === id))}
                ariaLabel="Secciones de administración"
                despues={(
                    <MenuSesion
                        nombre={user?.name || user?.username || ''}
                        rol={user?.is_impersonating ? 'Administración · simulación' : 'Administración'}
                        aviso={pendingCount > 0 ? { texto: pendingCount, titulo: `${pendingCount} ${pendingCount === 1 ? 'video pendiente' : 'videos pendientes'} del Playbook` } : null}
                        grupos={grupos}
                    />
                )}
            />
        </div>
    );
};

export default DockAdmin;
