// El lienzo de un flujo: a la izquierda el riel para agregar pasos, al centro las cajas y flechas
// (React Flow) y a la derecha el inspector fijo, que edita el paso elegido o resume el flujo. Las cajas
// muestran su número de paso, el copy, el % por salida y los avisos. La barra (volver, nombre, estado,
// Guardar y Publicar) va en la fila del título de la página (HeaderActions).
// Lo que se edita es el BORRADOR: «Guardar» lo deja en el servidor; «Publicar» lo pone a correr
// (el servidor lo valida y devuelve los errores en castellano).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    applyEdgeChanges, applyNodeChanges, Background, Panel as RFPanel, ReactFlow, ReactFlowProvider, useReactFlow, useViewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ArrowLeft, Clock, Flag, GitBranch, Hash, LogOut, MessageSquare, Minus, Pause, Play, Plus, Save, Send, Zap } from 'lucide-react';
import { Button, Chip, HeaderActions, IconButton, Input, Modal, ModalHeader, Status, toast } from '../../../components/standard';
import { aGrafo, aLienzo, avisosPorNodo, conectar, INICIO, nodoNuevo, ordenPasos } from './grafoFlujo';
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

function Controles({ nAvisos, onAvisos }) {
    const { zoomIn, zoomOut, fitView } = useReactFlow();
    const { zoom } = useViewport();
    return (
        <RFPanel position="bottom-right" className="ef-controles">
            {nAvisos > 0 && (
                <Button className="ef-avisos" icon={<AlertTriangle />} onClick={onAvisos}>{nAvisos === 1 ? '1 aviso' : `${nAvisos} avisos`}</Button>
            )}
            <Button onClick={() => fitView({ padding: 0.2, duration: 200 })}>Ajustar a pantalla</Button>
            <span className="ef-zoom" aria-live="polite">{Math.round(zoom * 100)}%</span>
            <IconButton label="Alejar" icon={<Minus />} size="sm" onClick={() => zoomOut({ duration: 150 })} />
            <IconButton label="Acercar" icon={<Plus />} size="sm" onClick={() => zoomIn({ duration: 150 })} />
        </RFPanel>
    );
}

// Lo que el inspector necesita saber del grafo entero: variables usables, nombres y destinos.
function variablesDe(nodos) {
    const nombres = new Set(['nombre', 'usuario']);
    nodos.forEach((n) => {
        const nodo = n.data.nodo;
        if (nodo?.espera?.guardar_en) nombres.add(nodo.espera.guardar_en);
        (nodo?.acciones || []).forEach((a) => { if (a.tipo === 'variable' && a.nombre) nombres.add(a.nombre); });
    });
    return [...nombres];
}

