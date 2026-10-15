// El lienzo de un flujo: cajas y flechas (React Flow) + el panel del nodo elegido.
// Lo que se edita es el BORRADOR: «Guardar» lo deja en el servidor; «Publicar» lo pone a correr
// (el servidor lo valida y devuelve los errores en castellano).
import { useCallback, useEffect, useState } from 'react';
import {
    addEdge, applyEdgeChanges, applyNodeChanges, Background, Controls, MiniMap, ReactFlow, ReactFlowProvider, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ArrowLeft, Clock, Flag, GitBranch, MessageSquare, Pause, Play, Save, Send, Zap } from 'lucide-react';
import { aGrafo, aLienzo, conectar, INICIO, nodoNuevo } from './grafoFlujo';
import { TIPOS_DE_NODO } from './nodos';
import Panel from './Panel';
import { inboxApi } from '../api';

const AGREGAR = [
    { tipo: 'mensaje', label: 'Mensaje', Icono: MessageSquare },
    { tipo: 'esperar', label: 'Esperar', Icono: Clock },
    { tipo: 'condicion', label: 'Condición', Icono: GitBranch },
    { tipo: 'accion', label: 'Acción', Icono: Zap },
    { tipo: 'fin', label: 'Fin', Icono: Flag },
];

const ESTADO = { borrador: 'Borrador', activo: 'Activo', pausado: 'Pausado' };

