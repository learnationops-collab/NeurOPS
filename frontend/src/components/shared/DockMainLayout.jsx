import { useNavigate } from 'react-router-dom';
import { VenetianMask } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { usePlaybook } from '../../contexts/PlaybookContext';
import useDockNavigation from '../../hooks/useDockNavigation';
import DockSecciones from '../../pages/comercial/components/DockSecciones';
import MenuSesion from '../../pages/comercial/components/MenuSesion';
import { opcionesDeFinanzas } from '../../utils/cuentasVinculadas';
import { armarMenuSesion, rotuloDeSesion } from '../../sesion/menuSesion';
import { useConfiguracion } from '../../sesion/ConfiguracionContext';
import '../../pages/comercial/comercial.css';

// Quiénes tienen «Simular a otra persona», el buscador de OperatorControls para entrar como
// cualquiera del equipo (el backend decide a quién).
const SIMULAN_A_CUALQUIERA = ['admin', 'operator'];

/**
 * El dock de las pantallas con MainLayout, para todos los roles: el MISMO de las demás pantallas
 * (DockSecciones + MenuSesion), en lugar de la píldora flotante vieja. Las secciones son las páginas
 * de siempre de cada rol (useDockNavigation) y el menú de sesión es el de todas las pantallas
 * (sesion/menuSesion.js).
 */
const DockMainLayout = ({ onImpersonateClick }) => {
    const { user, logout } = useAuth();
    const { pendingCount, openPlaybook } = usePlaybook();
    const { pages, activePageIndex, onPageChange } = useDockNavigation();
    const navigate = useNavigate();
    const { abrir: abrirConfiguracion } = useConfiguracion();

    const rolReal = user?.is_impersonating ? user?.original_user_role : user?.role;
    const secciones = pages.map((p) => ({ id: p.id, label: p.label, Icono: p.icon }));
    const grupos = armarMenuSesion({
        user, navigate, logout,
        configuracion: { onClick: () => abrirConfiguracion() },
        playbook: { onClick: () => openPlaybook('pending'), pendientes: pendingCount },
        irDespues: opcionesDeFinanzas(user, navigate),
        equipo: SIMULAN_A_CUALQUIERA.includes(rolReal)
            ? [{ id: 'simular-otra', label: 'Simular a otra persona', Icono: VenetianMask, onClick: onImpersonateClick }]
            : [],
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
