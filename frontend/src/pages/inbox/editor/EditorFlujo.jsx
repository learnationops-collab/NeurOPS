// El lienzo de un flujo: cajas y flechas (React Flow) que ocupan todo el ancho, con la paleta de pasos y
// el inspector del nodo elegido flotando encima (como el Flujo de un evento en Thalamus). La barra
// (volver, nombre, estado, Guardar y Publicar) va en la fila del título de la página (HeaderActions).
// Lo que se edita es el BORRADOR: «Guardar» lo deja en el servidor; «Publicar» lo pone a correr
// (el servidor lo valida y devuelve los errores en castellano).
import { useCallback, useEffect, useState } from 'react';
import {
    addEdge, applyEdgeChanges, applyNodeChanges, Background, Controls, MiniMap, Panel as RFPanel, ReactFlow, ReactFlowProvider, useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ArrowLeft, Clock, Flag, GitBranch, LogOut, MessageSquare, Pause, Play, Save, Send, Zap } from 'lucide-react';
import { Button, HeaderActions, IconButton, Input, Modal, ModalHeader, Status, toast } from '../../../components/standard';
import { aGrafo, aLienzo, conectar, INICIO, nodoNuevo } from './grafoFlujo';
import { TIPOS_DE_NODO } from './nodos';
import Panel from './Panel';
import { estadoDe } from '../estadoFlujo';
import { inboxApi } from '../api';

const AGREGAR = [
    { tipo: 'mensaje', label: 'Mensaje', Icono: MessageSquare },
    { tipo: 'esperar', label: 'Esperar', Icono: Clock },
    { tipo: 'condicion', label: 'Condición', Icono: GitBranch },
    { tipo: 'accion', label: 'Acción', Icono: Zap },
    { tipo: 'fin', label: 'Fin', Icono: Flag },
];