function Lienzo({ flujoInicial, lectura, onVolver, onCambio }) {
    const [nodos, setNodos] = useState(() => aLienzo(flujoInicial.grafo).nodos);
    const [aristas, setAristas] = useState(() => aLienzo(flujoInicial.grafo).aristas);
    const [flujo, setFlujo] = useState(flujoInicial);
    const [errores, setErrores] = useState(flujoInicial.errores || []);
    const [sucio, setSucio] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [aviso, setAviso] = useState(null);
    const [nombre, setNombre] = useState(flujoInicial.nombre);
    const { screenToFlowPosition } = useReactFlow();

    const seleccion = nodos.find((n) => n.selected) || null;
    const marcar = () => setSucio(true);

    // Avisar antes de salir con cambios sin guardar.
    useEffect(() => {
        if (!sucio) return undefined;
        const fn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', fn);
        return () => window.removeEventListener('beforeunload', fn);
    }, [sucio]);

    const onNodesChange = useCallback((cambios) => {
        const filtrados = lectura ? cambios.filter((c) => c.type === 'select') : cambios.filter((c) => !(c.type === 'remove' && c.id === INICIO));
        setNodos((ns) => applyNodeChanges(filtrados, ns));
        if (filtrados.some((c) => c.type === 'position' || c.type === 'remove')) marcar();
    }, [lectura]);
    const onEdgesChange = useCallback((cambios) => {
        if (lectura) return;
        setAristas((as) => applyEdgeChanges(cambios, as));
        if (cambios.some((c) => c.type === 'remove')) marcar();
    }, [lectura]);
    const onConnect = useCallback((c) => {
        if (lectura) return;
        setAristas((as) => conectar(as, c));
        marcar();
    }, [lectura]);

    const cambiarNodo = (nuevo) => {
        setNodos((ns) => ns.map((n) => (n.id === nuevo.id ? { ...n, data: { ...n.data, nodo: nuevo } } : n)));
        marcar();
    };
    const cambiarDisparadores = (disparadores) => {
        setNodos((ns) => ns.map((n) => (n.id === INICIO ? { ...n, data: { ...n.data, disparadores } } : n)));
        marcar();
    };
    const borrarSeleccion = () => {
        if (!seleccion || seleccion.id === INICIO) return;
        setNodos((ns) => ns.filter((n) => n.id !== seleccion.id));
        setAristas((as) => as.filter((a) => a.source !== seleccion.id && a.target !== seleccion.id));
        marcar();
    };
    const hacerInicio = () => {
        setAristas((as) => addEdge({ id: 'c-inicio', source: INICIO, sourceHandle: 'inicio', target: seleccion.id },
            as.filter((a) => a.source !== INICIO)));
        marcar();
    };
    const agregar = (tipo) => {
        const centro = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const nodo = nodoNuevo(tipo, { x: Math.round(centro.x - 120), y: Math.round(centro.y - 60) });
        setNodos((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: nodo.id, type: tipo, position: nodo.posicion, data: { nodo }, selected: true }]);
        // El primer nodo del flujo queda conectado al inicio.
        if (!aristas.some((a) => a.source === INICIO)) setAristas((as) => [...as, { id: 'c-inicio', source: INICIO, sourceHandle: 'inicio', target: nodo.id }]);
        marcar();
    };

    const guardar = async () => {
        setOcupado(true);
        setAviso(null);
        try {
            const datos = await inboxApi.guardarFlujo(flujo.id, { nombre: nombre.trim() || flujo.nombre, grafo: aGrafo(nodos, aristas) });
            setFlujo(datos);
            setErrores(datos.errores || []);
            setSucio(false);
            onCambio?.(datos);
            return datos;
        } catch (e) {
            setAviso({ tipo: 'error', texto: e.response?.data?.message || 'No se pudo guardar' });
            return null;
        } finally {
            setOcupado(false);
        }
    };
    const publicar = async () => {
        const guardado = sucio ? await guardar() : flujo;
        if (!guardado) return;
        setOcupado(true);
        try {
            const datos = await inboxApi.publicarFlujo(flujo.id);
            setFlujo((f) => ({ ...f, ...datos }));
            setErrores([]);
            setAviso({ tipo: 'ok', texto: `Publicado: versión ${datos.version}` });
            onCambio?.(datos);
        } catch (e) {
            setErrores(e.response?.data?.errores || []);
            setAviso({ tipo: 'error', texto: e.response?.data?.message || 'No se pudo publicar' });
        } finally {
            setOcupado(false);
        }
    };
    const pausarOActivar = async () => {
        setOcupado(true);
        try {
            const datos = flujo.estado === 'activo' ? await inboxApi.pausarFlujo(flujo.id) : await inboxApi.activarFlujo(flujo.id);
            setFlujo((f) => ({ ...f, ...datos }));
            onCambio?.(datos);
        } catch (e) {
            setAviso({ tipo: 'error', texto: e.response?.data?.message || 'No se pudo cambiar el estado' });
        } finally {
            setOcupado(false);
        }
    };
    const volver = () => {
        if (sucio && !window.confirm('Hay cambios sin guardar. ¿Salir igual?')) return;
        onVolver();
    };

    const deInicio = aristas.find((a) => a.source === INICIO)?.target;

    return (
        <div className="ef">
            <div className="ef-barra">
                <button type="button" className="btn btn--linea btn--sm" onClick={volver}><ArrowLeft />Flujos</button>
                <input className="input ef-nombre" value={nombre} disabled={lectura} aria-label="Nombre del flujo"
                    onChange={(e) => { setNombre(e.target.value); marcar(); }} />
                <span className={`chip ef-estado ef-estado--${flujo.estado}`}>
                    {ESTADO[flujo.estado] || flujo.estado}{flujo.version ? ` · v${flujo.version}` : ''}
                </span>
                {sucio && <span className="chip chip--n ef-sucio">Sin guardar</span>}
                {!sucio && flujo.cambios_sin_publicar && flujo.version && <span className="chip chip--n ef-sucio">Cambios sin publicar</span>}
                <div className="ef-acciones">
                    {!lectura && (
                        <>
                            <div className="ef-agregar" role="group" aria-label="Agregar caja">
                                {AGREGAR.map(({ tipo, label, Icono }) => (
                                    <button key={tipo} type="button" className="btn btn--linea btn--sm" onClick={() => agregar(tipo)}><Icono />{label}</button>
                                ))}
                            </div>
                            <button type="button" className="btn btn--linea btn--sm" onClick={guardar} disabled={ocupado || !sucio}><Save />Guardar</button>
                            {flujo.version && (
                                <button type="button" className="btn btn--linea btn--sm" onClick={pausarOActivar} disabled={ocupado}>
                                    {flujo.estado === 'activo' ? <><Pause />Pausar</> : <><Play />Activar</>}
                                </button>
                            )}
                            <button type="button" className="btn btn--cta btn--sm" onClick={publicar} disabled={ocupado}><Send />Publicar</button>
                        </>
                    )}
                </div>
            </div>
            {aviso && <p className={`ef-aviso ef-aviso--${aviso.tipo}`} role="status">{aviso.texto}</p>}
            {errores.length > 0 && (
                <details className="ef-errores" open={aviso?.tipo === 'error'}>
                    <summary><AlertTriangle size={14} />{errores.length === 1 ? '1 cosa para resolver antes de publicar' : `${errores.length} cosas para resolver antes de publicar`}</summary>
                    <ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul>
                </details>
            )}
            <div className="ef-cuerpo">
                <div className="ef-lienzo">
                    <ReactFlow nodes={nodos} edges={aristas} nodeTypes={TIPOS_DE_NODO}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                        nodesDraggable={!lectura} nodesConnectable={!lectura} elementsSelectable
                        deleteKeyCode={lectura ? null : ['Backspace', 'Delete']}
                        fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} proOptions={{ hideAttribution: true }}
                        defaultEdgeOptions={{ type: 'smoothstep' }}>
                        <Background gap={24} size={1} />
                        <Controls showInteractive={false} />
                        <MiniMap pannable zoomable className="ef-mapa" />
                    </ReactFlow>
                </div>
                <Panel seleccion={seleccion} lectura={lectura}
                    onCambiarNodo={cambiarNodo} onCambiarDisparadores={cambiarDisparadores}
                    onBorrar={borrarSeleccion} onCerrar={() => setNodos((ns) => ns.map((n) => ({ ...n, selected: false })))}
                    esInicioDelFlujo={seleccion?.id === deInicio} onHacerInicio={hacerInicio} />
            </div>
        </div>
    );
}

export default function EditorFlujo(props) {
    return <ReactFlowProvider><Lienzo {...props} /></ReactFlowProvider>;
}
