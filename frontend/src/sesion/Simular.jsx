// «Simular a alguien» (10/10/2026): la única simulación, para todos los que pueden simular, desde el menú
// de sesión de cualquier pantalla (sesion/menuSesion.js) o con la tecla «w». Reemplaza a «Simular a un
// closer», «Simular a un setter», «Configurar a un closer» y el panel «Acceso simulado» del operador.
//
// Es la lista del equipo que el backend deja simular (`GET /auth/impersonate/equipo`: la dirección
// comercial ve closers y setters; admin y operador, a todos), con buscador y filtro por rol. «Entrar»
// simula en esta pestaña; el botón de al lado, en una pestaña nueva y aislada. A quien tiene varios
// roles (o ve Finances) se le pregunta con cuál, en la misma pantalla del Portal (ElegirRolAlSimular).

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import api from '../services/api';
import HojaModal from '../components/ui/HojaModal';
import Mascota from '../components/mascota/Mascota';
import { mascotaDe } from '../components/mascota/mascotas';
import ElegirRolAlSimular, { hayQueElegir } from '../components/shared/ElegirRolAlSimular';
import { rotuloDeRol } from '../utils/cuentasVinculadas';
import { simularA, simularEnPestanaNueva } from '../utils/impersonation';
import { useTemaDeHoja } from './temaDeHoja';
import '../pages/agendas_v2/thalamus.css';
import './simular.css';

const ORDEN = ['closer', 'setter', 'triage', 'operator', 'hiring', 'director_comercial', 'director_marketing', 'admin'];
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const mensaje = (e) => e?.response?.data?.message || e?.message || 'No se pudo iniciar la simulación';

export default function Simular({ onCerrar }) {
    const [raiz, dataTheme] = useTemaDeHoja();
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

    // `rolElegido` null: el principal. Si falla, en la pestaña nueva lo dice acá; con la elección de rol
    // abierta, lo muestra esa pantalla (por eso lanza).
    const simular = async (persona, rolElegido = null, destino = null, nueva = false) => {
        setError(null);
        if (nueva) {
            await simularEnPestanaNueva(persona.id, destino, rolElegido);
            onCerrar();
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

    if (eligiendo) {
        return (
            <ElegirRolAlSimular persona={eligiendo.persona}
                onElegir={(r, destino) => simular(eligiendo.persona, r, destino, eligiendo.nueva)}
                onCancelar={() => setEligiendo(null)} />
        );
    }

    return (
        <HojaModal titulo="Simular a alguien" onCerrar={onCerrar}>
            <div ref={raiz} className="thalamus sim" data-theme={dataTheme}>
                <header className="sim-cab">
                    <h2 className="t-h2">Simular a alguien</h2>
                    <p className="t-sm mut">Entrás a la app como esa persona. Lo que hagas queda hecho en su cuenta.</p>
                </header>
                <label className="sim-buscar">
                    <Search size={16} aria-hidden="true" />
                    <input className="input" type="search" placeholder="Buscar por nombre" aria-label="Buscar por nombre"
                        value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
                </label>
                {roles.length > 1 && (
                    <div className="seg seg--sm sim-roles" role="group" aria-label="Filtrar por rol">
                        <button type="button" aria-pressed={!rol} onClick={() => setRol(null)}>Todos</button>
                        {roles.map((r) => (
                            <button key={r} type="button" aria-pressed={rol === r} onClick={() => setRol(r)}>{rotuloDeRol(r)}</button>
                        ))}
                    </div>
                )}
                {error && <p className="sim-error" role="alert">{error}</p>}
                {equipo === null && !error && <p className="t-sm mut">Cargando el equipo…</p>}
                {equipo !== null && !lista.length && <p className="t-sm mut">{q || rol ? 'Nadie coincide con la búsqueda.' : 'No hay a quién simular.'}</p>}
                <ul className="sim-lista">
                    {lista.map((p) => (
                        <li key={p.id} className="sim-fila">
                            <span className="sim-avatar" aria-hidden="true"><Mascota personaje={mascotaDe(p, p.username)} size={36} /></span>
                            <span className="sim-id">
                                <b className="trunc">{p.username}</b>
                                <span className="t-cap mut trunc">{p.roles.map(rotuloDeRol).join(' · ')}</span>
                            </span>
                            <button type="button" className="btn btn--sm btn--cta" disabled={!!entrando}
                                aria-label={`Simular a ${p.username}`} onClick={() => entrar(p)}>
                                {entrando === p.id ? 'Entrando…' : 'Entrar'}
                            </button>
                            <button type="button" className="btn btn--sm btn--linea sim-nueva" disabled={!!entrando}
                                aria-label={`Simular a ${p.username} en una pestaña nueva`} title="En una pestaña nueva"
                                onClick={() => entrar(p, true)}>
                                <ExternalLink size={14} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            </div>
        </HojaModal>
    );
}