function Lienzo({ flujoInicial, lectura, onVolver, onCambio }) {
    const [nodos, setNodos] = useState(() => aLienzo(flujoInicial.grafo).nodos);
    const [aristas, setAristas] = useState(() => aLienzo(flujoInicial.grafo).aristas);
    const [flujo, setFlujo] = useState(flujoInicial);
    const [errores, setErrores] = useState(flujoInicial.errores || []);
    const [sucio, setSucio] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [salir, setSalir] = useState(false);
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
        try {
            const datos = await inboxApi.guardarFlujo(flujo.id, { nombre: nombre.trim() || flujo.nombre, grafo: aGrafo(nodos, aristas) });
            setFlujo(datos);
            setErrores(datos.errores || []);
            setSucio(false);
            onCambio?.(datos);
            return datos;
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo guardar', 'error');
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
            toast(`Publicado: versión ${datos.version}`);
            onCambio?.(datos);
        } catch (e) {
            setErrores(e.response?.data?.errores || []);
            toast(e.response?.data?.message || 'No se pudo publicar', 'error');
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
            toast(e.response?.data?.message || 'No se pudo cambiar el estado', 'error');
        } finally {
            setOcupado(false);
        }
    };
    const volver = () => { if (sucio) setSalir(true); else onVolver(); };
    const guardarYSalir = async () => { if (await guardar()) onVolver(); };

    const deInicio = aristas.find((a) => a.source === INICIO)?.target;

    const est = estadoDe(flujo);
    const nErrores = errores.length;

    return (
        <>
            <HeaderActions replaceTitle>
                <div className="barra">
                    <Button icon={<ArrowLeft />} onClick={volver}>Flujos</Button>
                    <Input className="ef-nombre" value={nombre} disabled={lectura} aria-label="Nombre del flujo" maxLength={150}
                        onChange={(e) => { setNombre(e.target.value); marcar(); }} />
                    <Status color={est.color}>{est.texto}</Status>
                    {sucio && <Status color="var(--warning)">Sin guardar</Status>}
                    {!sucio && flujo.cambios_sin_publicar && flujo.version && (
                        <Status color="var(--warning)" data-tip="Cambios sin publicar|Lo que corre es la última versión publicada.">Sin publicar</Status>
                    )}
                    {!lectura && (
                        <div className="barra-der">
                            <Button icon={<Save />} onClick={guardar} disabled={ocupado || !sucio}>Guardar</Button>
                            {flujo.version && (
                                <Button icon={flujo.estado === 'activo' ? <Pause /> : <Play />} onClick={pausarOActivar} disabled={ocupado}>
                                    {flujo.estado === 'activo' ? 'Pausar' : 'Activar'}
                                </Button>
                            )}
                            <Button variant="primary" icon={<Send />} onClick={publicar} disabled={ocupado}>Publicar</Button>
                        </div>
                    )}
                </div>
            </HeaderActions>
            <div className="ef-lienzo">
                <ReactFlow nodes={nodos} edges={aristas} nodeTypes={TIPOS_DE_NODO}
                    onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                    nodesDraggable={!lectura} nodesConnectable={!lectura} elementsSelectable
                    deleteKeyCode={lectura ? null : ['Backspace', 'Delete']}
                    fitView fitViewOptions={{ padding: 0.2 }} minZoom={0.2} proOptions={{ hideAttribution: true }}
                    defaultEdgeOptions={{ type: 'smoothstep' }}>
                    <Background gap={22} size={1.2} />
                    <Controls showInteractive={false} />
                    {/* Con un nodo elegido, el inspector ocupa la derecha: el minimapa se esconde. */}
                    {!seleccion && <MiniMap pannable zoomable className="ef-mapa" />}
                    {!lectura && (
                        <RFPanel position="top-left" className="ef-paleta" role="group" aria-label="Agregar paso">
                            {AGREGAR.map(({ tipo, label, Icono }) => (
                                <IconButton key={tipo} label={`Agregar ${label}`} icon={<Icono />} size="sm" data-tip={label} onClick={() => agregar(tipo)} />
                            ))}
                            {!seleccion && <span className="ef-ayuda">Arrastrá desde una salida hasta otra caja para conectarlas.</span>}
                        </RFPanel>
                    )}
                    {nErrores > 0 && (
                        <RFPanel position="top-center">
                            <details className="ef-errores">
                                <summary><AlertTriangle size={14} />{nErrores === 1 ? '1 cosa para resolver antes de publicar' : `${nErrores} cosas para resolver antes de publicar`}</summary>
                                <ul>{errores.map((e) => <li key={e}>{e}</li>)}</ul>
                            </details>
                        </RFPanel>
                    )}
                </ReactFlow>
                {seleccion && (
                    <Panel seleccion={seleccion} lectura={lectura}
                        onCambiarNodo={cambiarNodo} onCambiarDisparadores={cambiarDisparadores}
                        onBorrar={borrarSeleccion} onCerrar={() => setNodos((ns) => ns.map((n) => ({ ...n, selected: false })))}
                        esInicioDelFlujo={seleccion.id === deInicio} onHacerInicio={hacerInicio} />
                )}
            </div>
            {salir && (
                <Modal onClose={() => setSalir(false)} className="ef-salir" labelledBy="ef-salir-t">
                    <ModalHeader titleId="ef-salir-t" title="Hay cambios sin guardar" subtitle="Si salís ahora, se pierden." onClose={() => setSalir(false)} />
                    <div className="barra">
                        <Button onClick={() => setSalir(false)}>Seguir editando</Button>
                        <div className="barra-der">
                            <Button variant="dangerSolid" icon={<LogOut />} onClick={onVolver}>Salir sin guardar</Button>
                            <Button variant="primary" icon={<Save />} onClick={guardarYSalir} disabled={ocupado}>Guardar y salir</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </>
    );
}

export default function EditorFlujo(props) {
    return <ReactFlowProvider><Lienzo {...props} /></ReactFlowProvider>;
}
