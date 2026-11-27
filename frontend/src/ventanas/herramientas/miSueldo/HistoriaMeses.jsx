// «Últimos meses» de Mi sueldo: una barra apilada por mes (lo que suma cada concepto). Tocar una abre ese mes.
import { COLORES, dinero, filasDelMes } from './useMiSueldo';
import { mesCorto } from './reglas';

export default function HistoriaMeses({ historia, elegido, onElegir }) {
    const max = Math.max(1, ...historia.map(m => m.bruto));
    return (
        <div className="ms-hist">
            <h3 className="ms-rotulo">Últimos meses</h3>
            <div className="ms-meses" style={{ gridTemplateColumns: `repeat(${historia.length}, 1fr)` }}>
                {historia.map(m => {
                    const positivas = filasDelMes(m).filter(f => f.monto > 0.004);
                    return (
                        <button key={m.mes} type="button" className="ms-col" aria-pressed={m.mes === elegido}
                            onClick={() => onElegir(m.mes)} title={`${dinero(m.total)} en ${mesCorto(m.mes)}`}>
                            <em className="num">{dinero(m.total).replace('US$ ', '')}</em>
                            <span className="ms-pila" style={{ height: `${Math.max(4, (m.bruto / max) * 80)}px` }}>
                                {positivas.map(f => <i key={f.k} style={{ flex: f.monto, background: COLORES[f.k] }} />)}
                            </span>
                            <small>{mesCorto(m.mes)}</small>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
