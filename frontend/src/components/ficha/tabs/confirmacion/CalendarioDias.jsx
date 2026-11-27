import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { grillaMes, hoyEn, mesCorto, mesesDe, nombreMes } from './reprogramar';

const SEMANA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Calendario del mes: solo se tocan los días con horarios libres. Debajo del número, un punto por cada
 *  persona libre ese día, en su color. */
const CalendarioDias = ({ dias, tz, valor, onElegir, quienesDe, colorDe }) => {
    const meses = mesesDe(dias);
    const [i, setI] = useState(0);
    useEffect(() => {
        const j = valor ? meses.indexOf(valor.slice(0, 7)) : -1;
        setI(j >= 0 ? j : 0);
    }, [dias.length, tz]); // eslint-disable-line react-hooks/exhaustive-deps

    const mes = meses[Math.min(i, meses.length - 1)];
    if (!mes) return null;
    const cuenta = Object.fromEntries(dias.map((d) => [d.dia, d.isos.length]));
    const hoy = hoyEn(tz);

    return (
        <div className="rp-cal">
            <div className="rp-cal-cab">
                <b>{mesCorto(mes)}</b>
                {meses.length > 1 && (
                    <div className="rp-cal-nav">
                        <button type="button" aria-label="Mes anterior" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft size={16} /></button>
                        <button type="button" aria-label="Mes siguiente" disabled={i >= meses.length - 1} onClick={() => setI(i + 1)}><ChevronRight size={16} /></button>
                    </div>
                )}
            </div>
            <div className="rp-cal-grilla" role="grid" aria-label={`Días de ${nombreMes(mes)}`}>
                {SEMANA.map((s, k) => <span key={k} className="rp-cal-sem" aria-hidden="true">{s}</span>)}
                {grillaMes(mes).map((dia, k) => {
                    if (!dia) return <span key={`v${k}`} />;
                    const n = cuenta[dia] || 0;
                    return (
                        <button key={dia} type="button" className="rp-cal-dia" disabled={!n}
                            aria-pressed={dia === valor} data-hoy={dia === hoy || undefined}
                            aria-label={`${Number(dia.slice(8))}${n ? ` · ${n} horarios` : ' · sin horarios'}`}
                            onClick={() => onElegir(dia)}>
                            <span>{Number(dia.slice(8))}</span>
                            {n > 0 && (
                                <span className="rp-cal-puntos" aria-hidden="true">
                                    {quienesDe(dia).map((id) => <i key={id} style={{ background: colorDe(id) }} />)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CalendarioDias;
