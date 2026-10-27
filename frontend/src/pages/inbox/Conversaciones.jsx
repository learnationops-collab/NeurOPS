// Sección Conversaciones, como bandeja de trabajo (estilo Kommo): la lista, el chat y la ficha del lead,
// o la vista Embudo (una columna por sub-etapa). En la cabecera, al lado del título, los filtros guardados
// y Chats | Embudo; a la derecha, el buscador, el filtro, Mis tareas y Stats. La lista y el chat abierto
// se vuelven a pedir solos cada 20 s.
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Kanban, MessageSquare, Search } from 'lucide-react';
import { EmptyState, HeaderActions, IconButton, InputGroup, Panel, Segmented } from '../../components/standard';
import { useAuth } from '../../contexts/AuthContext';
import { inboxApi } from './api';
import { COLAS, REFRESCO, filtrar } from './conversaciones/colas';
import Detalle from './conversaciones/Detalle';
import Embudo from './conversaciones/Embudo';
import Fila from './conversaciones/Fila';
import FiltrosGuardados from './conversaciones/FiltrosGuardados';
import MacroFiltro from './conversaciones/MacroFiltro';
import MisTareas from './conversaciones/MisTareas';
import Stats from './conversaciones/Stats';
import { VACIO } from './conversaciones/filtros';
import './conversaciones/trabajo.css';

const LIMITE = 300;
const VISTAS = [
    { value: 'chats', label: 'Chats', icon: <MessageSquare size={14} /> },
    { value: 'embudo', label: 'Embudo', icon: <Kanban size={14} /> },
];

// La espera se recalcula sola cada minuto.
function useAhora() {
    const [ahora, setAhora] = useState(() => new Date());
    useEffect(() => {
        const t = setInterval(() => setAhora(new Date()), 60000);
        return () => clearInterval(t);
    }, []);
    return ahora;
}

// La lista: al buscar, a los 250 ms; después, cada REFRESCO sin vaciar lo que se ve. `vuelta` la pide ya.
function useConversaciones(buscar) {
    const [datos, setDatos] = useState(null);
    const [error, setError] = useState(null);
    const [vuelta, setVuelta] = useState(0);
    useEffect(() => {
        let vivo = true;
        const pedir = () => inboxApi.conversaciones(buscar.trim(), LIMITE)
            .then((d) => { if (vivo) { setDatos(d); setError(null); } })
            .catch(() => { if (vivo) setError('No se pudieron cargar las conversaciones'); });
        const primera = setTimeout(pedir, vuelta ? 0 : 250);
        const cada = setInterval(pedir, REFRESCO);
        return () => { vivo = false; clearTimeout(primera); clearInterval(cada); };
    }, [buscar, vuelta]);
    const recargar = useCallback(() => setVuelta((v) => v + 1), []);
    return [datos, error, recargar];
}

export default function Conversaciones() {
    const { user } = useAuth() || {};
    const yo = user?.id ?? null;
    const [buscar, setBuscar] = useState('');
    // El setter arranca en lo suyo sin respuesta; el resto, en todo lo que espera.
    const [filtro, setFiltro] = useState(() => ({ ...VACIO, cola: 'esperan', asignado: user?.role === 'setter' ? yo : null }));
    const [vista, setVista] = useState('chats');
    const [elegida, setElegida] = useState(null);
    const [leidas, setLeidas] = useState({});
    const [stats, setStats] = useState(false);
    const [datos, error, recargar] = useConversaciones(buscar);
    const ahora = useAhora();

    // Lo que acabo de leer deja de contar como «sin leer» sin esperar a la próxima vuelta (hasta que llegue otro).
    const lista = (datos?.conversaciones || []).map((c) => (
        c.sin_leer && leidas[c.id] && new Date(c.ultimo_en) <= leidas[c.id] ? { ...c, sin_leer: 0 } : c));
    const marcarLeida = useCallback((id) => setLeidas((l) => ({ ...l, [id]: new Date() })), []);
    const visibles = filtrar(lista, { ...filtro, ahora });
    const cola = COLAS.find((c) => c.value === filtro.cola) || COLAS[0];
    const abrir = (id) => { setVista('chats'); setElegida(id); };
    // En lo propio no hace falta decir de quién es; en el resto, sí.
    const conAsignado = filtro.asignado !== yo;

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
        const sinLeer = visibles.filter((c) => c.sin_leer > 0).length;
        listado = (
            <>
                <p className="cv-lista-cab t-cap mut">
                    {visibles.length === 1 ? '1 conversación' : `${visibles.length} conversaciones`}
                    {cola.porEspera ? ' · por espera' : ' · por último mensaje'}
                    {sinLeer > 0 && <span className="cv-lista-nuevos"> · {sinLeer} sin leer</span>}
                </p>
                <ul>{visibles.map((c) => <Fila key={c.id} c={c} ahora={ahora} yo={yo} conAsignado={conAsignado} elegida={elegida === c.id} onElegir={setElegida} />)}</ul>
            </>
        );
    }

    return (
        <>
            <HeaderActions>
                <div className="barra cv-barra">
                    <FiltrosGuardados lista={lista} filtro={filtro} onCambiar={setFiltro} ahora={ahora} yo={yo} />
                    <Segmented size="sm" label="Vista" value={vista} onChange={setVista} options={VISTAS} />
                    <div className="barra-der">
                        <InputGroup className="cv-buscar" prefix={<Search size={16} />}>
                            <label className="sr" htmlFor="cv-buscar">Buscar por usuario</label>
                            <input id="cv-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por usuario o nombre" autoComplete="off" />
                        </InputGroup>
                        <MacroFiltro lista={lista} filtro={filtro} onCambiar={setFiltro} ahora={ahora} yo={yo} />
                        <MisTareas onAbrir={abrir} marca={datos} />
                        <IconButton label="Stats" data-tip="Stats" icon={<BarChart3 size={16} />} onClick={() => setStats(true)} />
                    </div>
                </div>
            </HeaderActions>
            {vista === 'embudo' ? <Embudo lista={visibles} ahora={ahora} onAbrir={abrir} onMovida={recargar} /> : (
                <div className={`cv${elegida ? ' cv--abierta' : ''}`}>
                    <Panel as="section" size="sm" className="cv-lista" aria-label="Conversaciones">{listado}</Panel>
                    {elegida
                        ? <Detalle key={elegida} id={elegida} yo={yo} onLeido={marcarLeida} />
                        : <Panel size="sm" className="cv-detalle cv-detalle--vacio"><EmptyState icon={<MessageSquare size={22} />}>Elegí una conversación.</EmptyState></Panel>}
                </div>
            )}
            {stats && (
                <Stats lista={lista} mediana={datos?.mediana_respuesta} setters={datos?.medianas_setters || []} yo={yo} ahora={ahora}
                    onCerrar={() => setStats(false)} />
            )}
        </>
    );
}
