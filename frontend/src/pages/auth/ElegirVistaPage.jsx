// El hub de vistas, /vistas (08/10/2026): la misma elección del login —una tarjeta por rol, por cuenta
// vinculada y «Finances»— para quien ya tiene sesión. Se llega desde «Cambiar de vista» en el menú de
// sesión del dock (ver `opcionesDeRol`). Elegir funciona igual que al entrar (ver ElegirRol): cambia
// de rol en la cuenta y va a su pantalla; Finances va a /finanzas. «Volver» deja todo como estaba.
//
// Sin nada que elegir (un solo rol y sin finanzas) o simulando a otro no hay hub: va a la pantalla del
// rol, como ProtectedRoute con una ruta ajena.

import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { hayQueElegir } from '../../utils/cuentasVinculadas';
import { roleLandingPath } from '../../utils/roleLanding';
import ElegirRol from './ElegirRol';

export default function ElegirVistaPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    if (!user || user.is_impersonating || !hayQueElegir(user)) {
        return <Navigate to={roleLandingPath(user?.role)} replace />;
    }

    // Abierto desde un link (sin historia en la app) vuelve a la pantalla del rol.
    const volver = () => (location.key !== 'default' ? navigate(-1) : navigate(roleLandingPath(user.role)));

    return (
        <ElegirRol
            user={user}
            pregunta="Elegí a qué vista entrar."
            onElegido={(u, destino) => navigate(destino || roleLandingPath(u.role))}
            pie={<button type="button" className="lg-link" onClick={volver}>Volver</button>}
        />
    );
}
