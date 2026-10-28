import { COLOR_SEGMENTO } from './segmentos';

/**
 * El filtro de segmento: un botón por grupo, se pueden elegir varios (sin ninguno se ve todo). Cada botón dice
 * cuántas agendas tiene el grupo, así se ve de un vistazo cómo se reparte la mezcla.
 */
const FiltroSegmentos = ({ segmentos, elegidos, onCambiar, cuentas }) => {
    const alternar = (key) => onCambiar(elegidos.includes(key) ? elegidos.filter((k) => k !== key) : [...elegidos, key]);
    return (
        <div className="sg-filtro" role="group" aria-label="Filtrar por segmento">
            <span className="t-eyebrow mut">Segmento</span>
            {segmentos.map((s) => (
                <button key={s.key} type="button" className="chip sg-chip" aria-pressed={elegidos.includes(s.key)}
                    style={{ '--c': COLOR_SEGMENTO[s.key] }} onClick={() => alternar(s.key)}>
                    <i className="sg-punto" style={{ background: COLOR_SEGMENTO[s.key] }} aria-hidden="true" />
                    {s.label}{cuentas?.[s.key] !== undefined && <small className="num"> {cuentas[s.key].toLocaleString('es-AR')}</small>}
                </button>
            ))}
            {elegidos.length > 0 && (
                <button type="button" className="link-btn" onClick={() => onCambiar([])}>Ver todos</button>
            )}
        </div>
    );
};

export default FiltroSegmentos;
