// El Portal (10/10/2026): una pantalla que se abre ENCIMA de lo que se está viendo, sin cambiar de ruta
// (la monta sesion/PortalContext.jsx). Va en dos pasos, separando ROLES de ÁREAS (utils/portal.js):
//   roles    los roles de la cuenta y de sus cuentas vinculadas y, para quien puede, Simular a alguien.
//            Con un solo rol y sin Simular, este paso no se muestra.
//   areas    las áreas del rol elegido y Cortex, el área común a todos los roles.
//   simular  elegir a un miembro del equipo (SimularEnPortal).
// Elegir un área del rol con el que se está navega y cierra el Portal; la de otro rol (o cuenta) cambia
// de rol y entra. Escape o la X lo cierran y dejan todo como estaba.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, VenetianMask, X } from 'lucide-react';
import { areasDelGrupo, entrarPorTarjeta, fijarTarjetaPorDefecto, gruposDelPortal, hayPortal, tarjetaPorDefecto } from '../../utils/portal';
import { puedeSimular } from '../../sesion/simulacion';
import Eleccion from './Eleccion';
import SimularEnPortal from './SimularEnPortal';

// El color de cada rol: su tarjeta y todas sus áreas lo llevan.
const COLOR_DE_ROL = {
    admin: '#9b6bff', director_comercial: '#ff3fa4', closer: '#22c3ee', setter: '#2fd4a7', operator: '#ffb03a',
    triage: '#8e9bd8', hiring: '#ff7a59', director_marketing: '#f472b6',
};
const COLOR_CORTEX = '#6d8bff';
const rolDelGrupo = (g) => g.tarjetas[0]?.rol;

export default function Portal({ user, pasoInicial = null, onCerrar }) {
    const navigate = useNavigate();
    const grupos = gruposDelPortal(user);
    const simula = puedeSimular(user);
    const conRoles = grupos.length > 1 || simula;
    const porDefecto = tarjetaPorDefecto(user);
    // El rol abierto: el del área por defecto, o el único que hay.
    const [grupoClave, setGrupoClave] = useState(() => (
        pasoInicial === 'simular' && simula ? null
            : !conRoles ? grupos[0]?.clave : null
    ));
    const [simulando, setSimulando] = useState(pasoInicial === 'simular' && simula);
    const [directo, setDirecto] = useState(() => !!porDefecto);
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);
    const grupo = grupos.find((g) => g.clave === grupoClave) || null;

    // Escape vuelve un paso, y desde el primero cierra.
    useEffect(() => {
        const alTeclear = (e) => {
            // Con la elección de rol de una simulación abierta, Escape es de ella.
            if (e.key !== 'Escape' || eligiendo || document.querySelector('.elegir-rol-simular')) return;
            e.preventDefault();
            if (simulando) setSimulando(false);
            else if (grupo && conRoles) setGrupoClave(null);
            else onCerrar();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [simulando, grupo, conRoles, eligiendo, onCerrar]);

    const entrar = async (t) => {
        if (!t.comun && !user.is_impersonating && hayPortal(user)) fijarTarjetaPorDefecto(user, directo ? t.clave : null);
        setEligiendo(t.clave);
        setError(null);
        try {
            // Con el rol de ahora solo navega: el Portal se cierra y queda la pantalla elegida.
            await entrarPorTarjeta(user, t, (ruta) => { navigate(ruta); onCerrar(); });
        } catch (err) {
            setError(err?.response?.data?.message || 'No se pudo entrar ahí');
            setEligiendo(null);
        }
    };
    const alternar = (v) => {
        setDirecto(v);
        if (!v) fijarTarjetaPorDefecto(user, null);
    };
    const atras = (texto, alTocar) => (
        <button type="button" className="lg-link pt-atras" onClick={alTocar}><ArrowLeft size={14} aria-hidden="true" />{texto}</button>
    );

    let contenido;
    if (simulando) {
        contenido = (
            <Eleccion nombre={user.username} titulo="Simular a alguien"
                pregunta="Entrás a la app como esa persona. Lo que hagas queda hecho en su cuenta."
                contenido={<SimularEnPortal />}
                pie={atras('Tus roles', () => setSimulando(false))} />
        );
    } else if (grupo) {
        const color = COLOR_DE_ROL[rolDelGrupo(grupo)];
        contenido = (
            <Eleccion nombre={user.username} titulo={grupo.titulo}
                pregunta={grupo.detalle || (user.is_impersonating ? `Estás simulando a ${user.username}. Elegí el área.` : 'Elegí el área.')}
                eligiendo={eligiendo} error={error} marcada={porDefecto?.clave}
                opciones={areasDelGrupo(grupo).map((t) => ({
                    ...t, sobre: t.comun ? 'Área común' : 'Área', acento: t.comun ? COLOR_CORTEX : color,
                    detalle: t.comun ? 'Learnito y el Playbook' : null, onElegir: () => entrar(t),
                }))}
                pie={(
                    <div className="el-pie">
                        {!user.is_impersonating && hayPortal(user) && (
                            <label className="el-defecto">
                                <input type="checkbox" checked={directo} onChange={(e) => alternar(e.target.checked)} />
                                <span className="el-switch" aria-hidden="true" />
                                Entrar directo la próxima vez
                            </label>
                        )}
                        {conRoles && atras('Tus roles', () => setGrupoClave(null))}
                    </div>
                )} />
        );
    } else {
        contenido = (
            <Eleccion nombre={user.username}
                pregunta={user.is_impersonating ? `Estás simulando a ${user.username}.` : '¿Con qué rol entrás?'}
                opciones={[
                    ...grupos.map((g) => ({
                        clave: g.clave, titulo: g.titulo, Icono: g.Icono, acento: COLOR_DE_ROL[rolDelGrupo(g)],
                        sobre: g.clave.startsWith('cuenta-') ? 'Cuenta vinculada' : 'Rol',
                        detalle: `${g.tarjetas.length + 1} áreas`,
                        onElegir: () => setGrupoClave(g.clave),
                    })),
                    ...(simula ? [{
                        clave: 'simular', titulo: 'Simular a alguien', sobre: 'Equipo', detalle: 'Entrá como un miembro del equipo',
                        Icono: VenetianMask, acento: '#ffb03a', onElegir: () => setSimulando(true),
                    }] : []),
                ]} />
        );
    }

    return createPortal(
        <div className="pt" role="dialog" aria-modal="true" aria-label="Portal">
            <button type="button" className="pt-cerrar" onClick={onCerrar} aria-label="Cerrar el Portal" title="Cerrar (Esc)">
                <X size={18} aria-hidden="true" />
            </button>
            {contenido}
        </div>,
        document.body,
    );
}
