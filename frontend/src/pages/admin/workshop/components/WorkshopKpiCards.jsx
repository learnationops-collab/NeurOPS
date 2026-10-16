import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Humo, Tip } from '../../../comercial/components/Shared';
import Cifra from '../../../comercial/components/Cifra';
import { ticketPromedio } from '../funnelMath';

/**
 * Las seis cifras del Resumen, con el tile de Analizar del dashboard comercial (`.kpi`): rótulo con
 * su «i», la cifra que cuenta hasta su valor y abajo la variación contra la comparación elegida.
 *
 * La variación compara el promedio POR TALLER (un período puede tener más talleres que el otro); el
 * ROAS ya es una razón. La inversión no es buena ni mala por subir: va en gris.
 *
 * Seis en una grilla que nunca deja uno suelto: 6, 3 × 2, 2 × 3 o uno debajo del otro (ver
 * `.wr-kpis` en resumen.css).
 */

const dinero = (v) => {
    const n = Number(v) || 0;
    // Los costos por lead suelen ser de un dígito: sin centavos «$3» no dice nada.
    return Math.abs(n) < 100 && n % 1 !== 0
        ? `$${n.toFixed(2)}`
        : `$${Math.round(n).toLocaleString('en-US')}`;
};
const entero = (v) => Math.round(Number(v) || 0).toLocaleString('en-US');

const Cambio = ({ valor, neutro, titulo }) => {
    if (valor == null || !Number.isFinite(valor)) return null;
    const sube = valor >= 0;
    const tono = neutro ? 'text-muted' : sube ? 'success' : 'error';
    const texto = `${sube ? '▲' : '▼'} ${Math.abs(valor).toFixed(1)}%`;
    return (
        <span className="delta" style={{ '--c': `var(--${tono})` }} title={titulo}
            aria-label={`${sube ? 'Sube' : 'Baja'} ${Math.abs(valor).toFixed(1)}% contra la comparación`}>
            {texto}
        </span>
    );
};

const HUMOS = {
    inversion: ['var(--info)', 'var(--brand-navy)'],
    cash: ['var(--success)', 'var(--brand-primary)'],
    roas: ['var(--brand-secondary)', 'var(--brand-secondary-light)'],
    leads: ['var(--info)', 'var(--brand-secondary)'],
    agendas: ['var(--warning)', 'var(--brand-primary)'],
    sales: ['var(--brand-secondary)', 'var(--success)'],
};

const WorkshopKpiCards = ({ totalStats, eventsCount, cambios, anterior }) => {
    const reducir = useReducedMotion();
    const t = totalStats;
    const n = eventsCount || 0;
    const neto = t.cash - t.inversion;
    const margen = t.cash > 0 ? Math.round((neto / t.cash) * 100) : 0;
    const costo = (den) => (den > 0 ? t.inversion / den : 0);

    const roasTono = t.roas >= 1.5 ? 'success' : t.roas > 0 ? 'warning' : 'text-on-surface';

    // Lo que dice el «▲» cuando se le pasa por encima: el promedio por taller de cada lado.
    const porTaller = (clave, formato) => (anterior && n && anterior.cantidad
        ? `Por taller: ${formato(t[clave] / n)} vs ${formato(anterior.totales[clave] / anterior.cantidad)}`
        : undefined);

    const tiles = [
        {
            key: 'inversion', label: 'Inversión', valor: dinero(t.inversion), neutro: true,
            sub: `${dinero(n ? t.inversion / n : 0)} por taller`, titulo: porTaller('inversion', dinero),
            ayuda: 'Lo que se gastó en publicidad para estos talleres.',
        },
        {
            key: 'cash', label: 'Cash collected', valor: dinero(t.cash),
            sub: `Neto ${dinero(neto)} · ${margen}%`, titulo: porTaller('cash', dinero),
            ayuda: 'Lo que entró de verdad (no lo prometido ni lo facturado). Neto = cobrado menos inversión.',
        },
        {
            key: 'roas', label: 'ROAS', valor: `${t.roas.toFixed(2)}x`, color: roasTono,
            sub: `Ticket ${dinero(ticketPromedio(t))}`,
            titulo: anterior ? `${t.roas.toFixed(2)}x vs ${anterior.totales.roas.toFixed(2)}x` : undefined,
            ayuda: 'Cuántos dólares volvieron por cada $1 de publicidad: 1x es empatar, desde 1,5x es sano. Ticket = lo cobrado en ventas nuevas (pago completo o split) ÷ esas ventas; señas y cuotas no entran.',
        },
        {
            key: 'leads', label: 'Leads', valor: entero(t.leads),
            sub: `CPL ${dinero(costo(t.leads))}`, titulo: porTaller('leads', entero),
            ayuda: 'Personas que se registraron. CPL = inversión ÷ leads.',
        },
        {
            key: 'agendas', label: 'Agendas', valor: entero(t.agendas),
            sub: `CPA ${dinero(costo(t.agendas))}`, titulo: porTaller('agendas', entero),
            ayuda: 'Llamadas de venta agendadas, de la clase en vivo y de la grabación. CPA = inversión ÷ agendas.',
        },
        {
            key: 'sales', label: 'Ventas', valor: entero(t.sales),
            sub: `CAC ${dinero(costo(t.sales))}`, titulo: porTaller('sales', entero),
            ayuda: 'Personas distintas que compraron (si alguien paga en dos partes cuenta una vez). CAC = inversión ÷ ventas.',
        },
    ];

    return (
        <section className="wr-kpis" aria-label="Indicadores principales">
            {tiles.map((k, i) => (
                <motion.article key={k.key} className="kpi caja wr-kpi"
                    initial={reducir ? false : { opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.32, delay: reducir ? 0 : i * 0.045, ease: [0.22, 0.7, 0.2, 1] }}>
                    <Humo colores={HUMOS[k.key]} />
                    <div className="kpi-cab">
                        <p className="t-eyebrow trunc">{k.label}</p>
                        <Tip texto={k.ayuda} titulo={k.label} />
                    </div>
                    <Cifra tag="p" className="kpi-n wr-kpi-n" valor={k.valor} desdeAnterior
                        style={{ color: `var(--${k.color || 'text-on-surface'})` }} />
                    <div className="kpi-pie wr-kpi-pie">
                        <Cambio valor={cambios?.[k.key]} neutro={k.neutro} titulo={k.titulo} />
                        <span className="num trunc">{k.sub}</span>
                    </div>
                </motion.article>
            ))}
        </section>
    );
};

export default WorkshopKpiCards;
