// /portal: el Portal (10/10/2026), la entrada para quien tiene más de un lugar adonde ir (sus roles, las
// áreas de cada rol, sus cuentas vinculadas y Finances; ver utils/portal.js). Se llega después del login
// y desde «Cambiar de vista» del menú de sesión (?elegir=1).
//
// Con una tarjeta por defecto («Entrar directo la próxima vez») y sin ?elegir, entra solo a esa. Sin nada
// que elegir, o simulando a otro, va a donde entra su rol.

import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
    destinoDeEntrada, entrarPorTarjeta, fijarTarjetaPorDefecto, hayPortal, tarjetaPorDefecto, tarjetasDelPortal,
} from '../../utils/portal';
import Eleccion from './Eleccion';

export default function PortalPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [params] = useSearchParams();
    const elegir = !!params.get('elegir');
    const porDefecto = tarjetaPorDefecto(user);
    const [directo, setDirecto] = useState(() => !!porDefecto);
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);
    const auto = useRef(false);

    const entrar = async (tarjeta) => {
        setEligiendo(tarjeta.clave);
        setError(null);
        try {
            await entrarPorTarjeta(user, tarjeta, navigate);
        } catch (err) {
            setError(err?.response?.data?.message || 'No se pudo entrar ahí');
            setEligiendo(null);
        }
    };

    // Entrar directo a la por defecto (una sola vez: si falla, queda el Portal con el error).
    const entraSolo = !!porDefecto && !elegir;
    useEffect(() => {
        if (!entraSolo || auto.current || !hayPortal(user)) return;
        auto.current = true;
        entrar(porDefecto);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entraSolo]);

    if (!user || !hayPortal(user)) return <Navigate to={destinoDeEntrada(user)} replace />;

    const tarjetas = tarjetasDelPortal(user);
    const elegirTarjeta = (o) => {
        fijarTarjetaPorDefecto(user, directo ? o.clave : null);
        entrar(tarjetas.find((t) => t.clave === o.clave));
    };
    const alternar = (v) => {
        setDirecto(v);
        if (!v) fijarTarjetaPorDefecto(user, null);
    };
    // Abierto desde el menú (con historia en la app) vuelve a donde estaba.
    const volver = elegir && location.key !== 'default' ? () => navigate(-1) : null;

    return (
        <Eleccion
            nombre={user.username}
            pregunta={elegir ? '¿A dónde vamos?' : 'Elegí por dónde entrar.'}
            eligiendo={eligiendo || (entraSolo && !error ? porDefecto.clave : null)}
            error={error}
            marcada={porDefecto?.clave}
            opciones={tarjetas.map((t) => ({
                clave: t.clave, titulo: t.titulo, sobre: t.sobre, detalle: t.detalle, Icono: t.Icono, onElegir: elegirTarjeta,
            }))}
            pie={(
                <div className="el-pie">
                    <label className="el-defecto">
                        <input type="checkbox" checked={directo} onChange={(e) => alternar(e.target.checked)} />
                        <span className="el-switch" aria-hidden="true" />
                        Entrar directo la próxima vez
                    </label>
                    {volver && <button type="button" className="lg-link" onClick={volver}>Volver</button>}
                </div>
            )}
        />
    );
}
