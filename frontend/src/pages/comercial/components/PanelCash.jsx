import React from 'react';
import { fmt, Tip, useMontado } from './Shared';
import Cifra from './Cifra';
import MetricaClicable from '../../../components/dashboard/MetricaClicable';
import { DESTINOS_CLOSER as D } from './destinos';
import { Comparado, Panel, PanelCab, v } from './PiezasAnalizar';
import './panelCash.css';

/**
 * Panel Cash del dashboard comercial (09/11/2026, pedido de Mario): lo que importa del dinero a primera
 * vista y sin texto. Todo neto de la pasarela (las fees se analizan aparte).
 *
 *  · Cash collected: lo que entró, con el monto del período comparado y los cobros por día.
 *  · Promedios: ticket promedio (por venta nueva) y CAC (gasto de Meta en Setting y Workshop ÷ clientes
 *    nuevos, `datos.adquisicion`; solo con todo el equipo y sin filtros, porque el gasto no se reparte).
 *  · Por cobrar a hoy: una barra partida en vencido, por vencer y sin cronograma. No es del período.
 */
const DEUDA = [
    { label: 'Vencido', campo: 'vencido', tone: 'error', destino: 'por_cobrar_vencido',
        help: 'Cuotas con vencimiento ya pasado y sin pagar.' },
    { label: 'Por vencer', campo: 'por_vencer', tone: 'info', destino: 'por_cobrar_por_vencer',
        help: 'Cuotas con fecha futura: cronograma normal.' },
    { label: 'Sin cronograma', campo: 'sin_plan', tone: 'warning', destino: 'por_cobrar_sin_plan',
        help: 'Saldo sin ninguna cuota programada: nadie le armó un plan de cobro.' },
];

const Dias = ({ dias, mejor }) => {
    const montado = useMontado();
    const tope = Math.max(...dias.map(d => d.cash), 0);
    return (
        <div className="pc-dias" title={mejor ? `Mejor día: ${fmt.money(mejor.cash)} · ${fmt.fecha(mejor.dia)}` : undefined}>
            {dias.map((d, i) => (
                <i key={d.dia} title={`${fmt.fecha(d.dia)} · ${fmt.money(d.cash)}`}
                    className={d.cash === tope && tope > 0 ? 'pc-dia-pico' : d.cash === 0 ? 'pc-dia-cero' : undefined}
                    style={{
                        height: montado ? `${tope ? Math.max((d.cash / tope) * 100, d.cash ? 8 : 4) : 4}%` : 0,
                        transitionDelay: `${i * 30}ms`,
                    }} />
            ))}
        </div>
    );
};

/** Un promedio: rótulo, cifra grande y, si hay comparación, la del período anterior. */
const Promedio = ({ label, help, valor, previo, tone, destino, irA, pie, vs, mejorBaja }) => (
    <div className="pc-prom" style={{ '--c': v(tone) }}>
        <span className="pc-rot">{label}<Tip titulo={label} texto={help} /></span>
        <MetricaClicable irA={irA} destino={destino} vacio={valor == null} subrayar={false}
            detalle={`${label} · ${valor == null ? '—' : fmt.money(valor)}`}>
            <Cifra className="pc-prom-n num" valor={valor == null ? '—' : fmt.money(valor)} />
        </MetricaClicable>
        <small className="pc-prom-pie num">{pie}</small>
        <Comparado vs={vs} actual={valor} previo={previo} f={fmt.money} mejorBaja={mejorBaja} />
    </div>
);

const PanelCash = ({ bloque, previo, porCobrar, adquisicion, vsLabel, irA }) => {
    const montado = useMontado();
    const cac = adquisicion?.actual;
    const total = porCobrar?.total || 0;
    return (
        <Panel id="p-cash" cab={
            <PanelCab titulo="Cash"
                ayuda={'Todo neto de la comisión de la pasarela. Abajo, lo que falta cobrar a hoy: es un '
                    + 'saldo, no cambia con el filtro de fechas.'} />
        }>
            <div className="pc-hero">
                <div className="pc-hero-cifra">
                    <span className="pc-rot">Cash collected</span>
                    <MetricaClicable irA={irA} destino={D.cash_neto} vacio={!bloque.cash_neto} subrayar={false}
                        detalle={`Cash collected · ${fmt.money(bloque.cash_neto)}`}>
                        <Cifra className="pc-hero-n num" valor={fmt.money(bloque.cash_neto)} />
                    </MetricaClicable>
                    <Comparado vs={vsLabel} actual={bloque.cash_neto} previo={previo?.cash_neto} f={fmt.money} />
                </div>
                <Dias dias={bloque.cash_por_dia} mejor={bloque.mejor_dia} />
            </div>

            <div className="pc-proms">
                <Promedio label="Ticket promedio" tone="info" irA={irA} destino={D.ticket_promedio} vs={vsLabel}
                    help="Lo cobrado en las ventas nuevas ÷ cuántas fueron. Cuotas y señas no entran."
                    valor={bloque.ticket_neto ?? bloque.ticket}
                    previo={previo ? (previo.ticket_neto ?? previo.ticket) : null}
                    pie={fmt.plural(bloque.ventas, 'venta', 'ventas')} />
                <Promedio label="CAC" tone="brand-secondary" irA={irA} vs={vsLabel} mejorBaja
                    help={cac
                        ? `Costo por cliente: ${fmt.money(cac.gasto)} de Meta (Setting y Workshop) ÷ `
                            + `${fmt.plural(cac.clientes, 'cliente nuevo', 'clientes nuevos')}.`
                        : 'Costo por cliente: gasto de Meta ÷ clientes nuevos. Solo con todo el equipo, sin '
                            + 'segmento ni país: el gasto no se reparte.'}
                    valor={cac?.cac ?? null}
                    previo={adquisicion?.previo?.cac ?? null}
                    pie={cac ? `${fmt.money(cac.gasto)} en ads` : 'sin filtros'} />
            </div>

            {porCobrar && (
                <div className="pc-deuda">
                    <div className="pc-deuda-cab">
                        <span className="pc-rot">Por cobrar · hoy</span>
                        <MetricaClicable irA={irA} destino={D.por_cobrar} subrayar={false}
                            detalle={`Por cobrar a hoy · ${fmt.money(total)}`}>
                            <Cifra className="pc-deuda-total num" valor={fmt.money(total)} />
                        </MetricaClicable>
                    </div>
                    <div className="pc-deuda-barra" aria-hidden="true">
                        {DEUDA.map(x => porCobrar[x.campo] > 0 && (
                            <i key={x.campo} style={{ flex: montado ? porCobrar[x.campo] : 0.0001, background: v(x.tone) }} />
                        ))}
                    </div>
                    <div className="pc-deuda-items">
                        {DEUDA.map(x => (
                            <div key={x.campo} className="pc-deuda-item" style={{ '--c': v(x.tone) }}>
                                <span className="pc-rot"><i />{x.label}<Tip titulo={x.label} texto={x.help} /></span>
                                <MetricaClicable irA={irA} destino={D[x.destino]} subrayar={false}
                                    vacio={!porCobrar[x.campo]}
                                    detalle={`${x.label} · ${fmt.money(porCobrar[x.campo])}`}>
                                    <Cifra className="pc-deuda-n num" valor={fmt.money(porCobrar[x.campo])} />
                                </MetricaClicable>
                                <small className="num">{total ? Math.round((porCobrar[x.campo] / total) * 100) : 0}%</small>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </Panel>
    );
};

export default PanelCash;
