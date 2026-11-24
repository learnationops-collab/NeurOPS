// Bloque «mix»: composición de un total (ventas por tipo) con barra apilada, leyenda y pie.
import Exp from '../Exp';
import { Cuenta, useLleno } from '../animar';
import { PALETA } from '../formato';

export default function Mix({ b, d = 0, fecha }) {
    const lleno = useLleno();
    const f = b.f || 'n';
    const total = b.total?.v || 0;
    const partes = b.partes || [];
    const conValor = partes.filter((p) => p.v > 0), sin = partes.filter((p) => !p.v).map((p) => p.l);
    return (
        <>
            <h4>{b.tit}</h4>
            <Exp className="rp-mix__tot" dato={{ clave: b.total?.clave, l: b.tit, v: b.total?.v, f, fecha }}>
                <Cuenta v={b.total?.v} f={f} />{b.sub && <span>{b.sub}</span>}
            </Exp>
            <div className="rp-mix__barra">
                {conValor.map((p, k) => (
                    <i key={p.clave || p.l} style={{ background: PALETA[k % PALETA.length], width: lleno && total ? `${(p.v / total * 100).toFixed(1)}%` : 0,
                        transitionDelay: `${d + 250 + k * 150}ms` }} />
                ))}
            </div>
            <div className="rp-mix__ley">
                {conValor.map((p, k) => (
                    <Exp key={p.clave || p.l} as="span" dato={{ clave: p.clave, l: p.l, v: p.v, f, fecha }}>
                        <i style={{ background: PALETA[k % PALETA.length] }} />{p.l}<b><Cuenta v={p.v} f={f} delay={k * 40} /></b><small>{p.sub || ''}</small>
                    </Exp>
                ))}
            </div>
            {sin.length > 0 && <p className="rp-mix__cero">Sin {String(b.tit).toLowerCase()}: {sin.join(' · ')}</p>}
            {b.pie?.length > 0 && (
                <div className="rp-mix__pie">
                    {b.pie.map((p) => (
                        <Exp key={p.clave || p.l} dato={{ clave: p.clave, l: p.l, v: p.v, f: p.f || f, fecha }}>
                            <b><Cuenta v={p.v} f={p.f || f} /></b><span>{p.l}</span>
                        </Exp>
                    ))}
                </div>
            )}
        </>
    );
}
