// Las cajas del lienzo, legibles sin zoom: tipo y número de paso, el nombre, el copy real y cada salida
// con el % de gente que la tomó. El paso que más gente pierde se marca, y los avisos del servidor
// quedan pegados a su caja. Cada salida es un punto de conexión (Handle) a la derecha.
import { Handle, Position } from '@xyflow/react';
import { AlertTriangle, Clock, Flag, GitBranch, MessageSquare, Play, Zap } from 'lucide-react';
import { rotuloSalida, salidas, TIPOS } from './grafoFlujo';
import { porciento } from '../estadoFlujo';

const ICONO = { mensaje: MessageSquare, esperar: Clock, condicion: GitBranch, accion: Zap, fin: Flag };

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

function resumen(nodo) {
    switch (nodo.tipo) {
        case 'mensaje': return (nodo.contenido || []).map((c, i) => (
            <p key={i} className="nf-linea nf-linea--copy">{c.tipo === 'texto' ? (c.texto ? `“${c.texto}”` : <em>Texto vacío</em>) : `📎 ${c.tipo}`}</p>
        ));
        case 'esperar': return <p className="nf-linea">Espera {duracion(nodo.minutos)} y sigue</p>;
        case 'condicion': return (nodo.reglas || []).map((r, i) => (
            <p key={i} className="nf-linea">{r.campo || '…'} {OPERADOR[r.operador] || r.operador} {r.valor}</p>
        ));
        case 'accion': return (nodo.acciones || []).map((a, i) => <p key={i} className="nf-linea">{textoAccion(a)}</p>);
        default: return <p className="nf-linea mut">Termina el flujo</p>;
    }
}

function Salidas({ nodo, metrica }) {
    const lista = salidas(nodo);
    if (!lista.length) return null;
    return (
        <div className="nf-salidas">
            {lista.map((s) => (
                <div key={s} className={`nf-salida nf-salida--${s === 'sin_respuesta' ? 'sin' : s === 'no' ? 'no' : 'si'}`}>
                    <span>{rotuloSalida(nodo, s)}</span>
                    {metrica?.salidas?.[s] != null && <b>{porciento(metrica.salidas[s])}</b>}
                    <Handle type="source" position={Position.Right} id={s} className="nf-punto" />
                </div>
            ))}
        </div>
    );
}

function Pie({ nodo, metrica, mayor, avisos }) {
    const espera = nodo.botones?.length || nodo.espera;
    return (
        <>
            {metrica?.caida > 0 && (
                <p className={`nf-caida${mayor ? ' nf-caida--mayor' : ''}`}>
                    {porciento(metrica.caida)} {espera ? 'no responde este paso' : 'no llega al paso siguiente'}
                </p>
            )}
            {avisos?.length > 0 && (
                <p className="nf-avisos"><AlertTriangle size={12} aria-hidden="true" />{avisos.length === 1 ? '1 aviso' : `${avisos.length} avisos`}</p>
            )}
        </>
    );
}

function Caja({ data, selected }) {
    const { nodo, numero, metrica, mayor, avisos } = data;
    const Icono = ICONO[nodo.tipo] || MessageSquare;
    const clases = ['nf', `nf--${nodo.tipo}`, selected && 'nf--sel', avisos?.length && 'nf--error', mayor && 'nf--mayor'].filter(Boolean).join(' ');
    return (
        <div className={clases}>
            <Handle type="target" position={Position.Left} className="nf-punto nf-punto--entrada" />
            <div className="nf-cab">
                <Icono size={13} /><span>{TIPOS[nodo.tipo]?.label}</span>
                {mayor && <span className="nf-marca">mayor caída</span>}
                <span className="nf-num">{numero ? `paso ${numero}` : nodo.tipo === 'fin' ? '' : 'sin conectar'}</span>
            </div>
            {nodo.nombre && <p className="nf-titulo">{nodo.nombre}</p>}
            <div className="nf-cuerpo">{resumen(nodo)}</div>
            {nodo.tipo === 'mensaje' && (nodo.espera || nodo.sin_respuesta) && (
                <p className="nf-meta">
                    {nodo.espera && <>Guarda en <b>{nodo.espera.guardar_en || '…'}</b></>}
                    {nodo.espera && nodo.sin_respuesta && ' · '}
                    {nodo.sin_respuesta && `si no responde en ${duracion(nodo.sin_respuesta.minutos)}, sigue`}
                </p>
            )}
            <Salidas nodo={nodo} metrica={metrica} />
            <Pie nodo={nodo} metrica={metrica} mayor={mayor} avisos={avisos} />
        </div>
    );
}

function Inicio({ data, selected }) {
    const disparadores = data.disparadores || [];
    return (
        <div className={`nf nf--inicio${selected ? ' nf--sel' : ''}${data.avisos?.length ? ' nf--error' : ''}`}>
            <div className="nf-cab"><Play size={13} /><span>Disparador</span></div>
            <p className="nf-titulo">{disparadores.some((d) => d.canal === 'comentario') ? 'Comentario o mensaje' : 'Palabra clave'}</p>
            <div className="nf-cuerpo">
                {disparadores.length === 0 && <p className="nf-linea mut">Sin disparadores</p>}
                {disparadores.map((d) => (
                    <p key={d.id} className="nf-linea">
                        {d.canal === 'comentario' ? 'Comenta' : 'Escribe'} {d.coincidencia === 'contiene' ? 'algo con' : ''}{' '}
                        <strong>{(d.palabras || []).filter(Boolean).join(' · ') || '…'}</strong>
                    </p>
                ))}
            </div>
            <Pie nodo={{}} avisos={data.avisos} />
            <div className="nf-salidas">
                <div className="nf-salida nf-salida--si"><span>Empieza</span>
                    <Handle type="source" position={Position.Right} id="inicio" className="nf-punto" />
                </div>
            </div>
        </div>
    );
}

export const TIPOS_DE_NODO = { inicio: Inicio, mensaje: Caja, esperar: Caja, condicion: Caja, accion: Caja, fin: Caja };
