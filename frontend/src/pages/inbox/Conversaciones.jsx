// Sección Conversaciones, como bandeja de triage: la lista, el chat y la ficha del lead. En la cabecera,
// al lado del título, los filtros guardados; a la derecha, el buscador, el filtro (cola, asignado,
// examen, «hoy») y Stats. La lista y el chat abierto se vuelven a pedir solos cada 20 s.
import { useEffect, useState } from 'react';
import { BarChart3, MessageSquare, Search } from 'lucide-react';
import { EmptyState, HeaderActions, IconButton, InputGroup, Panel } from '../../components/standard';
import { useAuth } from '../../contexts/AuthContext';
import { inboxApi } from './api';
import { COLAS, REFRESCO, filtrar } from './conversaciones/colas';
import Detalle from './conversaciones/Detalle';
import Fila from './conversaciones/Fila';
import FiltrosGuardados from './conversaciones/FiltrosGuardados';
import MacroFiltro from './conversaciones/MacroFiltro';
import Stats from './conversaciones/Stats';
import { VACIO } from './conversaciones/filtros';

const LIMITE = 300;

// La espera se recalcula sola cada minuto.
function useAhora() {
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    return ahora;
}

// La lista: al buscar, a los 250 ms; después, cada REFRESCO sin vaciar lo que se ve.
function useConversaciones(buscar) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        let vivo = true;
        const pedir = () => inboxApi.conversaciones(buscar.trim(), LIMITE)
            .then((d) => { if (vivo) { setDatos(d); setError(null); } })
            .catch(() => { if (vivo) setError('No se pudieron cargar las conversaciones'); });
        const primera = setTimeout(pedir, 250);
        const cada = setInterval(pedir, REFRESCO);
        return () => { vivo = false; clearTimeout(primera); clearInterval(cada); };
    }, [buscar]);
    return [datos, error];
}

export default function Conversaciones() {
    const { user } = useAuth() || {};
    const yo = user?.id ?? null;
    const [buscar, setBuscar] = useState('');
    // El setter arranca en lo suyo que espera; el resto, en todo lo que espera.
    const [filtro, setFiltro] = useState(() => ({ ...VACIO, cola: 'esperan', asignado: user?.role === 'setter' ? yo : null }));
    const [elegida, setElegida] = useState(null);
    const [stats, setStats] = useState(false);
    const [datos, error] = useConversaciones(buscar);
    const ahora = useAhora();

    const lista = datos?.conversaciones || [];
    const visibles = filtrar(lista, { ...filtro, ahora });
    const cola = COLAS.find((c) => c.value === filtro.cola) || COLAS[0];

    let listado;
    if (error && !datos) listado = <EmptyState>{error}</EmptyState>;
    else if (!datos) listado = <EmptyState>Cargando…</EmptyState>;
    else if (!lista.length) {
        listado = (
            <EmptyState icon={<MessageSquare size={22} />}>
                {buscar.trim() ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay conversaciones. Aparecen cuando el motor empieza a procesar los mensajes de Instagram.'}
            </EmptyState>
        );
    } else if (!visibles.length) {
        listado = <EmptyState>{filtro.cola === 'esperan' ? 'Nadie espera respuesta con este filtro. 🎉' : 'No hay conversaciones con este filtro.'}</EmptyState>;
    } else {
        listado = (
            <>
                <p className="cv-lista-cab t-cap mut">
                    {visibles.length === 1 ? '1 conversación' : `${visibles.length} conversaciones`}
                    {cola.porEspera ? ' · por espera' : ' · por último mensaje'}
                </p>
                <ul>{visibles.map((c) => <Fila key={c.id} c={c} ahora={ahora} yo={yo} elegida={elegida === c.id} onElegir={setElegida} />)}</ul>
            </>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra cv-barra">
                    <FiltrosGuardados lista={lista} filtro={filtro} onCambiar={setFiltro} ahora={ahora} yo={yo} />
                    <div className="barra-der">
                        <InputGroup className="cv-buscar" prefix={<Search size={16} />}>
                            <label className="sr" htmlFor="cv-buscar">Buscar por usuario</label>
                            <input id="cv-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por usuario o nombre" autoComplete="off" />
                        </InputGroup>
                        <MacroFiltro lista={lista} filtro={filtro} onCambiar={setFiltro} ahora={ahora} yo={yo} />
                        <IconButton label="Stats" data-tip="Stats" icon={<BarChart3 size={16} />} onClick={() => setStats(true)} />
                    </div>
                </div>
            </HeaderActions>
            <div className={`cv${elegida ? ' cv--abierta' : ''}`}>
                <Panel as="section" size="sm" className="cv-lista" aria-label="Conversaciones">{listado}</Panel>
                {elegida
                    ? <Detalle key={elegida} id={elegida} yo={yo} />
                    : <Panel size="sm" className="cv-detalle cv-detalle--vacio"><EmptyState icon={<MessageSquare size={22} />}>Elegí una conversación.</EmptyState></Panel>}
            </div>
            {stats && (
                <Stats lista={lista} mediana={datos?.mediana_respuesta} setters={datos?.medianas_setters || []} yo={yo} ahora={ahora}
                    onCerrar={() => setStats(false)} />
            )}
        </>
    );
}
