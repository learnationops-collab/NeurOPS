// /inicio: elegir el área del rol (Dirección, Agendamiento…), con el formato de Learnation Marketing.
// «Entrar directo la próxima vez» guarda el área elegida y la próxima entrada saltea esta pantalla.
// ?elegir=1 (lo usa «Cambiar de área» del menú) la muestra aunque haya un área por defecto.

import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { AREAS, areaPorDefecto, areasDe, fijarAreaPorDefecto } from '../../utils/areas';
import { rotuloDeRol } from '../../utils/cuentasVinculadas';
import { roleLandingPath } from '../../utils/roleLanding';
import Eleccion from './Eleccion';

export default function ElegirAreaPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [directo, setDirecto] = useState(() => !!areaPorDefecto(user));

    const areas = areasDe(user?.role);
    if (!user) return <Navigate to="/login" replace />;
    if (areas.length < 2) return <Navigate to={roleLandingPath(user.role)} replace />;
    const def = areaPorDefecto(user);
    if (def && !params.get('elegir')) return <Navigate to={AREAS[def].ruta} replace />;

    const elegir = (o) => {
        if (directo) fijarAreaPorDefecto(user, o.clave);
        navigate(AREAS[o.clave].ruta);
    };
    const alternar = (v) => {
        setDirecto(v);
        if (!v) fijarAreaPorDefecto(user, null);
    };

    return (
        <Eleccion
            nombre={user.username}
            pregunta={rotuloDeRol(user.role) + ' · elegí tu área'}
            opciones={areas.map((a) => ({ clave: a.id, titulo: a.label, Icono: a.Icono, onElegir: elegir }))}
            pie={(
                <label className="el-defecto">
                    <input type="checkbox" checked={directo} onChange={(e) => alternar(e.target.checked)} />
                    <span className="el-switch" aria-hidden="true" />
                    Entrar directo la próxima vez
                </label>
            )}
        />
    );
}
