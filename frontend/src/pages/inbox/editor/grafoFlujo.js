// Del grafo del motor (app/automatizaciones/nucleo/grafo.py) a nodos y aristas del lienzo (React Flow) y
// de vuelta. Las reglas de salidas son las mismas que valida el servidor: si cambian allá, cambian acá.
//
// El lienzo suma un nodo fijo «Inicio» (id INICIO) que muestra los disparadores; su única salida apunta
// al primer nodo del flujo, que en el grafo es `inicio`. Su posición se guarda en `posicion_inicio`.

export const INICIO = '__inicio';
export const LIMITE_BOTONES = { botones: 3, respuestas_rapidas: 13 };

export const TIPOS = {
    mensaje: { label: 'Mensaje' },
    esperar: { label: 'Esperar' },
    condicion: { label: 'Condición' },
    accion: { label: 'Acción' },
    fin: { label: 'Fin' },
};

export function salidas(nodo) {
    switch (nodo?.tipo) {
        case 'mensaje': {
            let base;
            if (nodo.botones?.length) base = nodo.botones.map((b) => b.id);
            else if (nodo.espera) base = ['respuesta'];
            else return ['siguiente'];
            return nodo.sin_respuesta ? [...base, 'sin_respuesta'] : base;
        }
        case 'condicion': return ['si', 'no'];
        case 'esperar':
        case 'accion': return ['siguiente'];
        default: return [];
    }
}

export function rotuloSalida(nodo, salida) {
    const boton = nodo?.botones?.find((b) => b.id === salida);
    if (boton) return boton.titulo || 'Botón';
    return { siguiente: 'Siguiente', respuesta: 'Responde', sin_respuesta: 'Sin respuesta', si: 'Sí', no: 'No' }[salida] || salida;
}

export function nuevoId(prefijo = 'n') {
    return `${prefijo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function nodoNuevo(tipo, posicion) {
    const base = { id: nuevoId(), tipo, posicion };
    if (tipo === 'mensaje') return { ...base, contenido: [{ tipo: 'texto', texto: '' }] };
    if (tipo === 'esperar') return { ...base, minutos: 10 };
    if (tipo === 'condicion') return { ...base, reglas: [{ campo: '', operador: 'igual', valor: '' }] };
    if (tipo === 'accion') return { ...base, acciones: [{ tipo: 'variable', nombre: '', valor: '' }] };
    return base;
}

export function aLienzo(grafo) {
    const g = grafo || {};
    const nodos = g.nodos || [];
    const rfNodos = [
        { id: INICIO, type: 'inicio', position: g.posicion_inicio || { x: -320, y: 0 }, deletable: false,
          data: { disparadores: g.disparadores || [] } },
        ...nodos.map((n, i) => ({
            id: n.id, type: n.tipo, position: n.posicion || { x: i * 320, y: 0 }, data: { nodo: n },
        })),
    ];
    const aristas = (g.conexiones || []).map((c) => ({
        id: c.id || nuevoId('c'), source: c.desde, sourceHandle: c.salida, target: c.hacia,
    }));
    if (g.inicio) aristas.unshift({ id: 'c-inicio', source: INICIO, sourceHandle: 'inicio', target: g.inicio });
    return { nodos: rfNodos, aristas };
}

export function aGrafo(rfNodos, aristas) {
    const inicio = rfNodos.find((n) => n.id === INICIO);
    const vivos = new Map(rfNodos.filter((n) => n.id !== INICIO).map((n) => [n.id, n]));
    const nodos = [...vivos.values()].map((n) => ({
        ...n.data.nodo, id: n.id, posicion: { x: Math.round(n.position.x), y: Math.round(n.position.y) },
    }));
    const deInicio = aristas.find((a) => a.source === INICIO && vivos.has(a.target));
    // Solo sobreviven las aristas entre nodos que existen y desde salidas que el nodo todavía tiene
    // (borrar un botón suelta su rama).
    const conexiones = aristas
        .filter((a) => a.source !== INICIO && vivos.has(a.source) && vivos.has(a.target)
            && salidas(vivos.get(a.source).data.nodo).includes(a.sourceHandle))
        .map((a) => ({ id: a.id, desde: a.source, salida: a.sourceHandle, hacia: a.target }));
    return {
        disparadores: inicio?.data.disparadores || [],
        inicio: deInicio?.target || null,
        posicion_inicio: inicio ? { x: Math.round(inicio.position.x), y: Math.round(inicio.position.y) } : undefined,
        nodos,
        conexiones,
    };
}

// Una salida admite una sola conexión: al conectar de nuevo, reemplaza la anterior.
export function conectar(aristas, conexion) {
    const otras = aristas.filter((a) => !(a.source === conexion.source && a.sourceHandle === conexion.sourceHandle));
    if (conexion.source === conexion.target) return aristas;
    return [...otras, { id: nuevoId('c'), ...conexion }];
}
