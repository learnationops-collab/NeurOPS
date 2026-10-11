import React, { useEffect, useState } from 'react';
import Flujo from './Flujo';
import { ChipAviso, ChipCanal, Numero, useAngosto } from './Piezas';
import { AMBOS, CANALES, ETAPAS, calcular } from './modelo';

/**
 * El Resumen del día: cinco números y los embudos de cada canal y del total.
 *
 * Es el último paso del formulario y también lo que muestra el Historial al abrir un día, así que
 * recibe el reporte ya armado (la forma de `vacio()`) y no sabe de dónde vino. `conAvisos` pone
 * debajo de los números los avisos de todo el reporte (en el formulario; en el Historial ya es
 * tarde para corregir y no se muestran).
 */

/** Las dos rayitas de abajo de un número: cuánto de eso fue de anuncios y cuánto de inbound. */
const Reparto = ({ a, b }) => {
    // Arrancan en cero y crecen al montarse, como en el diseño (con movimiento reducido, quietas).
    const [listo, setListo] = useState(false);
    useEffect(() => { const id = requestAnimationFrame(() => setListo(true)); return () => cancelAnimationFrame(id); }, []);
    const total = a + b;
    const pa = listo && total ? (a / total) * 100 : 0;
    const pb = listo && total ? (b / total) * 100 : 0;
    return (
        <span className="rd-split" aria-hidden="true">
            <i className="a" style={{ width: `${pa}%` }} />
            <i className="b" style={{ width: `${pb}%` }} />
        </span>
    );
};

export const Kpis = ({ estado, conAvisos = false }) => {
    const { num, avisos } = calcular(estado);
    const ads = estado.anuncios;
    const inb = estado.inbound;
    return (
        <div className="rd-kpis rd-vidrio">
            <div className="rd-kpi">
                <span className="rd-k">Entrantes</span>
                <Numero valor={num['tot.entr']} />
                <Reparto a={ads.entrantes} b={inb.entrantes} />
            </div>
            <div className="rd-kpi">
                <span className="rd-k">Cualificación</span>
                <Numero valor={num['tot.cualRate']} tipo="pct" />
            </div>
            <div className="rd-kpi">
                <span className="rd-k">Apertura</span>
                <Numero valor={num['tot.apRate']} tipo="pct" />
            </div>
            <div className="rd-kpi">
                <span className="rd-k">Agendas</span>
                <Numero valor={num['tot.agendas']} />
                <Reparto a={ads.agendas} b={inb.agendas} />
            </div>
            <div className="rd-kpi">
                <span className="rd-k">Bienvenidas</span>
                <Numero valor={num['bienvenidas.rate']} tipo="pct" />
            </div>
            {conAvisos && avisos.length > 0 && (
                <div className="rd-kpis-pie rd-avisos">{avisos.map(a => <ChipAviso key={a.msg} aviso={a} />)}</div>
            )}
        </div>
    );
};

const ColResumen = ({ canal, chips, children, indice }) => (
    <div className="rd-rcol" style={{ '--c': canal.c, '--i': indice }}>
        <div className="rd-rcab"><ChipCanal canal={canal} /><span className="rd-rchips">{chips}</span></div>
        <div className="rd-rbody">{children}</div>
    </div>
);

export const Embudos = ({ estado }) => {
    const { num, G, convG } = calcular(estado);
    const mE = Math.max(1, ...CANALES.map(c => estado[c.k].entrantes));
    const mG = Math.max(1, ...G);
    const fg = useAngosto() ? 70 : 150;
    return (
        <section className="rd-resultado rd-vidrio rd-resultado--resumen" aria-label="Tu día completo">
            <div className="rd-resumen-a">
                {CANALES.map((c, i) => (
                    <ColResumen key={c.k} canal={c} indice={i}
                        chips={(
                            <span className="rd-chip" style={{ '--c': c.c }}>
                                <Numero valor={num[`${c.k}.apRate`]} tipo="pct" /> apertura
                            </span>
                        )}>
                        <Flujo etapas={[{ n: 'Entrantes' }, { n: 'Cualificados' }, { n: 'Agendas' }]} color={c.c}
                            valores={[estado[c.k].entrantes, num[`${c.k}.net`], estado[c.k].agendas]} max={mE}
                            convs={[num[`${c.k}.cualRate`], num[`${c.k}.convRate`]]} fb={64} fg={fg} />
                    </ColResumen>
                ))}
            </div>
            <div className="rd-resumen-b">
                <ColResumen canal={AMBOS} indice={2}
                    chips={(
                        <>
                            <span className="rd-chip" style={{ '--c': 'var(--ch-tot)' }} title="Follow-ups enviados en total">
                                <Numero valor={num['tot.fuTot']} /> follow-ups
                            </span>
                            <span className="rd-chip" style={{ '--c': 'var(--ch-tot)' }} title="Follow-ups que tuvieron respuesta">
                                <Numero valor={num['tot.fuRate']} tipo="pct" /> respuesta
                            </span>
                        </>
                    )}>
                    <Flujo etapas={[{ n: 'Cualificados' }, ...ETAPAS.map(([, n]) => ({ n })), { n: 'Agendas', split: 'canales' }]}
                        color="var(--ch-tot)" tot fb={64} fg={fg} max={mG} convs={convG.slice(1)}
                        valores={[G[0], G[1], G[2], G[3], [estado.anuncios.agendas, estado.inbound.agendas]]} />
                </ColResumen>
            </div>
        </section>
    );
};

const Resumen = ({ estado, conAvisos = false }) => (
    <>
        <Kpis estado={estado} conAvisos={conAvisos} />
        <Embudos estado={estado} />
    </>
);

export default Resumen;
