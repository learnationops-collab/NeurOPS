// El Portal (10/10/2026): una pantalla que se abre ENCIMA de lo que se está viendo, sin cambiar de ruta
// (la monta sesion/PortalContext.jsx). Una sola grilla, como la referencia de Kerwin: cada área de cada
// rol (y de las cuentas vinculadas) es una tarjeta con el rol arriba, después Finances y al final Cortex
// (el área común a todos los roles) y, para quien puede, Simular a alguien (SimularEnPortal, en el mismo
// Portal). Elegir un área del rol con el que se está navega y cierra el Portal; la de otro rol (o cuenta)
// cambia de rol y entra. Escape o la X lo cierran y dejan todo como estaba.

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, VenetianMask, X } from 'lucide-react';
import { TARJETA_CORTEX, entrarPorTarjeta, fijarTarjetaPorDefecto, gruposDelPortal, hayPortal, tarjetaPorDefecto } from '../../utils/portal';
import { puedeSimular } from '../../sesion/simulacion';
import Eleccion from './Eleccion';
import SimularEnPortal from './SimularEnPortal';

/** Las áreas en el orden de la referencia: las de cada rol y cuenta, Finances al final. */
function areasDelPortal(user) {
    const areas = gruposDelPortal(user).flatMap((g) => g.tarjetas.map((t) => ({ ...t, sobre: g.titulo, detalle: g.detalle || null })));
    const esFinanzas = (t) => t.ruta === '/finanzas';
    return [...areas.filter((t) => !esFinanzas(t)), ...areas.filter(esFinanzas)];
}

export default function Portal({ user, pasoInicial = null, onCerrar }) {
    const navigate = useNavigate();
    const simula = puedeSimular(user);
    const porDefecto = tarjetaPorDefecto(user);
    const [simulando, setSimulando] = useState(pasoInicial === 'simular' && simula);
    const [directo, setDirecto] = useState(() => !!porDefecto);
    const [eligiendo, setEligiendo] = useState(null);
    const [error, setError] = useState(null);

    // Escape vuelve de Simular, y si no, cierra.
    useEffect(() => {
        const alTeclear = (e) => {
            // Con la elección de rol de una simulación abierta, Escape es de ella.
            if (e.key !== 'Escape' || eligiendo || document.querySelector('.elegir-rol-simular')) return;
            e.preventDefault();
            if (simulando) setSimulando(false);
            else onCerrar();
        };
        window.addEventListener('keydown', alTeclear);
        return () => window.removeEventListener('keydown', alTeclear);
    }, [simulando, eligiendo, onCerrar]);

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

    const contenido = simulando ? (
        <Eleccion nombre={user.username} titulo="Simular a alguien"
            pregunta="Entrás a la app como esa persona. Lo que hagas queda hecho en su cuenta."
            contenido={<SimularEnPortal />}
            pie={(
                <button type="button" className="lg-link pt-atras" onClick={() => setSimulando(false)}>
                    <ArrowLeft size={14} aria-hidden="true" />Volver al Portal
                </button>
            )} />
    ) : (
        <Eleccion nombre={user.username}
            pregunta={user.is_impersonating ? `Estás simulando a ${user.username}.` : '¿A dónde vamos?'}
            eligiendo={eligiendo} error={error} marcada={porDefecto?.clave}
            opciones={[
                ...areasDelPortal(user).map((t) => ({ ...t, onElegir: () => entrar(t) })),
                { ...TARJETA_CORTEX, sobre: 'Para todos', onElegir: () => entrar(TARJETA_CORTEX) },
                ...(simula ? [{
                    clave: 'simular', titulo: 'Simular a alguien', sobre: 'Equipo', Icono: VenetianMask, onElegir: () => setSimulando(true),
                }] : []),
            ]}
            pie={!user.is_impersonating && hayPortal(user) && (
                <div className="el-pie">
                    <label className="el-defecto">
                        <input type="checkbox" checked={directo} onChange={(e) => alternar(e.target.checked)} />
                        <span className="el-switch" aria-hidden="true" />
                        Entrar directo la próxima vez
                    </label>
                </div>
            )} />
    );

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
