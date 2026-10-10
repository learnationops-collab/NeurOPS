import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import useDockNavigation from '../../hooks/useDockNavigation';
import DockSecciones from '../../pages/comercial/components/DockSecciones';
import MenuSesion from '../../pages/comercial/components/MenuSesion';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import '../../pages/comercial/comercial.css';

/**
 * El dock de las pantallas con MainLayout, para todos los roles: el MISMO de las demás pantallas
 * (DockSecciones + MenuSesion), en lugar de la píldora flotante vieja. Las secciones son las páginas
 * de siempre de cada rol (useDockNavigation) y el menú de sesión es el de todas las pantallas
 * (sesion/menuSesion.js).
 */
const DockMainLayout = () => {
    const { user, logout } = useAuth();
    const { pendingCount, openPlaybook } = usePlaybook();
    const { pages, activePageIndex, onPageChange } = useDockNavigation();
    const navigate = useNavigate();
    const { abrir: abrirConfiguracion } = useConfiguracion();

    const secciones = pages.map((p) => ({ id: p.id, label: p.label, Icono: p.icon }));
    const grupos = armarMenuSesion({
        user, navigate, logout,
        configuracion: { onClick: () => abrirConfiguracion() },
        playbook: { onClick: () => openPlaybook('pending'), pendientes: pendingCount },
    });

    return (
        <div className="dc-shell dc-shell--embebido">
            <DockSecciones
                secciones={secciones}
                activa={pages[activePageIndex]?.id}
                onElegir={(id) => onPageChange(pages.findIndex((p) => p.id === id))}
                ariaLabel="Secciones"
                despues={(
                    <MenuSesion
                        nombre={user?.name || user?.username || ''}
                        rol={rotuloDeSesion(user)}
                        aviso={pendingCount > 0 ? { texto: pendingCount, titulo: `${pendingCount} ${pendingCount === 1 ? 'video pendiente' : 'videos pendientes'} del Playbook` } : null}
                        grupos={grupos}
                    />
                )}
            />
        </div>
    );
};

export default DockMainLayout;
