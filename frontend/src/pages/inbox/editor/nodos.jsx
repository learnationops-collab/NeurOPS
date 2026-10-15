// Las cajas del lienzo. Cada salida del nodo es un punto de conexión (Handle) a la derecha, con su
// rótulo: un botón, «Responde», «Sin respuesta», «Sí»/«No» o «Siguiente».
import { Handle, Position } from '@xyflow/react';
import { Clock, Flag, GitBranch, MessageSquare, Play, Zap } from 'lucide-react';
import { rotuloSalida, salidas, TIPOS } from './grafoFlujo';

const ICONO = { mensaje: MessageSquare, esperar: Clock, condicion: GitBranch, accion: Zap, fin: Flag };

function Salidas({ nodo }) {
    const lista = salidas(nodo);
    if (!lista.length) return null;
    return (
        <div className="nf-salidas">
            {lista.map((s) => (
                <div key={s} className={`nf-salida nf-salida--${s === 'sin_respuesta' ? 'sin' : s === 'no' ? 'no' : 'si'}`}>
                    <span>{rotuloSalida(nodo, s)}</span>
                    <Handle type="source" position={Position.Right} id={s} className="nf-punto" />
                </div>
            ))}
        </div>
    );
}

function resumen(nodo) {
    switch (nodo.tipo) {
        case 'mensaje': return (nodo.contenido || []).map((c, i) => (
            <p key={i} className="nf-linea">{c.tipo === 'texto' ? (c.texto || <em>Texto vacío</em>) : `📎 ${c.tipo}`}</p>
        ));
        case 'esperar': return <p className="nf-linea">{duracion(nodo.minutos)}</p>;
        case 'condicion': return (nodo.reglas || []).map((r, i) => (
            <p key={i} className="nf-linea">{r.campo || '…'} {OPERADOR[r.operador] || r.operador} {r.valor}</p>
        ));
        case 'accion': return (nodo.acciones || []).map((a, i) => <p key={i} className="nf-linea">{textoAccion(a)}</p>);
        default: return <p className="nf-linea mut">Termina el flujo</p>;
    }
}

export const OPERADOR = { igual: '=', distinto: '≠', contiene: 'contiene', no_contiene: 'no contiene', existe: 'existe', no_existe: 'no existe' };

export function duracion(minutos) {
    const m = Number(minutos) || 0;
    if (m % 1440 === 0 && m) return `${m / 1440} d`;
    if (m % 60 === 0 && m) return `${m / 60} h`;
    return `${m} min`;
}

function textoAccion(a) {
    if (a.tipo === 'variable') return `${a.nombre || '…'} = ${a.valor ?? ''}`;
    if (a.tipo === 'etapa') return `Etapa ${a.valor ?? ''}`;
    if (a.tipo === 'califica') return a.valor ? 'Califica' : 'No califica';
    if (a.tipo === 'pausar_bot') return `Pausar bot ${a.horas || 24} h`;
    return a.tipo;
}

function Caja({ id, data, selected }) {
    const nodo = data.nodo;
    const Icono = ICONO[nodo.tipo] || MessageSquare;
    return (
        <div className={`nf nf--${nodo.tipo}${selected ? ' nf--sel' : ''}${data.error ? ' nf--error' : ''}`}>
            <Handle type="target" position={Position.Left} className="nf-punto nf-punto--entrada" />
            <div className="nf-cab"><Icono size={14} /><span>{TIPOS[nodo.tipo]?.label}</span><code>{id.slice(-4)}</code></div>
            <div className="nf-cuerpo">{resumen(nodo)}</div>
            {nodo.tipo === 'mensaje' && nodo.espera && <p className="nf-espera">Guarda en «{nodo.espera.guardar_en}»</p>}
            {nodo.sin_respuesta && <p className="nf-espera">Si no responde en {duracion(nodo.sin_respuesta.minutos)}</p>}
            <Salidas nodo={nodo} />
        </div>
    );
}

function Inicio({ data, selected }) {
    const disparadores = data.disparadores || [];
    return (
        <div className={`nf nf--inicio${selected ? ' nf--sel' : ''}`}>
            <div className="nf-cab"><Play size={14} /><span>Cuando…</span></div>
            <div className="nf-cuerpo">
                {disparadores.length === 0 && <p className="nf-linea mut">Sin disparadores</p>}
                {disparadores.map((d) => (
                    <p key={d.id} className="nf-linea">
                        {d.canal === 'comentario' ? 'Comenta' : 'Escribe'} {d.coincidencia === 'contiene' ? 'algo con' : ''}{' '}
                        <strong>{(d.palabras || []).filter(Boolean).join(' · ') || '…'}</strong>
                    </p>
                ))}
            </div>
            <div className="nf-salidas">
                <div className="nf-salida nf-salida--si"><span>Empieza</span>
                    <Handle type="source" position={Position.Right} id="inicio" className="nf-punto" />
                </div>
            </div>
        </div>
    );
}

export const TIPOS_DE_NODO = { inicio: Inicio, mensaje: Caja, esperar: Caja, condicion: Caja, accion: Caja, fin: Caja };
