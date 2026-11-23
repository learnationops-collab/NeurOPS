// Bloque «pasos»: secuencias con la conversión de un paso al siguiente.
import { Fragment } from 'react';
import Exp from '../Exp';
import { Cuenta, useLleno } from '../animar';

export default function Pasos({ b, d = 0, fecha }) {
    const lleno = useLleno();
    const conMano = (b.series || []).some((s) => s.pasos.some((p) => p.mano));
    return (
        <>
            <h4>{b.tit}{conMano && <em className="rp-tag-m">a mano</em>}</h4>
            <div className="rp-pasos">
                {(b.series || []).map((s, si) => {
                    const max = Math.max(1, ...s.pasos.map((p) => p.v || 0));
                    return (
                        <div key={s.nombre || si} className="rp-serie">
                            {s.nombre && <h5>{s.nombre}</h5>}
                            <div className="rp-serie__fila">
                                {s.pasos.map((p, k) => {
                                    const prev = s.pasos[k - 1];
                                    const conv = k && p.v != null && prev?.v ? Math.round(p.v / prev.v * 100) + '%' : '';
                                    const h = p.v ? Math.max(6, p.v / max * 100).toFixed(0) : 4;
                                    return (
                                        <Fragment key={p.clave || p.l}>
                                            {k > 0 && <span className="rp-conv">→{conv && <b>{conv}</b>}</span>}
                                            <Exp className="rp-paso" dato={{ clave: p.clave, l: p.l, v: p.v, mano: p.mano, fecha }}>
                                                <span className="col"><i style={{ height: lleno ? `${h}%` : 0, transitionDelay: `${d + 200 + si * 120 + k * 90}ms` }} /></span>
                                                <b><Cuenta v={p.v} delay={k * 40} /></b><span>{p.l}</span>
                                            </Exp>
                                        </Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </>
    );
}
