import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import Cifra from '../../../comercial/components/Cifra';
import FlujoEmbudo from '../../../comercial/components/FlujoEmbudo';
import { PanelCab, Tip } from '../../../comercial/components/Shared';
import WorkshopSourceSplit from './WorkshopSourceSplit';
import { cac, dinero, ganancia, pasosEmbudo, porcentaje, tasaPaso } from '../talleres/formato';

/**
 * El embudo completo de un taller (Talleres › detalle › Embudo): la plata arriba, los nueve pasos
 * de leads a ventas y cuánto aportó la clase en vivo contra la grabación (`WorkshopSourceSplit`).
 * El desglose lo pide quien lo abre (`DetalleTaller`), que lo refresca mientras está abierto.
 */

// «hace 2 min» para `synced_at`; se recalcula cada 30 s para no quedar pegado en «hace un momento».
function useHace(iso) {
    const [, tic] = useState(0);
    useEffect(() => {
        if (!iso) return undefined;
        const id = setInterval(() => tic((n) => n + 1), 30000);
        return () => clearInterval(id);
    }, [iso]);
    if (!iso) return null;
    const seg = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (seg < 45) return 'hace un momento';
    const min = Math.round(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `hace ${h} h`;
    return `hace ${Math.round(h / 24)} d`;
}

export const Kpi = ({ titulo, valor, sub, tip, color, i = 0 }) => {
    const quieto = useReducedMotion();
    return (
        <motion.section className="kpi wt-kpi"
            initial={quieto ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            transition={quieto ? { duration: 0 } : { duration: 0.3, delay: i * 0.05, ease: [0.22, 0.7, 0.2, 1] }}>
            <div className="kpi-cab">
                <p className="t-eyebrow">{titulo}</p>
                {tip && <Tip texto={tip} titulo={titulo} />}
            </div>
            <div className="kpi-cifra">
                <Cifra valor={valor} className="kpi-n" style={color ? { color } : undefined} desdeAnterior />
                {sub && <p className="kpi-sub">{sub}</p>}
            </div>
        </motion.section>
    );
};

const WorkshopFunnelView = ({ evento, desglose, ventana, cargandoDesglose, onResync, resyncing, agendas }) => {
    const hace = useHace(evento?.synced_at);
    if (!evento) return null;
    const e = evento;
    const pasos = pasosEmbudo(e);
    const ventas = pasos[pasos.length - 1].n;
    const g = ganancia(e);

    return (
        <div className="vista wt-vista">
            <div className="pareja" style={{ '--min': '190px', '--g': 'var(--s3)' }}>
                <Kpi i={0} titulo="Inversión" valor={dinero(e.inversion)}
                    sub={e.inversion_de_meta ? 'De Meta Ads' : 'Cargada a mano'}
                    tip="Gasto en anuncios de este taller (de Meta si hay)." />
                <Kpi i={1} titulo="Cash cobrado" valor={dinero(e.cash_collected)}
                    sub={`ROAS ${Number(e.roas || 0).toFixed(2)}x`}
                    tip="Todo lo cobrado a las personas del taller, señas incluidas." />
                <Kpi i={2} titulo="Ganancia" valor={dinero(g)} color={g < 0 ? 'var(--error)' : undefined}
                    sub="Cash menos inversión" />
                <Kpi i={3} titulo="CAC" valor={dinero(cac(e))}
                    sub={`${ventas} ${ventas === 1 ? 'venta' : 'ventas'}`}
                    tip="Lo que costó cada venta: la inversión dividida las ventas." />
            </div>

            <section className="panel wt-panel">
                <PanelCab titulo="Embudo"
                    tip="Cada % es contra el paso anterior.">
                    {hace && <span className="t-cap mut40 wt-sync"><i className="wt-punto-vivo" aria-hidden="true" /> Sincronizado {hace}</span>}
                    {onResync && (
                        <button type="button" className="btn btn--linea btn--sm" onClick={onResync} disabled={resyncing}
                            title="Las agendas, ventas y formularios nuevos se sincronizan solos; esto fuerza un resync ahora">
                            <RefreshCw className={resyncing ? 'ws-gira' : ''} aria-hidden="true" />
                            {resyncing ? 'Sincronizando…' : 'Resync'}
                        </button>
                    )}
                </PanelCab>
                <FlujoEmbudo raiz color="var(--brand-secondary)"
                    etapas={pasos.map((p) => ({ key: p.key, label: p.label, n: p.n, ayuda: p.ayuda, base: p.base }))} />
                <p className="t-cap mut num wt-pie-embudo">
                    De {pasos[0].n.toLocaleString('en-US')} leads a {ventas} {ventas === 1 ? 'venta' : 'ventas'}:{' '}
                    {porcentaje(tasaPaso(ventas, pasos[0].n))} final
                </p>
            </section>

            {/* `agendas` (el desglose por estado) va al lado del vivo vs. grabación: dos columnas que se apilan */}
            <div className="wt-doble">
                {agendas}
                <WorkshopSourceSplit desglose={desglose} ventana={ventana} cargando={cargandoDesglose} />
            </div>
        </div>
    );
};

export default WorkshopFunnelView;
