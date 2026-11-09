import React from 'react';
import { ChevronRight } from 'lucide-react';
import { fmt, Tip, useMontado } from './Shared';
import Cifra from './Cifra';
import { abrir } from '../../../components/dashboard/MetricaClicable';
import { DESTINOS_CLOSER as D } from './destinos';
import { Comparado, Panel, PanelCab, v } from './PiezasAnalizar';
import './panelCash.css';

/**
 * Panel Cash del dashboard comercial (09/11/2026, pedido de Mario): el dinero del período a primera vista,
 * neto de la pasarela. Arriba el Cash collected con sus días; abajo dos promedios, ticket y CAC (gasto de
 * Meta en Setting y Workshop ÷ clientes nuevos, `datos.adquisicion`: solo con todo el equipo y sin filtros).
 * Lo que falta cobrar vive en su propio panel (`PanelPorCobrar`): es un saldo, no una cifra del período.
 *
 * Lo que abre una lista es una tarjeta-botón con su flecha, como los conteos de Cierre: se ve antes de tocar.
 */
const diferencia = (a, b) => `${a >= b ? '+' : '−'}${fmt.money(Math.abs(a - b))}`;

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

/** Una tarjeta que abre su lista: entera es el botón, con la flecha arriba a la derecha. */
export const Tocable = ({ onClick, titulo, className, style, children }) => (onClick ? (
    <button type="button" className={`tocable ${className || ''}`} style={style} onClick={onClick}
        title={titulo} aria-label={titulo}>
        {children}
        <span className="tocable-flecha" aria-hidden="true"><ChevronRight size={14} /></span>
    </button>
) : <div className={className} style={style}>{children}</div>);

const Promedio = ({ label, help, valor, previo, tone, onClick, pie, vs, detallePrevio, mejorBaja }) => (
    <Tocable className="pc-prom" style={{ '--c': v(tone) }} onClick={onClick} titulo={`Ver los registros de ${label}`}>
        <span className="pc-rot">{label}<Tip titulo={label} texto={help} /></span>
        <Cifra className="pc-prom-n num" valor={valor == null ? '—' : fmt.money(valor)} />
        <small className="pc-prom-pie num">{pie}</small>
        <Comparado vs={vs} actual={valor} previo={previo} f={fmt.money} mejorBaja={mejorBaja} detalle={detallePrevio} />
    </Tocable>
);

const PanelCash = ({ bloque, previo, adquisicion, vsLabel, irA }) => {
    const cac = adquisicion?.actual;
    const cacPrevio = adquisicion?.previo;
    const ticketPrevio = previo ? (previo.ticket_neto ?? previo.ticket) : null;
    return (
        <Panel id="p-cash" cab={
            <PanelCab titulo="Cash" ayuda="Lo que entró en el período, neto de la comisión de la pasarela." />
        }>
            <Tocable className="pc-hero" onClick={abrir(irA, D.cash_neto)} titulo="Ver los cobros del período">
                <div className="pc-hero-cifra">
                    <span className="pc-rot">Cash collected</span>
                    <Cifra className="pc-hero-n num" valor={fmt.money(bloque.cash_neto)} />
                    <Comparado vs={vsLabel} actual={bloque.cash_neto} previo={previo?.cash_neto} f={fmt.money}
                        detalle={previo?.cash_neto != null ? diferencia(bloque.cash_neto, previo.cash_neto) : null} />
                </div>
                <Dias dias={bloque.cash_por_dia} mejor={bloque.mejor_dia} />
            </Tocable>

            <div className="pc-proms">
                <Promedio label="Ticket promedio" tone="info" vs={vsLabel} onClick={abrir(irA, D.ticket_promedio)}
                    help="Lo cobrado en las ventas nuevas ÷ cuántas fueron. Cuotas y señas no entran."
                    valor={bloque.ticket_neto ?? bloque.ticket} previo={ticketPrevio}
                    detallePrevio={previo ? fmt.plural(previo.ventas, 'venta', 'ventas') : null}
                    pie={fmt.plural(bloque.ventas, 'venta', 'ventas')} />
                <Promedio label="CAC" tone="brand-secondary" vs={vsLabel} mejorBaja
                    help={cac
                        ? `Costo por cliente: ${fmt.money(cac.gasto)} de Meta (Setting y Workshop) ÷ `
                            + `${fmt.plural(cac.clientes, 'cliente nuevo', 'clientes nuevos')}.`
                        : 'Costo por cliente: gasto de Meta ÷ clientes nuevos. Solo con todo el equipo, sin '
                            + 'segmento ni país: el gasto no se reparte.'}
                    valor={cac?.cac ?? null} previo={cacPrevio?.cac ?? null}
                    detallePrevio={cacPrevio ? `${fmt.money(cacPrevio.gasto)} · ${cacPrevio.clientes} cl.` : null}
                    pie={cac ? `${fmt.money(cac.gasto)} en ads · ${fmt.plural(cac.clientes, 'cliente', 'clientes')}` : 'sin filtros'} />
            </div>
        </Panel>
    );
};

export default PanelCash;
