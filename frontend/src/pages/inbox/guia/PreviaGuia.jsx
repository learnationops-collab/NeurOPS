// A la derecha de la Guía: el «/» de la etapa como lo ve el setter y la opción elegida en burbujas.
// Lo que va entre [corchetes] se marca: lo completa el setter antes de mandar.
import { useState } from 'react';
import { LETRAS, partes, rotulo, visibles } from './useGuia';

function Burbuja({ texto }) {
    const trozos = texto.split(/(\{[^}]+\}|\[[^\]]+\])/);
    return (
        <div className="gu-burbuja">
            {trozos.map((t, i) => {
                if (/^\{[^}]+\}$/.test(t)) return <span key={i} className="gu-var">{t.slice(1, -1)}</span>;
                if (/^\[[^\]]+\]$/.test(t)) return <span key={i} className="gu-hueco">{t.slice(1, -1)}</span>;
                return t;
            })}
        </div>
    );
}

export default function PreviaGuia({ pasos }) {
    const vis = visibles(pasos);
    const [elegida, setElegida] = useState({ id: null, j: 0 });
    if (!vis.length) return <p className="t-cap mut">Esta etapa no tiene pasos para el «/».</p>;
    const p = vis.find((x) => x.id === elegida.id) || vis[0];
    const j = p.id === elegida.id ? Math.min(elegida.j, p.op.length - 1) : 0;
    return (
        <>
            <span className="t-rotulo">Así lo ve el setter al escribir «/»</span>
            <div className="gu-menu">
                {vis.map((q) => (
                    <div key={q.id} className="gu-menu-fila">
                        <code>/{q.atajo}</code>
                        <span>{q.t}{q.uso === 'solo si' && q.cuando ? ` · solo si ${q.cuando}` : q.uso === 'opcional' ? ' · opcional' : ''}</span>
                        <span className="gu-ab">
                            {q.op.map((o, k) => (
                                <button key={k} type="button" className={q.id === p.id && k === j ? 'gu-ab--on' : ''}
                                    onClick={() => setElegida({ id: q.id, j: k })} aria-label={`Ver ${q.t}, ${rotulo(q, k)}`}>
                                    {q.porRespuesta ? (o.si || '?').slice(0, 4) : q.op.length > 1 ? LETRAS[k] : 'Ver'}
                                </button>
                            ))}
                        </span>
                    </div>
                ))}
            </div>
            <span className="t-rotulo">{p.t} · {rotulo(p, j)}</span>
            <div className="gu-burbujas">{partes(p.op[j]?.x).map((t, i) => <Burbuja key={i} texto={t} />)}</div>
        </>
    );
}
