import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Eye } from 'lucide-react';
import { Humo, Tip } from '../../../comercial/components/Shared';
import Cifra from '../../../comercial/components/Cifra';
import { ticketPromedio } from '../funnelMath';
import { roasRotulo } from '../talleres/formato';
import { parteDe, parteSuelta } from '../registros/cuentas';
import { CifraConCuenta, SkeletonBlock, SkeletonText } from '../../../../components/standard';
import '../../marketing/anuncios/anuncios.css';

/**
 * Las ocho cifras del Resumen, con el tile de Analizar del dashboard comercial (`.kpi`): rótulo con
 * su «i», el ojo que abre la lista que suma la cifra (ADR-W015), la cifra que cuenta hasta su valor y
 * abajo la variación contra la comparación elegida.
 *
 * Arriba el embudo (inversión, leads, agendas, ventas) y abajo la plata (New Cash, Cash total y sus dos ROAS, con el
 * mismo peso: Kerwin, 28/10/2026). Todo costo, ROAS o porcentaje va solo y dice su «N de M» en un tooltip; cada
 * parte abre su lista (`onVer`, de `useRegistrosWorkshop`).
 *
 * La variación compara el promedio POR TALLER (un período puede tener más talleres que el otro); el
 * ROAS ya es una razón. La inversión no es buena ni mala por subir: va en gris.
 *
 * Ocho en una grilla que nunca deja uno suelto: 4 × 2, 2 × 4 o uno debajo del otro (ver
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
    leads: ['var(--info)', 'var(--brand-secondary)'],
    agendas: ['var(--warning)', 'var(--brand-primary)'],
    sales: ['var(--brand-secondary)', 'var(--success)'],
    new_cash: ['var(--success)', 'var(--brand-secondary)'],
    cash: ['var(--success)', 'var(--brand-primary)'],
    roas_nc: ['var(--brand-secondary)', 'var(--success)'],
    roas: ['var(--brand-secondary)', 'var(--brand-secondary-light)'],
};

// Rótulo, ayuda y lista que abre no dependen de los datos: se ven desde el primer momento, también cargando.
const ROTULOS = [
    { key: 'inversion', label: 'Inversión', lista: 't_inversion', ayuda: 'Lo gastado en publicidad para estos talleres.' },
    { key: 'leads', label: 'Leads', lista: 't_leads', ayuda: 'Leads de Meta. CPL = inversión ÷ leads.' },
    { key: 'agendas', label: 'Agendas', lista: 'agendas', ayuda: 'Personas con llamada agendada. CPA = inversión ÷ agendas.' },
    { key: 'sales', label: 'Ventas', lista: 'ventas', ayuda: 'Compradores (completo o split). CAC = inversión ÷ ventas.' },
    { key: 'new_cash', label: 'New Cash', lista: 'new_cash', ayuda: 'Ventas nuevas y su primera cuota: la base del ticket.' },
    { key: 'cash', label: 'Cash total', lista: 'cash_total', ayuda: 'Ventas nuevas y señas cobradas. Sin cuotas.' },
    { key: 'roas_nc', label: 'ROAS New Cash', lista: 'new_cash', ayuda: 'New Cash ÷ inversión.' },
    { key: 'roas', label: 'ROAS Total', lista: 'cash_total', ayuda: 'Cash total ÷ inversión. Desde 1,5x es sano.' },
];

/** Cifra y detalle de cada tile: lo único que depende de los talleres. `cuenta` va solo donde la cifra es una razón. */
const valores = (t, n, anterior) => {
    const neto = t.cash - t.inversion;
    const margen = t.cash > 0 ? Math.round((neto / t.cash) * 100) : 0;
    const costo = (den) => (den > 0 ? t.inversion / den : 0);
    const roasTono = (r) => (r >= 1.5 ? 'success' : r > 0 ? 'warning' : 'text-on-surface');
    const inv = parteDe(dinero(t.inversion), 't_inversion');
    // Lo que dice el «▲» cuando se le pasa por encima: el promedio por taller de cada lado.
    const porTaller = (clave, formato) => (anterior && n && anterior.cantidad
        ? `Por taller: ${formato(t[clave] / n)} vs ${formato(anterior.totales[clave] / anterior.cantidad)}`
        : undefined);
    const veces = (r) => `${r.toFixed(2)}x`;
    const costoDe = (rotulo, den, lista, unidad) => ({
        rotulo, valor: dinero(costo(den)), cuenta: { a: inv, b: parteDe(`${entero(den)} ${unidad}`, lista) },
    });

    return {
        inversion: { valor: dinero(t.inversion), neutro: true, sub: `${dinero(n ? t.inversion / n : 0)} por taller`, titulo: porTaller('inversion', dinero) },
        leads: { valor: entero(t.leads), sub: costoDe('CPL', t.leads, 't_leads', 'leads'), titulo: porTaller('leads', entero) },
        agendas: { valor: entero(t.agendas), sub: costoDe('CPA', t.agendas, 'agendas', 'agendas'), titulo: porTaller('agendas', entero) },
        sales: { valor: entero(t.sales), sub: costoDe('CAC', t.sales, 'ventas', 'ventas'), titulo: porTaller('sales', entero) },
        new_cash: {
            valor: dinero(t.cash_ventas), titulo: porTaller('cash_ventas', dinero),
            sub: t.ventas_cobradas > 0 ? {
                rotulo: 'Ticket', valor: dinero(ticketPromedio(t)),
                cuenta: { a: parteDe(dinero(t.cash_ventas), 'new_cash'), b: parteSuelta(`${entero(t.ventas_cobradas)} ${t.ventas_cobradas === 1 ? 'venta cobrada' : 'ventas cobradas'}`) },
            } : 'sin ventas nuevas',
        },
        cash: {
            valor: dinero(t.cash), titulo: porTaller('cash', dinero),
            sub: { rotulo: `Neto ${dinero(neto)} ·`, valor: `${margen}%`, cuenta: { a: parteSuelta(`${dinero(neto)} neto`), b: parteDe(`${dinero(t.cash)} cobrados`, 'cash_total') } },
        },
        roas_nc: {
            valor: veces(t.roas_nc), color: roasTono(t.roas_nc), sub: { texto: roasRotulo(t.roas_nc), color: roasTono(t.roas_nc) }, cuenta: { a: parteDe(dinero(t.cash_ventas), 'new_cash'), b: inv },
            titulo: anterior ? `${veces(t.roas_nc)} vs ${veces(anterior.totales.roas_nc)}` : undefined,
        },
        roas: {
            valor: veces(t.roas), color: roasTono(t.roas), sub: { texto: roasRotulo(t.roas), color: roasTono(t.roas) }, cuenta: { a: parteDe(dinero(t.cash), 'cash_total'), b: inv },
            titulo: anterior ? `${veces(t.roas)} vs ${veces(anterior.totales.roas)}` : undefined,
        },
    };
};

