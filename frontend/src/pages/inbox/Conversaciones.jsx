// Sección Conversaciones, como bandeja de trabajo (estilo Kommo): la lista, el chat y la ficha del lead,
// o la vista Embudo (una columna por sub-etapa). En la cabecera, al lado del título, los filtros guardados
// y Chats | Embudo; a la derecha, Mis tareas, avisos y Stats. Arriba de la lista (ADR-W184): el buscador, a quién
// está asignada, el filtro, Ordenar y «Elegir» (etiquetar varias), y los filtros guardados; en el Embudo, que no
// tiene lista, el buscador y el filtro van en la cabecera. La lista y el chat abierto
// se vuelven a pedir solos cada 20 s. Con el teclado: ↑↓ cambian de conversación y Esc la cierra. Las sin leer
// van al título de la pestaña y, con permiso, como aviso del escritorio (`useAvisos`).
import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Bell, Kanban, ListChecks, MessageSquare, Search, Tag } from 'lucide-react';
import { Button, EmptyState, HeaderActions, IconButton, InputGroup, Panel, Segmented, Select } from '../../components/standard';
import { useAuth } from '../../contexts/AuthContext';
import { inboxApi } from './api';
import { REFRESCO, asignados, filtrar, ordenDe } from './conversaciones/colas';
import ChipsGuardados from './conversaciones/ChipsGuardados';
import EtiquetarVarias from './conversaciones/EtiquetarVarias';
import Ordenar from './conversaciones/Ordenar';
import Detalle from './conversaciones/Detalle';
import Embudo from './conversaciones/Embudo';
import Fila from './conversaciones/Fila';
import FiltrosGuardados from './conversaciones/FiltrosGuardados';
import MacroFiltro from './conversaciones/MacroFiltro';
import MisTareas from './conversaciones/MisTareas';
import Resumen from './conversaciones/Resumen';
import Stats from './conversaciones/Stats';
import { VACIO } from './conversaciones/filtros';
import { useBorradores } from './conversaciones/borradores';
import useAvisos from './conversaciones/useAvisos';
import { recordado, recordar } from './recuerdo';
import './conversaciones/trabajo.css';
import './conversaciones/setting.css';

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
    const [datos, setDatos] = useState(() => recordado(`conversaciones:${buscar.trim()}`));
    const [error, setError] = useState(null);
    const [vuelta, setVuelta] = useState(0);
    useEffect(() => {
        let vivo = true;
        const pedir = () => inboxApi.conversaciones(buscar.trim(), LIMITE)
            .then((d) => { recordar(`conversaciones:${buscar.trim()}`, d); if (vivo) { setDatos(d); setError(null); } })
            .catch(() => { if (vivo) setError('No se pudieron cargar las conversaciones'); });
        const primera = setTimeout(pedir, vuelta ? 0 : 250);
        const cada = setInterval(pedir, REFRESCO);
        return () => { vivo = false; clearTimeout(primera); clearInterval(cada); };
    }, [buscar, vuelta]);
    const recargar = useCallback(() => setVuelta((v) => v + 1), []);
    return [datos, error, recargar];
}

const escribiendo = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

