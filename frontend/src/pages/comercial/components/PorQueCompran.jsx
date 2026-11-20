import { useState } from 'react';
import { Modal, ModalHeader } from '../../../components/standard';
import { useDatosCacheados } from '../../../services/cacheDeVistas';
import { getPorQueCompran } from '../comercialApi';
import { Panel, PanelCab, Vacio } from './PiezasAnalizar';
import './porQueCompran.css';

/**
 * Analizar › Por qué compran y por qué no (ADR-W187, pedido de Mario del 19/11): lo que no está en ningún otro panel.
 *  - Arriba, lo que más separa a los que compran: quién decide × si puede invertir (del formulario de agenda y las
 *    ventas reales; el detalle por respuesta está en Segmentos › Respuesta).
 *  - Las objeciones de las llamadas que no cerraron en el período, agrupadas por palabras clave
 *    (`objeciones_categorias`); cada categoría abre sus textos para ver si el criterio está bien.
 * Lo que casi frenó a los que SÍ compraron llega con el formulario de ingreso de la Academia (siguiente paso).
 */
const pctTexto = (x) => (x == null ? '—' : `${String(x).replace('.', ',')}%`);
const celda = (cruce, d, i) => cruce?.find(c => c.decide === d && c.invierte === i);

const Textos = ({ cat, onCerrar }) => (
    <Modal onClose={onCerrar} labelledBy="pq-t" className="pq-modal">
        <ModalHeader title={`${cat.label} · ${cat.n}`} titleId="pq-t" subtitle="Lo que escribió el closer al reportar «No cerró»" onClose={onCerrar} />
        <ul className="pq-textos">
            {cat.textos.map((t, i) => (
                <li key={i}><p>«{t.texto}»</p><small>{[t.cliente, t.closer, t.fecha].filter(Boolean).join(' · ')}</small></li>
            ))}
        </ul>
    </Modal>
);

const PorQueCompran = ({ filtros, onVerSegmentos }) => {
    const [abierta, setAbierta] = useState(null);
    const { datos, error } = useDatosCacheados(`comercial:por-que:${JSON.stringify(filtros)}`,
        (signal) => getPorQueCompran(filtros, { signal }));
    const mejor = celda(datos?.cruce, 'solo', 'puede');
    const peor = celda(datos?.cruce, 'apoyo', 'no_puede');
    const obj = datos?.objeciones;
    const max = Math.max(1, ...(obj?.categorias || []).map(c => c.pct));
    return (
        <Panel id="p-por-que" cab={
            <PanelCab titulo="Por qué compran y por qué no"
                ayuda={'Arriba: cuánto compran según quién decide y si puede invertir (formulario de agenda y ventas '
                    + 'reales desde junio). Abajo: las objeciones que escribió el closer en las llamadas del período que '
                    + 'no cerraron, agrupadas por palabras clave. Una objeción puede caer en más de un grupo.'} />
        }>
            {error && !datos ? <Vacio texto="No se pudo cargar el panel." /> : !datos ? <Vacio texto="Cargando…" /> : (
                <div className="pq">
                    {mejor && peor && (
                        <div className="pq-clave">
                            <div className="pq-vs">
                                <b className="num" style={{ color: 'var(--success)' }}>{pctTexto(mejor.pct)}</b>
                                <span>deciden solos y pueden invertir <small className="num">({mejor.compraron} de {mejor.n})</small></span>
                                <em>contra</em>
                                <b className="num" style={{ color: 'var(--error)' }}>{pctTexto(peor.pct)}</b>
                                <span>con apoyo y sin poder invertir <small className="num">({peor.compraron} de {peor.n})</small></span>
                            </div>
                            <p>
                                <b>Poder invertir es lo que más separa a los que compran, y después quién decide.</b> Promedio:
                                {' '}{pctTexto(datos.promedio)}.{' '}
                                {onVerSegmentos && <button type="button" className="pq-link" onClick={onVerSegmentos}>Ver por respuesta en Segmentos →</button>}
                            </p>
                        </div>
                    )}
                    <div className="pq-obj">
                        <div className="pq-obj-cab">
                            <h4>Por qué no cerraron</h4>
                            <small>{obj.con_texto} de {obj.total} llamadas que no cerraron tienen la objeción escrita</small>
                        </div>
                        {obj.categorias.length ? obj.categorias.map(c => (
                            <button key={c.clave} type="button" className="pq-fila" onClick={() => setAbierta(c)} title="Ver lo que escribió el closer">
                                <span className="pq-rot">{c.label}</span>
                                <span className="pq-riel"><i style={{ width: `${(c.pct / max) * 100}%` }} /></span>
                                <b className="num">{pctTexto(c.pct)}</b>
                                <small className="num">{c.n}</small>
                            </button>
                        )) : <Vacio texto="Ninguna llamada del período que no cerró tiene la objeción escrita." />}
                        <p className="pq-falta">Lo que casi frenó a los que sí compraron (para comparar si se resolvió) llega con el formulario de ingreso de la Academia.</p>
                    </div>
                </div>
            )}
            {abierta && <Textos cat={abierta} onCerrar={() => setAbierta(null)} />}
        </Panel>
    );
};

export default PorQueCompran;
