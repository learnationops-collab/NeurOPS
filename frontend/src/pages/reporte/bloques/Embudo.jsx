// Embudo del día: barras por paso con la conversión del anterior. `children`: cifras chicas debajo.
import Exp from '../Exp';
import { Cuenta, useLleno } from '../animar';
import { plano } from '../formato';

export default function Embudo({ embudo, fecha, children }) {
    const lleno = useLleno();
    if (!embudo) return children || null;
    const pasos = embudo.pasos || [];
    const tope = pasos[0]?.v || 1;
    const min = embudo.unidad === 'min';
    return (
        <>
            <h4>{embudo.tit}</h4>
            {pasos.map((p, k) => {
                const prev = pasos[k - 1];
                return (
                    <Exp key={p.clave || p.l} className="rp-fila" dato={{ clave: p.clave, l: p.l, v: p.v, f: min ? 'min' : 'n', fecha }}>
                        <span>{p.l}</span>
                        <div className="rp-barra">
                            <i style={{ width: lleno && p.v ? `${Math.min(100, p.v / tope * 100).toFixed(0)}%` : 0, transitionDelay: `${400 + k * 120}ms` }} />
                        </div>
                        <b>
                            {min ? plano(p.v, 'min') : <Cuenta v={p.v} delay={k * 40} />}
                            {k > 0 && !min && p.v != null && prev?.v ? <small>{Math.round(p.v / prev.v * 100)}%</small> : null}
                        </b>
                    </Exp>
                );
            })}
            {children}
        </>
    );
}
