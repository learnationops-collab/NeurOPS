import { useCuenta } from '../../pages/closer/novedades/Mocks';
import './escenaGenerica.css';

// Una escena de recorrido armada con datos (ADR-W258), para no dibujar una a mano por paso. `tipo` es el
// `mock` del paso: { Icono, titulo, chips: [..] (se encienden de a uno), on: índice fijo, filas: [{ n, sub,
// tag, tono }], n: un número que cuenta, nota }. Usa las variables y animaciones de novedades.css.

const Numero = ({ n }) => <b className="eg-num">{useCuenta(n, 1100, 400)}</b>;

export default function EscenaGenerica({ tipo: e }) {
    if (!e || typeof e !== 'object') return null;
    const { Icono, titulo, chips, on, filas, n, nota } = e;
    return (
        <div className="nv-m eg">
            {(Icono || titulo) && (
                <span className="eg-tit">{Icono && <i><Icono aria-hidden="true" /></i>}{titulo}</span>
            )}
            {n !== undefined && <Numero n={n} />}
            {chips && (
                <div className={`eg-chips${on === undefined ? ' eg-chips--ciclo' : ''}`} style={{ '--total': chips.length }}>
                    {chips.map((c, k) => (
                        <span key={c} className={on === k ? 'is-on' : ''} style={{ '--k': k }}>{c}</span>
                    ))}
                </div>
            )}
            {filas && filas.map((f, k) => (
                <div key={f.n} className="eg-fila" style={{ '--k': k, '--tono': f.tono || 'var(--nv-vio)' }}>
                    <i>{f.n[0]}</i>
                    <span><b>{f.n}</b>{f.sub && <small>{f.sub}</small>}</span>
                    {f.tag && <em>{f.tag}</em>}
                </div>
            ))}
            {nota && <em className="eg-nota">{nota}</em>}
        </div>
    );
}