/** El renglón de abajo: un texto, o «CPL $1.38» con su cuenta en un tooltip. */
const Pie = ({ sub, onVer }) => {
    if (typeof sub === 'string') return <span className="num trunc">{sub}</span>;
    // Un veredicto en el color del número («Rentable»): lo que antes decía la fórmula escrita.
    if (sub.texto) return <span className="num trunc" style={{ color: `var(--${sub.color})`, fontWeight: 800 }}>{sub.texto}</span>;
    return (
        <span className="num">
            {sub.rotulo} <CifraConCuenta cuenta={sub.cuenta} onVer={onVer}>{sub.valor}</CifraConCuenta>
        </span>
    );
};

/**
 * Sin `totalStats` (los talleres todavía no llegaron) cada tile ya está en su lugar con su rótulo,
 * y la cifra y el detalle son huesos del alto real (32 y 17 px): al llegar, el número entra y
 * cuenta hasta su valor sin mover nada.
 */
const WorkshopKpiCards = ({ totalStats, eventsCount, cambios, anterior, onVer = null }) => {
    const reducir = useReducedMotion();
    const datos = totalStats ? valores(totalStats, eventsCount || 0, anterior) : null;

    return (
        <section className="wr-kpis" aria-label="Indicadores principales" aria-busy={datos ? undefined : true}>
            {!datos && <span className="ui-skel__sr" role="status">Cargando los indicadores…</span>}
            {ROTULOS.map((k, i) => {
                const v = datos?.[k.key];
                const color = { color: `var(--${v?.color || 'text-on-surface'})` };
                return (
                    <motion.article key={k.key} className="kpi caja wr-kpi"
                        initial={reducir ? false : { opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.32, delay: reducir ? 0 : i * 0.045, ease: [0.22, 0.7, 0.2, 1] }}>
                        <Humo colores={HUMOS[k.key]} />
                        <div className="kpi-cab">
                            <p className="t-eyebrow trunc">{k.label}</p>
                            <Tip texto={k.ayuda} titulo={k.label} />
                            {onVer && v && (
                                <button type="button" className="mk-kpi-ver" onClick={() => onVer(k.lista, k.label)}
                                    aria-label={`Ver los registros de ${k.label}`} data-tip="Ver las filas que suman esta cifra">
                                    <Eye size={15} aria-hidden="true" />
                                </button>
                            )}
                        </div>
                        {v ? (
                            <>
                                {/* La variación va junto a la cifra: en su propio renglón sumaba una fila a cada tile. */}
                                <div className="wr-kpi-fila ui-reveal">
                                    {v.cuenta ? (
                                        <CifraConCuenta cuenta={v.cuenta} onVer={onVer} className="wr-kpi-n-caja">
                                            <Cifra className="kpi-n wr-kpi-n" valor={v.valor} desdeAnterior style={color} />
                                        </CifraConCuenta>
                                    ) : (
                                        <Cifra tag="p" className="kpi-n wr-kpi-n" valor={v.valor} desdeAnterior style={color} />
                                    )}
                                    <Cambio valor={cambios?.[k.key]} neutro={v.neutro} titulo={v.titulo} />
                                </div>
                                <div className="kpi-pie wr-kpi-pie ui-reveal">
                                    <Pie sub={v.sub} onVer={onVer} />
                                </div>
                            </>
                        ) : (
                            <>
                                <SkeletonBlock height={32} width="64%" radius={10} step={i} />
                                <SkeletonText height={10} lineHeight={17} width="72%" step={i + 1} />
                            </>
                        )}
                    </motion.article>
                );
            })}
        </section>
    );
};

export default WorkshopKpiCards;
