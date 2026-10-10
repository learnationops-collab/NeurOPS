import { Navigate } from 'react-router-dom';
import OperadorEspacioPage from './OperadorEspacioPage';

/**
 * Las rutas `/ops/*` son el espacio de Operaciones (`OperadorEspacioPage`: pestañas arriba y su dock), sin
 * `MainLayout`, que le pondría el dock de la app encima del propio. Las rutas viejas (`/ops/agendas`,
 * `/ops/ventas`, `/ops/course-editor`) mandan a la sección que corresponde de `/ops/dashboard`, que sigue
 * siendo la ruta de aterrizaje.
 *
 * El admin entra al MISMO espacio que el operador desde el 10/10/2026: «Administración» se retiró y lo que
 * era solo suyo pasó acá. Antes conservaba cada pantalla suelta con el layout y el dock de la app.
 *
 * `paso` es la sección del espacio a la que equivale la ruta; sin él, la ruta ES el espacio.
 */
const OpsRuta = ({ paso = null }) => (paso
    ? <Navigate replace to={`/ops/dashboard?step=${paso}`} />
    : <OperadorEspacioPage />);

export default OpsRuta;
