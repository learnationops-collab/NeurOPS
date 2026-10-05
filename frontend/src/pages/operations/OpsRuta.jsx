import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import MainLayout from '../../components/MainLayout';
import OperadorEspacioPage from './OperadorEspacioPage';

/**
 * Las rutas `/ops/*` las abren el operador y el admin, y no ven lo mismo:
 *
 *  - El operador trabaja en su espacio (`OperadorEspacioPage`: pestañas arriba y su dock), sin
 *    `MainLayout`, que le pondría el dock de la app encima del propio. Las rutas viejas
 *    (`/ops/agendas`, `/ops/ventas`, `/ops/course-editor`) lo mandan a la sección que corresponde de
 *    `/ops/dashboard`, que sigue siendo la ruta de aterrizaje del rol.
 *  - El admin conserva cada pantalla con el layout y el dock de siempre (los `children`).
 *
 * `paso` es la sección del espacio a la que equivale la ruta; sin él, la ruta ES el espacio.
 */
const OpsRuta = ({ paso = null, children }) => {
    const { user } = useAuth();

    if (user?.role === 'operator') {
        return paso
            ? <Navigate replace to={`/ops/dashboard?step=${paso}`} />
            : <OperadorEspacioPage />;
    }
    return <MainLayout>{children}</MainLayout>;
};

export default OpsRuta;
