// «Simular a alguien», en el Portal (/portal?simular=1, 10/10/2026): la única simulación, para todos los
// que pueden simular. Se llega desde la tarjeta del Portal o con la tecla «w» en cualquier pantalla
// (sesion/simulacion.js). Reemplaza a «Simular a un closer», «a un setter», «Configurar a un closer» y
// el panel «Acceso simulado» del operador.
//
// Es la lista del equipo que el backend deja simular (`GET /auth/impersonate/equipo`: la dirección
// comercial ve closers y setters; admin y operador, a todos), con buscador y filtro por rol. Tocar a
// alguien simula en esta pestaña; el botón de la esquina, en una pestaña nueva y aislada. A quien tiene
// varios roles (o ve Finances) se le pregunta con cuál (ElegirRolAlSimular).

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import api from '../../services/api';
import Mascota from '../../components/mascota/Mascota';
import { mascotaDe } from '../../components/mascota/mascotas';
import ElegirRolAlSimular, { hayQueElegir } from '../../components/shared/ElegirRolAlSimular';
import { rotuloDeRol } from '../../utils/cuentasVinculadas';
import { simularA, simularEnPestanaNueva } from '../../utils/impersonation';

const ORDEN = ['closer', 'setter', 'triage', 'operator', 'hiring', 'director_comercial', 'director_marketing', 'admin'];
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mensaje = (e) => e?.response?.data?.message || e?.message || 'No se pudo iniciar la simulación';

export default function SimularEnPortal() {
    const [equipo, setEquipo] = useState(null);
    const [error, setError] = useState(null);
    const [q, setQ] = useState('');
    const [rol, setRol] = useState(null);
    const [entrando, setEntrando] = useState(null);
    // Eligiendo con qué rol: { persona, nueva } (nueva: en una pestaña nueva).
    const [eligiendo, setEligiendo] = useState(null);

    useEffect(() => {
        let vivo = true;
        api.get('/auth/impersonate/equipo').then(
            (res) => { if (vivo) setEquipo(res.data?.equipo || []); },
            () => { if (vivo) setError('No se pudo cargar el equipo.'); },
        );
        return () => { vivo = false; };
    }, []);

    const roles = useMemo(() => {
        const hay = new Set((equipo || []).flatMap((p) => p.roles));
        return ORDEN.filter((r) => hay.has(r));
    }, [equipo]);
    const lista = useMemo(() => (equipo || []).filter((p) => (!rol || p.roles.includes(rol))
        && (!q || sinTildes(p.username).includes(sinTildes(q)))), [equipo, rol, q]);

    // `rolElegido` null: el principal. Con la elección de rol abierta, el error lo muestra esa pantalla
    // (por eso lanza). En una pestaña nueva hay que llamarla directo desde el clic (ver simularEnPestanaNueva).
    const simular = async (persona, rolElegido = null, destino = null, nueva = false) => {
        setError(null);
        if (nueva) {
            await simularEnPestanaNueva(persona.id, destino, rolElegido);
            setEligiendo(null);
            return;
        }
        setEntrando(persona.id);
        try {
            await simularA(persona.id, destino, rolElegido);
        } catch (e) {
            setEntrando(null);
            throw e;
        }
    };

    const entrar = (persona, nueva = false) => {
        if (hayQueElegir(persona)) { setEligiendo({ persona, nueva }); return; }
        simular(persona, null, null, nueva).catch((e) => setError(mensaje(e)));
    };

    return (
        <div className="sp">
            {eligiendo && (
                <ElegirRolAlSimular persona={eligiendo.persona}
                    onElegir={(r, destino) => simular(eligiendo.persona, r, destino, eligiendo.nueva)}
                    onCancelar={() => setEligiendo(null)} />
            )}
            <div className="sp-barra">
                <label className="sp-buscar">
                    <Search size={16} aria-hidden="true" />
                    <input className="lg-input" type="search" placeholder="Buscar por nombre" aria-label="Buscar por nombre"
                        value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </label>
                {roles.length > 1 && (
                    <div className="sp-roles" role="group" aria-label="Filtrar por rol">
                        <button type="button" aria-pressed={!rol} onClick={() => setRol(null)}>Todos</button>
                        {roles.map((r) => (
                            <button key={r} type="button" aria-pressed={rol === r} onClick={() => setRol(r)}>{rotuloDeRol(r)}</button>
                        ))}
                    </div>
                )}
            </div>
            {error && <p className="lg-error" role="alert">{error}</p>}
            {equipo === null && !error && <p className="sp-nota"><Loader2 size={16} className="lg-gira" /> Cargando el equipo…</p>}
            {equipo !== null && !lista.length && <p className="sp-nota">{q || rol ? 'Nadie coincide con la búsqueda.' : 'No hay a quién simular.'}</p>}
            <ul className="sp-lista">
                {lista.map((p, i) => (
                    <li key={p.id} className="sp-persona" style={{ '--n': Math.min(i, 12) }}>
                        <button type="button" className="sp-entrar" disabled={!!entrando}
                            aria-label={`Simular a ${p.username}`} onClick={() => entrar(p)}>
                            <span className="sp-avatar" aria-hidden="true"><Mascota personaje={mascotaDe(p, p.username)} size={44} /></span>
                            <span className="sp-txt">
                                <b>{p.username}</b>
                                <small>{p.roles.map(rotuloDeRol).join(' · ')}</small>
                            </span>
                            {entrando === p.id && <Loader2 size={16} className="lg-gira sp-cargando" />}
                        </button>
                        <button type="button" className="sp-nueva" disabled={!!entrando}
                            aria-label={`Simular a ${p.username} en una pestaña nueva`} title="En una pestaña nueva"
                            onClick={() => entrar(p, true)}>
                            <ExternalLink size={14} aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
