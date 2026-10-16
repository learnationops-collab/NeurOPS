import { useState } from 'react';
import { useMontado } from '../../../comercial/components/Shared';
import { diaCorto, num } from './trafico';

/**
 * Visitas por día: una sola serie y un solo eje. Los clics al grupo van en el tooltip (su escala es
 * muy distinta: dibujarlos encima pediría un segundo eje). Cada columna es más ancha que su barra para
 * poder apuntarle, y con el teclado se recorre igual (cada día es un botón).
 */
const SerieVisitas = ({ dias }) => {
    const montado = useMontado();
    const [encima, setEncima] = useState(null);
    const max = Math.max(0, ...dias.map((d) => d.visitas));
    // Uno de cada N días rotulado: con 90 días, rotularlos todos es una tira ilegible.
    const cada = dias.length > 45 ? 7 : dias.length > 14 ? 4 : 1;
    const dia = encima !== null ? dias[encima] : null;

    return (
        <div className="wf-serie">
            <div className="wf-serie-tope num" aria-hidden="true">{max ? num(max) : ''}</div>
            <div className="wf-serie-lienzo" role="group" aria-label={`Visitas por día, ${dias.length} días, máximo ${num(max)}`}
                onMouseLeave={() => setEncima(null)}>
                <i className="wf-serie-guia" aria-hidden="true" />
                {!max && <p className="wf-serie-vacio t-cap mut40">Sin visitas en este período.</p>}
                {dias.map((d, i) => (
                    <button key={d.dia} type="button"
                        className={`wf-serie-col${encima === i ? ' wf-serie-col--on' : ''}`}
                        onMouseEnter={() => setEncima(i)} onFocus={() => setEncima(i)} onBlur={() => setEncima(null)}
                        aria-label={`${diaCorto(d.dia)}: ${d.visitas} visitas, ${d.clics_whatsapp} clics al grupo`}>
                        {d.visitas > 0 ? (
                            <i style={{
                                height: montado ? `${(d.visitas / max) * 100}%` : 0,
                                transitionDelay: `${Math.min(i, 40) * 12}ms`,
                            }} />
                        ) : <i className="wf-serie-cero" />}
                    </button>
                ))}
                {dia && (
                    <div className="wf-serie-tip" role="tooltip"
                        style={{ left: `${((encima + 0.5) / dias.length) * 100}%` }}>
                        <b>{diaCorto(dia.dia)}</b>
                        <span>Visitas<strong className="num">{num(dia.visitas)}</strong></span>
                        <span>Clics al grupo<strong className="num">{num(dia.clics_whatsapp)}</strong></span>
                    </div>
                )}
            </div>
            <div className="wf-serie-eje num" aria-hidden="true">
                {dias.map((d, i) => (
                    <span key={d.dia}>{i % cada === 0 ? diaCorto(d.dia) : ''}</span>
                ))}
            </div>
        </div>
    );
};

export default SerieVisitas;
