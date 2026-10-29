import { formatear } from '../anuncios/metricas';

/**
 * Lo que cambió una cifra contra el período comparado (Kerwin, 28/10/2026): la flecha, la diferencia y, si hay lista, un
 * «antes N» que abre las filas del período comparado. La diferencia la calcula el backend (`segmentos_cortes.diferencia`):
 * acá solo se escribe.
 *
 * `delta`: `{ abs, pct }`; `previo`: la cifra de antes. `tipo`: 'num' | 'money' | 'pp' (un % se compara en puntos).
 * `onVerPrevio`: abre la lista del período comparado (sin ella, «antes N» queda quieto).
 */
const signo = (n) => (n > 0 ? '+' : n < 0 ? '−' : '');

export const textoDeDiferencia = (delta, tipo, moneda) => {
    if (!delta) return null;
    const cifra = tipo === 'pp' ? `${Math.abs(delta.abs)} pp` : formatear(Math.abs(delta.abs), tipo, moneda);
    return `${signo(delta.abs)}${cifra}`;
};

const Diferencia = ({ delta, previo, tipo = 'num', moneda, onVerPrevio = null }) => {
    if (!delta) return null;
    const texto = textoDeDiferencia(delta, tipo, moneda);
    const tono = delta.abs > 0 ? 'sube' : delta.abs < 0 ? 'baja' : 'igual';
    const antes = tipo === 'pp' ? `${previo}%` : formatear(previo, tipo, moneda);
    return (
        <span className={`sg-delta sg-delta--${tono}`}>
            <span aria-hidden="true">{delta.abs > 0 ? '▲' : delta.abs < 0 ? '▼' : '•'}</span>
            <b className="num">{texto}</b>
            {tipo !== 'pp' && delta.pct !== null && <small className="num">{signo(delta.pct)}{Math.abs(delta.pct)}%</small>}
            {onVerPrevio
                ? <button type="button" className="sg-antes" onClick={onVerPrevio} title="Ver la lista del período comparado">antes {antes}</button>
                : <small className="sg-antes">antes {antes}</small>}
        </span>
    );
};

export default Diferencia;
