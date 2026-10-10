// /portal: el Portal (10/10/2026). Muestra, separados, los ROLES de la persona y las ÁREAS a las que da
// acceso cada uno (un grupo por rol, con sus áreas como tarjetas; ver utils/portal.js), y aparte las
// herramientas: Cortex (Learnito y el Playbook) y, para quien puede, Simular a alguien del equipo
// (?simular=1, SimularEnPortal).
//
// Se llega después del login (si tiene más de un área) y desde «Portal» del menú de sesión (?elegir=1).
// Con un área por defecto («Entrar directo la próxima vez») y sin ?elegir, entra solo a esa.

import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { VenetianMask } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
    CORTEX, destinoDeEntrada, entrarPorTarjeta, fijarTarjetaPorDefecto, gruposDelPortal, hayPortal, tarjetaPorDefecto,
} from '../../utils/portal';
import { puedeSimular } from '../../sesion/simulacion';
import Eleccion from './Eleccion';
import SimularEnPortal from './SimularEnPortal';

// El color de cada rol: todas sus áreas lo llevan, así se ve de qué rol es cada una.
const COLOR_DE_ROL = {
    admin: '#9b6bff', director_comercial: '#ff3fa4', closer: '#22c3ee', setter: '#2fd4a7', operator: '#ffb03a',
    triage: '#8e9bd8', hiring: '#ff7a59', director_marketing: '#f472b6',
};
const COLOR_HERRAMIENTAS = '#6d8bff';

export default function PortalPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [params, setParams] = useSearchParams();
    const elegir = !!params.get('elegir');
    const simulando = params.get('simular') === '1' && puedeSimular(user);
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
    const entraSolo = !!porDefecto && !elegir && !simulando;
    useEffect(() => {
        if (!entraSolo || auto.current || !hayPortal(user)) return;
        auto.current = true;
        entrar(porDefecto);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [entraSolo]);

    if (!user) return <Navigate to="/login" replace />;
    // Al entrar sin nada que elegir va directo; desde el menú o para simular, el Portal está siempre.
    if (!elegir && !simulando && !hayPortal(user)) return <Navigate to={destinoDeEntrada(user)} replace />;

    // Abierto desde el menú (con historia en la app) vuelve a donde estaba.
    const volver = elegir && location.key !== 'default' ? () => navigate(-1) : null;

    if (simulando) {
        const salir = () => { const p = new URLSearchParams(params); p.delete('simular'); setParams(p); };
        return (
            <Eleccion nombre={user.username} titulo="Simular a alguien"
                pregunta="Entrás a la app como esa persona. Lo que hagas queda hecho en su cuenta."
                contenido={<SimularEnPortal />}
                pie={<button type="button" className="lg-link" onClick={salir}>Volver al Portal</button>} />
        );
    }

    const elegirArea = (t) => {
        if (!user.is_impersonating) fijarTarjetaPorDefecto(user, directo ? t.clave : null);
        entrar(t);
    };
    const alternar = (v) => {
        setDirecto(v);
        if (!v) fijarTarjetaPorDefecto(user, null);
    };

    const grupos = gruposDelPortal(user).map((g) => ({
        clave: g.clave, titulo: g.titulo, Icono: g.Icono,
        detalle: g.detalle || `Tu rol · ${g.tarjetas.length === 1 ? '1 área' : `${g.tarjetas.length} áreas`}`,
        opciones: g.tarjetas.map((t) => ({
            ...t, sobre: 'Área', acento: COLOR_DE_ROL[t.rol], onElegir: () => elegirArea(t),
        })),
    }));
    const herramientas = [
        { clave: 'cortex', titulo: CORTEX.label, sobre: 'Para todos', detalle: 'Learnito y el Playbook', Icono: CORTEX.Icono,
            acento: COLOR_HERRAMIENTAS, onElegir: () => navigate(CORTEX.ruta) },
        ...(puedeSimular(user) ? [{
            clave: 'simular', titulo: 'Simular a alguien', sobre: 'Equipo', detalle: 'Entrá como un miembro del equipo',
            Icono: VenetianMask, acento: '#ffb03a', onElegir: () => setParams({ ...Object.fromEntries(params), simular: '1' }),
        }] : []),
    ];

    return (
        <Eleccion
            nombre={user.username}
            pregunta={user.is_impersonating ? `Estás simulando a ${user.username}.` : '¿Por dónde entrás hoy?'}
            eligiendo={eligiendo || (entraSolo && !error ? porDefecto.clave : null)}
            error={error}
            marcada={porDefecto?.clave}
            grupos={[...grupos, { clave: 'herramientas', titulo: 'Herramientas', detalle: 'Para cualquier rol', opciones: herramientas }]}
            pie={(
                <div className="el-pie">
                    {!user.is_impersonating && hayPortal(user) && (
                        <label className="el-defecto">
                            <input type="checkbox" checked={directo} onChange={(e) => alternar(e.target.checked)} />
                            <span className="el-switch" aria-hidden="true" />
                            Entrar directo la próxima vez
                        </label>
                    )}
                    {volver && <button type="button" className="lg-link" onClick={volver}>Volver</button>}
                </div>
            )}
        />
    );
}