// ↑↓ pasan a la conversación de arriba o de abajo de la lista; Esc cierra la abierta. No mientras se escribe ni
// con un modal abierto.
function useTeclado(visibles, elegida, setElegida) {
    useEffect(() => {
        const alTeclear = (e) => {
            if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || escribiendo(e.target)) return;
            if (document.querySelector('[role="dialog"]')) return;
            if (e.key === 'Escape' && elegida) { setElegida(null); return; }
            if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
            if (!visibles.length) return;
            e.preventDefault();
            const i = visibles.findIndex((c) => c.id === elegida);
            const j = i < 0 ? 0 : Math.min(visibles.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)));
            setElegida(visibles[j].id);
            document.querySelector(`.cv-lista [data-conversacion="${visibles[j].id}"]`)?.scrollIntoView({ block: 'nearest' });
        };
        document.addEventListener('keydown', alTeclear);
        return () => document.removeEventListener('keydown', alTeclear);
    }, [visibles, elegida, setElegida]);
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
    // Etiquetar varias (1426): con «Elegir», tocar una fila la marca.
    const [eligiendo, setEligiendo] = useState(false);
    const [marcadas, setMarcadas] = useState([]);
    const [etiquetando, setEtiquetando] = useState(false);
    const borradores = useBorradores();
    const [datos, error, recargar] = useConversaciones(buscar);
    const ahora = useAhora();

    // Lo que acabo de leer deja de contar como «sin leer» sin esperar a la próxima vuelta (hasta que llegue otro).
    const lista = (datos?.conversaciones || []).map((c) => (
        c.sin_leer && leidas[c.id] && new Date(c.ultimo_en) <= leidas[c.id] ? { ...c, sin_leer: 0 } : c));
    const marcarLeida = useCallback((id) => setLeidas((l) => ({ ...l, [id]: new Date() })), []);
    const visibles = filtrar(lista, { ...filtro, ahora });
    const orden = ordenDe(filtro);
    const marcar = useCallback((id) => setMarcadas((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id])), []);
    const dejarDeElegir = () => { setEligiendo(false); setMarcadas([]); };
    const abrir = useCallback((id) => { setVista('chats'); setElegida(id); }, []);
    useTeclado(vista === 'chats' && !eligiendo ? visibles : [], elegida, setElegida);
    const avisos = useAvisos(lista, { yo, soloMias: user?.role === 'setter', elegida, onAbrir: abrir });
    // En lo propio no hace falta decir de quién es; en el resto, sí.
    const conAsignado = filtro.asignado !== yo;

    const buscador = (
        <InputGroup className="cv-buscar" prefix={<Search size={16} />}>
            <label className="sr" htmlFor="cv-buscar">Buscar por usuario</label>
            <input id="cv-buscar" value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por usuario o nombre" autoComplete="off" />
        </InputGroup>
    );
    const macro = <MacroFiltro lista={lista} filtro={filtro} onCambiar={setFiltro} ahora={ahora} yo={yo} />;
    // A quién está asignada, al lado del filtro (Social Selling, 17/11).
    const opcionesAsignado = [
        { value: 'todos', label: `De todos · ${lista.length}` },
        ...asignados(lista).map((s) => ({ value: String(s.id), label: `${s.id === yo ? 'Asignadas a vos' : s.username} · ${s.n}` })),
        { value: 'ninguno', label: `Sin asignar · ${lista.filter((c) => !c.asignado).length}` },
    ];
    const valorAsignado = filtro.asignado == null ? 'todos' : String(filtro.asignado);
    // El setter arranca en lo suyo aunque todavía no tenga ninguna asignada.
    if (!opcionesAsignado.some((o) => o.value === valorAsignado)) {
        opcionesAsignado.splice(1, 0, { value: valorAsignado, label: filtro.asignado === yo ? 'Asignadas a vos · 0' : 'Otro setter · 0' });
    }
    const elegirAsignado = (v) => setFiltro({ ...filtro, asignado: v === 'todos' ? null : v === 'ninguno' ? 'ninguno' : Number(v) });

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
                    {` · ${orden.corto}`}
                    {sinLeer > 0 && <span className="cv-lista-nuevos"> · {sinLeer} sin leer</span>}
                </p>
                <ul>{visibles.map((c) => <Fila key={c.id} c={c} ahora={ahora} yo={yo} conAsignado={conAsignado} elegida={elegida === c.id} borrador={borradores[c.id]} onElegir={setElegida}
                    eligiendo={eligiendo} marcada={marcadas.includes(c.id)} onMarcar={marcar} />)}</ul>
                {eligiendo ? (
                    <div className="cv-masiva">
                        <b>{marcadas.length ? `${marcadas.length} ${marcadas.length === 1 ? 'elegida' : 'elegidas'}` : 'Tocá las que querés etiquetar'}</b>
                        <Button size="sm" variant="primary" icon={<Tag />} disabled={!marcadas.length} onClick={() => setEtiquetando(true)}>Etiquetar</Button>
                    </div>
                ) : <p className="cv-lista-pie t-cap mut40"><kbd>↑</kbd> <kbd>↓</kbd> cambiar de chat · <kbd>Esc</kbd> cerrar · <kbd>Enter</kbd> envía</p>}
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
                        {vista === 'embudo' && buscador}
                        {vista === 'embudo' && macro}
                        <MisTareas onAbrir={abrir} marca={datos} />
                        {avisos.soportado && avisos.permiso === 'default' && (
                            <IconButton label="Activar avisos" data-tip="Activar avisos|Te avisa cuando te escribe un lead, aunque estés en otra pestaña" icon={<Bell size={16} />} onClick={avisos.pedirPermiso} />
                        )}
                        <IconButton label="Stats" data-tip="Stats" icon={<BarChart3 size={16} />} onClick={() => setStats(true)} />
                    </div>
                </div>
            </HeaderActions>
            {vista === 'embudo' ? <Embudo lista={visibles} ahora={ahora} onAbrir={abrir} onMovida={recargar} /> : (
                <div className={`cv${elegida ? ' cv--abierta' : ''}`}>
                    <Panel as="section" size="sm" className="cv-lista" aria-label="Conversaciones">
                        <div className="cv-lista-buscar">
                            {buscador}
                            <div className="cv-lista-filtros">
                                <Select label="Asignadas a" className="cv-asignado-sel" value={valorAsignado} options={opcionesAsignado} onChange={elegirAsignado} />
                                {macro}
                                <Ordenar filtro={filtro} onCambiar={setFiltro} />
                                <Button size="sm" variant={eligiendo ? 'primary' : 'secondary'} icon={<ListChecks />}
                                    onClick={() => (eligiendo ? dejarDeElegir() : setEligiendo(true))}>{eligiendo ? 'Listo' : 'Elegir'}</Button>
                            </div>
                        </div>
                        <ChipsGuardados lista={lista} filtro={filtro} onCambiar={setFiltro} ahora={ahora} />
                        {datos && <Resumen lista={lista} filtro={filtro} onCambiar={setFiltro} yo={yo} />}
                        {listado}
                    </Panel>
                    {elegida
                        ? <Detalle key={elegida} id={elegida} yo={yo} onLeido={marcarLeida} onCambio={recargar} />
                        : <Panel size="sm" className="cv-detalle cv-detalle--vacio"><EmptyState icon={<MessageSquare size={22} />}>Elegí una conversación.</EmptyState></Panel>}
                </div>
            )}
            {etiquetando && (
                <EtiquetarVarias conversaciones={lista.filter((c) => marcadas.includes(c.id))} onCerrar={() => setEtiquetando(false)}
                    onHecho={() => { setEtiquetando(false); dejarDeElegir(); recargar(); }} />
            )}
            {stats && (
                <Stats lista={lista} mediana={datos?.mediana_respuesta} setters={datos?.medianas_setters || []} yo={yo} ahora={ahora}
                    onCerrar={() => setStats(false)} />
            )}
        </>
    );
}
