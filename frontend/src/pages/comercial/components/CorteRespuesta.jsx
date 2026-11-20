import { useEffect, useState } from 'react';
import { Modal, ModalHeader } from '../../../components/standard';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import { COLOR_SEGMENTO } from '../../admin/marketing/todos/segmentos';
import { getRespuestasPersonas, getSegmentosRespuestas } from '../comercialApi';
import { Vacio } from './PiezasAnalizar';
import './corteRespuesta.css';

/**
 * Segmentos › corte «Respuesta» (ADR-W187): cuánto compra cada opción del formulario de agenda (inversión, quién
 * decide, etapa, examen), la mezcla de segmentos de cada una y los puntos que hoy le da al segmento, con «revisar»
 * cuando los puntos van para un lado y la compra para el otro. No sigue el período del dashboard: compra = venta
 * nueva en los 60 días siguientes a la primera agenda, desde junio (ver `app/services/segmentos_respuestas.py`).
 */
const SEGS = ['A', 'B', 'C', 'D', 'sin'];
const pctTexto = (x) => (x == null ? '—' : `${String(x).replace('.', ',')}%`);
const puntosTexto = (p) => (p == null ? '—' : `${p > 0 ? '+' : ''}${p}`);
const CORTO = { qglxqqlsgya: '¿Puede invertir?', qgnajtuxkuz: '¿Quién decide?', qg8xclvqc4c: '¿En qué etapa está?', qg6raaks2pe: '¿Qué examen rinde?' };

const Personas = ({ pregunta, opcion, onCerrar }) => {
    const [lista, setLista] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        const c = new AbortController();
        getRespuestasPersonas(pregunta.id, opcion.id, { signal: c.signal })
            .then(d => setLista(d.personas || []))
            .catch(e => { if (!c.signal.aborted) setError(e?.response?.data?.message || 'No se pudo cargar la lista.'); });
        return () => c.abort();
    }, [pregunta.id, opcion.id]);
    return (
        <Modal onClose={onCerrar} labelledBy="cr-lista-t" className="cr-modal">
            <ModalHeader title={`${opcion.texto} · ${opcion.compraron} de ${opcion.n} compraron`} titleId="cr-lista-t"
                subtitle={CORTO[pregunta.id] || pregunta.titulo} onClose={onCerrar} />
            {error ? <p className="cr-vacio">{error}</p> : !lista ? <p className="cr-vacio">Cargando…</p> : (
                <ul className="cr-personas">
                    {lista.map(p => (
                        <li key={p.id}>
                            <b className="trunc">{p.nombre || p.email || `Cliente ${p.id}`}</b>
                            <span className="cr-seg" style={{ '--c': COLOR_SEGMENTO[p.segmento] }}>{p.segmento === 'sin' ? 'Sin' : p.segmento}</span>
                            <span className={`cr-compro${p.compro ? ' si' : ''}`}>{p.compro ? 'Compró' : 'No compró'}</span>
                            <small className="num">{p.fecha}</small>
                        </li>
                    ))}
                </ul>
            )}
        </Modal>
    );
};

const Fila = ({ o, prom, onVer }) => {
    const total = SEGS.reduce((a, s) => a + (o.mezcla?.[s] || 0), 0);
    const bajo = o.pct != null && o.pct < prom;
    const cuerpo = (
        <>
            <span className="cr-op">{o.texto}{o.pocos && <em className="cr-pocos">pocos datos</em>}</span>
            <span className="cr-n num">{o.n}</span>
            <span className="cr-riel" aria-hidden="true">
                <i style={{ width: `${Math.min(100, (o.pct || 0) * 4)}%`, background: bajo ? 'var(--error)' : 'var(--success)' }} />
                <u style={{ left: `${Math.min(100, prom * 4)}%` }} />
            </span>
            <b className="cr-pct num">{pctTexto(o.pct)}</b>
            <small className="cr-de num">{o.compraron} de {o.n}</small>
            <span className="cr-mezcla" aria-hidden="true">
                {SEGS.map(s => (o.mezcla?.[s] ? <i key={s} style={{ flex: o.mezcla[s], background: COLOR_SEGMENTO[s] }}
                    title={`${s === 'sin' ? 'Sin segmento' : s}: ${o.mezcla[s]} (${Math.round((o.mezcla[s] / (total || 1)) * 100)}%)`} /> : null))}
            </span>
            <span className="cr-puntos">
                <b className="num">{puntosTexto(o.puntos)}</b>
                {o.puntos != null && !o.pocos && (o.revisar
                    ? <small className="cr-rev" title="Los puntos van para un lado y la compra para el otro">revisar</small>
                    : <small className="cr-ok">coincide</small>)}
            </span>
        </>
    );
    return onVer
        ? <button type="button" className="cr-fila" onClick={onVer} title={`Ver las ${o.n} personas`}>{cuerpo}</button>
        : <div className="cr-fila">{cuerpo}</div>;
};

const CorteRespuesta = ({ version = 0 }) => {
    const [preguntaId, setPreguntaId] = useState('qglxqqlsgya');
    const [abierta, setAbierta] = useState(null);
    const { datos, error } = useDatosCacheados('comercial:segmentos:respuestas', (signal) => getSegmentosRespuestas({ signal }), { version });
    if (error && !datos) return <Vacio texto="No se pudieron cargar las respuestas del formulario." />;
    if (!datos) return <Vacio texto="Cargando las respuestas del formulario…" />;
    const pregunta = datos.preguntas.find(q => q.id === preguntaId) || datos.preguntas[0];
    return (
        <div className="cr">
            <div className="cr-preguntas" role="tablist" aria-label="Pregunta del formulario">
                {datos.preguntas.map(q => (
                    <button key={q.id} type="button" role="tab" aria-selected={q.id === pregunta.id}
                        className={q.id === pregunta.id ? 'on' : ''} onClick={() => setPreguntaId(q.id)} title={q.titulo}>
                        {CORTO[q.id] || q.titulo}
                    </button>
                ))}
            </div>
            <div className="cr-resumen">
                <span className="sgp-rot">Promedio</span><b className="num">{pctTexto(datos.pct)}</b>
                <small className="sgp-mut">compran: {datos.compraron} de {datos.total} que agendaron desde el {datos.desde.split('-').reverse().join('/')}, en los {datos.ventana} días siguientes. No sigue el período de arriba.</small>
            </div>
            <div className="cr-tabla" role="table" aria-label={pregunta.titulo}>
                <div className="cr-fila cr-cab" role="row">
                    <span>Opción</span><span className="cr-n">Agendaron</span><span>Compran</span><span /><span className="cr-de">Compraron</span>
                    <span>Segmentos</span><span>Puntos hoy</span>
                </div>
                {pregunta.opciones.map(o => (
                    <Fila key={o.id} o={o} prom={datos.pct} onVer={datos.puede_ver_personas ? () => setAbierta(o) : null} />
                ))}
            </div>
            {abierta && <Personas pregunta={pregunta} opcion={abierta} onCerrar={() => setAbierta(null)} />}
        </div>
    );
};

export default CorteRespuesta;