function Lienzo({ flujoInicial, nodoInicial, lectura, onVolver, onCambio }) {
    const [nodos, setNodos] = useState(() => aLienzo(flujoInicial.grafo).nodos.map((n) => ({ ...n, selected: n.id === nodoInicial })));
    const [aristas, setAristas] = useState(() => aLienzo(flujoInicial.grafo).aristas);
    const [flujo, setFlujo] = useState(flujoInicial);
    const [metricas, setMetricas] = useState(flujoInicial.metricas || null);
    const [errores, setErrores] = useState(flujoInicial.errores || []);
    const [sucio, setSucio] = useState(false);
    const [ocupado, setOcupado] = useState(false);
    const [salir, setSalir] = useState(false);
    const [nombre, setNombre] = useState(flujoInicial.nombre);
    const lienzo = useRef(null);
    const { screenToFlowPosition, fitView } = useReactFlow();

    const seleccion = nodos.find((n) => n.selected) || null;
    const marcar = () => setSucio(true);

    // Avisar antes de salir con cambios sin guardar.
    useEffect(() => {
        if (!sucio) return undefined;
        const fn = (e) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', fn);
        return () => window.removeEventListener('beforeunload', fn);
    }, [sucio]);

    const numeros = useMemo(() => ordenPasos(aGrafo(nodos, aristas)), [nodos, aristas]);
    const avisos = useMemo(() => avisosPorNodo(errores), [errores]);
    const mayor = metricas?.mayor_caida?.id;
    // Lo que se dibuja: los nodos con lo calculado (número, métrica, avisos). No vuelve al grafo.
    const vista = useMemo(() => nodos.map((n) => (n.id === INICIO
        ? { ...n, data: { ...n.data, avisos: avisos.general } }
        : { ...n, data: { ...n.data, numero: numeros[n.id], metrica: metricas?.nodos?.[n.id], mayor: n.id === mayor, avisos: avisos.porNodo[n.id] } })),
    [nodos, numeros, metricas, mayor, avisos]);
    const nombres = useMemo(() => Object.fromEntries(nodos.filter((n) => n.data.nodo?.nombre).map((n) => [n.id, n.data.nodo.nombre])), [nodos]);
    const destinos = useMemo(() => (seleccion
        ? Object.fromEntries(aristas.filter((a) => a.source === seleccion.id).map((a) => [a.sourceHandle, numeros[a.target]]))
        : {}), [seleccion, aristas, numeros]);

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

    const elegir = (id) => {
        setNodos((ns) => ns.map((n) => ({ ...n, selected: n.id === id })));
        if (id) fitView({ nodes: [{ id }], duration: 250, maxZoom: 1, padding: 0.6 });
    };
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
        setAristas((as) => [...as.filter((a) => a.source !== INICIO), { id: 'c-inicio', source: INICIO, sourceHandle: 'inicio', target: seleccion.id }]);
        marcar();
    };
    const agregar = (tipo) => {
        const r = lienzo.current?.getBoundingClientRect();
        const centro = screenToFlowPosition(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });
        const nodo = nodoNuevo(tipo, { x: Math.round(centro.x - 134), y: Math.round(centro.y - 60) });
        setNodos((ns) => [...ns.map((n) => ({ ...n, selected: false })), { id: nodo.id, type: tipo, position: nodo.posicion, data: { nodo }, selected: true }]);
        // El primer nodo del flujo queda conectado al inicio.
        if (!aristas.some((a) => a.source === INICIO)) setAristas((as) => [...as, { id: 'c-inicio', source: INICIO, sourceHandle: 'inicio', target: nodo.id }]);
        marcar();
    };

    const recibir = (datos) => {
        setFlujo((f) => ({ ...f, ...datos }));
        if (datos.metricas?.nodos) setMetricas(datos.metricas);
        onCambio?.(datos);
    };
    const guardar = async () => {
        setOcupado(true);
        try {
            const datos = await inboxApi.guardarFlujo(flujo.id, { nombre: nombre.trim() || flujo.nombre, grafo: aGrafo(nodos, aristas) });
            recibir(datos);
            setErrores(datos.errores || []);
            setSucio(false);
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
            recibir(datos);
            setErrores([]);
            toast(`Publicado: versión ${datos.version}`);
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
            recibir(flujo.estado === 'activo' ? await inboxApi.pausarFlujo(flujo.id) : await inboxApi.activarFlujo(flujo.id));
        } catch (e) {
            toast(e.response?.data?.message || 'No se pudo cambiar el estado', 'error');
        } finally {
            setOcupado(false);
        }
    };
    const volver = () => { if (sucio) setSalir(true); else onVolver(); };
    const guardarYSalir = async () => { if (await guardar()) onVolver(); };

    const deInicio = aristas.find((a) => a.source === INICIO)?.target;
    const palabra = (nodos.find((n) => n.id === INICIO)?.data.disparadores || []).flatMap((d) => d.palabras || []).find(Boolean);
    const est = estadoDe(flujo);
    const nAvisos = errores.length;
    const pendiente = sucio || flujo.cambios_sin_publicar || !flujo.version;

    return (
        <>
            <HeaderActions replaceTitle>
                <div className="barra ef-barra">
                    <Button variant="ghost" icon={<ArrowLeft />} onClick={volver}>Flujos</Button>
                    <span className="ef-sep" aria-hidden="true">/</span>
                    <Input className="ef-nombre" value={nombre} disabled={lectura} aria-label="Nombre del flujo" maxLength={150}
                        onChange={(e) => { setNombre(e.target.value); marcar(); }} />
                    {palabra && <Chip subtle icon={<Hash />}>{palabra}</Chip>}
                    <Status color={est.color}>{est.texto}</Status>
                    {sucio && <Status color="var(--warning)">Sin guardar</Status>}
                    {!sucio && flujo.cambios_sin_publicar && flujo.version && (
                        <Status color="var(--warning)" data-tip="Cambios sin publicar|Lo que corre es la última versión publicada.">Sin publicar</Status>
                    )}
                    {!lectura && (
                        <div className="barra-der">
                            {flujo.version && (
                                <Button icon={flujo.estado === 'activo' ? <Pause /> : <Play />} onClick={pausarOActivar} disabled={ocupado}>
                                    {flujo.estado === 'activo' ? 'Pausar' : 'Activar'}
                                </Button>
                            )}
                            <Button icon={<Save />} onClick={guardar} disabled={ocupado || !sucio}>Guardar</Button>
                            <Button variant="primary" icon={<Send />} onClick={publicar} disabled={ocupado || !pendiente}
                                data-tip={pendiente ? undefined : 'Ya está publicado|No hay cambios desde la última versión.'}>
                                Publicar v{(flujo.version || 0) + 1}
                            </Button>
                        </div>
                    )}
                </div>
            </HeaderActions>
            <div className={`ef${lectura ? ' ef--lectura' : ''}`}>
                {!lectura && (
                    <nav className="ef-riel" aria-label="Agregar paso">
                        {AGREGAR.map(({ tipo, label, Icono }) => (
                            <IconButton key={tipo} label={`Agregar ${label}`} icon={<Icono />} data-tip={`Agregar ${label.toLowerCase()}`} onClick={() => agregar(tipo)} />
                        ))}
                    </nav>
                )}
                <div className="ef-lienzo" ref={lienzo}>
                    <ReactFlow nodes={vista} edges={aristas} nodeTypes={TIPOS_DE_NODO}
                        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
                        nodesDraggable={!lectura} nodesConnectable={!lectura} elementsSelectable
                        deleteKeyCode={lectura ? null : ['Backspace', 'Delete']}
                        fitView fitViewOptions={{ padding: 0.15, minZoom: 0.8, maxZoom: 1 }} minZoom={0.2} proOptions={{ hideAttribution: true }}
                        defaultEdgeOptions={{ type: 'smoothstep' }}>
                        <Background gap={22} size={1.2} />
                        <Controles nAvisos={nAvisos} onAvisos={() => elegir(null)} />
                    </ReactFlow>
                </div>
                <Panel seleccion={seleccion} lectura={lectura} flujo={{ ...flujo, nombre }} metricas={metricas} avisos={avisos}
                    numeros={numeros} nombres={nombres} destinos={destinos} variables={variablesDe(nodos)}
                    onCambiarNodo={cambiarNodo} onCambiarDisparadores={cambiarDisparadores} onBorrar={borrarSeleccion} onElegir={elegir}
                    esInicioDelFlujo={seleccion?.id === deInicio} onHacerInicio={hacerInicio} />
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
