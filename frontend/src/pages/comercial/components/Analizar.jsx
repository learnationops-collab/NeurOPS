import React, { useState } from 'react';
import { ChevronDown, CreditCard, PieChart, Rows } from 'lucide-react';
import Embudo from './Embudo';
// El "i" era una copia local con una prop `der` para forzar el lado a mano. El `Tip` compartido
// mide y elige el lado que entra, así que la prop desapareció de todas las llamadas.
import { FalloCarga, Segmented, Tip, fmt, useMontado } from './Shared';
import EsqueletoAnalizar from './EsqueletoAnalizar';
// La cifra que sube hasta su valor: vive aparte porque la usa también la tira de Revisar.
import Cifra from './Cifra';
import MetricaClicable, { abrir } from '../../../components/dashboard/MetricaClicable';
import MatrizCierres, { LeyendaCierres } from '../../../components/dashboard/MatrizCierres';
import RepartoEstados from './RepartoEstados';
import TiraDescalificadas from './TiraDescalificadas';
import ModalNoCerradas from './ModalNoCerradas';
import { AYUDA_PROCEDENCIA } from './procedencias';
import {
    DESTINOS_CIERRES, DESTINOS_CLOSER as D, DESTINO_PROCEDENCIAS_TOTAL, PASOS_CLOSER, destinoProcedencia,
} from './destinos';
// El tile, la barra gruesa y el panel los comparte el tablero de setters (10/10/2026).
import { Delta, Panel, PanelCab, Riel, Tabs, Tile, Vacio, tasa, v } from './PiezasAnalizar';
import DashboardSetters, { VISTAS_CANAL } from './DashboardSetters';

/**
 * Analizar → Dashboard.
 *
 * Marcado de la referencia visual: `.kpi` / `.panel` / `.tdatos` / `.torta` / `.gruesa`, con el
 * CSS viviendo entero en `comercial.css`. Acá no se declara ningún color de marca ni ninguna
 * medida del sistema: lo único que viaja por `style` son las variables que la referencia
 * parametriza por dato (`--c` de un tono, `--h1..--h4` del humo) y los anchos y los delays, que
 * dependen del valor y por eso no pueden vivir en la hoja de estilos.
 *
 * Tres reglas que se repiten en todos los paneles:
 *
 *   · Un valor sin denominador se muestra "—", nunca 0%. El backend manda `null` en esos casos y
 *     `fmt` lo respeta: un "0% de cierre" sobre cero presentaciones afirma algo que no pasó.
 *   · Todo número que se pueda pinchar lleva a Revisar ya filtrado, y el filtro se arma con la
 *     ETIQUETA de la faceta, que es contra lo que la tabla compara, no con su `key`.
 *   · Cada panel dice en su propio tooltip contra qué se mide. La mitad de los paneles muestran
 *     la misma cantidad contra denominadores distintos, y sin eso se leen como contradicciones.
 */

/* ============================================================
   PIEZAS
   ============================================================ */

const TABS_VISTA = [['tabla', 'Tabla', Rows], ['grafico', 'Gráfico', PieChart]];

/**
 * Torta: cada ítem como un arco, el total al medio. Un ítem puede traer su `pct` ya calculado (el
 * del backend, repartido para que sumen 100): entonces la leyenda dice ese y no uno propio, para que
 * la dona y la tabla de al lado no den 37,8% y 37,7% del mismo monto.
 */
const Torta = ({ items, total, f, centro }) => {
    const montado = useMontado();
    let off = 0;
    return (
        <div className="torta">
            <div className="torta-svg">
                <svg viewBox="0 0 42 42">
                    <circle className="torta-hueco" cx="21" cy="21" r="15.9155" fill="none"
                        stroke={v('hueco')} strokeWidth="6" />
                    {items.map(it => {
                        const p = total ? (it.n / total) * 100 : 0;
                        // El corte de 1.2 deja una rendija entre arcos: dos colores pegados sin
                        // separación se leen como uno solo.
                        const d = Math.max(p - 1.2, 0);
                        const seg = (
                            <circle key={it.label} className="torta-seg" cx="21" cy="21" r="15.9155"
                                fill="none" stroke={v(it.tone)} strokeWidth="6" strokeLinecap="butt"
                                strokeDasharray={montado ? `${d.toFixed(2)} ${(100 - d).toFixed(2)}` : '0 100'}
                                strokeDashoffset={(-off).toFixed(2)}>
                                <title>
                                    {`${it.label} · ${f(it.n)}${total ? ` · ${it.pct != null ? fmt.pct(it.pct) : `${p.toFixed(1)}%`}` : ''}`}
                                </title>
                            </circle>
                        );
                        off += p;
                        return seg;
                    })}
                </svg>
                <span className="torta-centro">
                    <Cifra tag="b" valor={f(total)} />
                    <span className="t-cap mut40">{centro}</span>
                </span>
            </div>
            <div className="torta-leyenda">
                {items.map(it => {
                    const cuerpo = (
                        <>
                            <span className="dato-punto" style={{ background: v(it.tone) }} />
                            <span className="tl-nom trunc">{it.label}</span>
                            <span className="tl-v" style={{ color: v(it.tone) }}>{f(it.n)}</span>
                            <span className="tl-p">
                                {it.pct != null ? fmt.pct(it.pct) : (total ? `${((it.n / total) * 100).toFixed(1)}%` : '—')}
                            </span>
                        </>
                    );
                    return it.ir
                        ? <button key={it.label} type="button" className="tl-fila" onClick={it.ir}>{cuerpo}</button>
                        : <div key={it.label} className="tl-fila">{cuerpo}</div>;
                })}
            </div>
        </div>
    );
};

/** Sparkline del cash del período: una barra por día, el pico marcado si es único. */
const Chispa = ({ dias, tone, etiqueta }) => {
    const montado = useMontado();
    const tope = Math.max(...dias.map(d => d.cash), 0);
    const picos = dias.filter(d => d.cash === tope && tope > 0).length;
    return (
        <div>
            <div className="dias">
                {dias.map((d, i) => {
                    const alto = tope ? Math.max((d.cash / tope) * 100, d.cash === 0 ? 4 : 8) : 4;
                    const solo = picos === 1 && d.cash === tope && tope > 0;
                    return (
                        <i key={d.dia} title={`${fmt.fecha(d.dia)} · ${fmt.money(d.cash)}`}
                            style={{
                                height: montado ? `${alto}%` : undefined,
                                background: v(solo ? 'success' : (d.cash === 0 ? 'hueco' : tone)),
                                transitionDelay: `${i * 35}ms`,
                            }} />
                    );
                })}
            </div>
            {etiqueta && <p className="t-cap mut40 num" style={{ marginTop: 8 }}>{etiqueta}</p>}
        </div>
    );
};

/* ============================================================
   VOCABULARIO DE COLOR
   ============================================================ */

/**
 * Las formas de pago van en la paleta categórica (`--cat-1..4`) y no en los tonos de estado que
 * manda el backend: un Split Pay no es "info" ni una cuota es "idle" — son identidades, no
 * estados. El orden es el de `TIPOS_PAGO`, que es el mismo en el que llega `payment_types`.
 */
const CAT = ['cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6'];

const marcaPrograma = (programa) => {
    if (programa === 'Residency Roadmap') return v('prog-elite-b');
    if (programa === 'Sin programa') return v('prog-free');
    return v('prog-ace');
};

/* ============================================================
   PANELES · CLOSERS
   ============================================================ */

const TABS_ESTADOS = [['grafico', 'Gráfico', PieChart], ['tabla', 'Tabla', Rows]];

/**
 * Qué pasó con cada cita del período: la dona con los tres grupos (la vista de entrada) o la tabla
 * de estados. El total va una sola vez, en la cabecera. Lo de "Sin reporte" —que mientras no se
 * carguen el show up y el close rate quedan medidos de menos— vive en el tooltip y no en una nota
 * debajo: el diseño no lleva texto en el panel.
 */
// Los estados de las primeras llamadas y los de las segundas, por separado (26/10/2026): el show up
// de las 1ª no es el de las 2ª. «Todas» es el panel de siempre.
const TABS_LLAMADA = [['primera', '1ª llamada'], ['segunda', '2ª llamada'], ['todas', 'Todas']];

const PanelEstados = ({ bloque, irA }) => {
    const [vista, setVista] = useState('grafico');
    const porLlamada = bloque.estados_por_llamada;
    const [llamada, setLlamada] = useState(porLlamada ? 'primera' : 'todas');
    const elegida = llamada !== 'todas' && porLlamada?.[llamada];
    const total = elegida ? elegida.agendas : bloque.agendas;
    const estados = elegida ? elegida.estados : bloque.estados;
    const sinReporte = estados.find(e => e.key === 'sin_reporte');
    return (
        <Panel id="p-estados" cab={
            <PanelCab titulo="Estados"
                ayuda={`Qué pasó con cada una de las ${total} citas agendadas del período.${sinReporte
                    ? ` ${fmt.plural(sinReporte.n, 'llamada', 'llamadas')} ya `
                        + `${sinReporte.n === 1 ? 'pasó' : 'pasaron'} sin reporte: hasta que se carguen, `
                        + 'el show up y el close rate quedan medidos de menos.'
                    : ''}`}>
                {porLlamada && <Tabs valor={llamada} onChange={setLlamada} ops={TABS_LLAMADA} aria="Tipo de llamada" />}
                <Tabs valor={vista} onChange={setVista} ops={TABS_ESTADOS} aria="Vista de estados" />
                <small className="est-total num">
                    <b>{fmt.num(total)}</b> {total === 1 ? 'agenda' : 'agendas'}
                </small>
            </PanelCab>
        }>
            {total === 0
                ? <Vacio texto={llamada === 'segunda' ? 'Sin segundas llamadas en el período.' : 'Sin agendas en el período.'} />
                : <RepartoEstados key={llamada} estados={estados} vista={vista} irA={irA} />}
            {/* Los que el formulario corta no son agendas: pueden ser lo único del período. */}
            {(total > 0 || bloque.descalificadas?.formulario > 0)
                && <TiraDescalificadas datos={bloque.descalificadas} irA={irA} />}
        </Panel>
    );
};

/**
 * El cierre en sus cuatro lecturas: ventas (pago completo + split pay, el close rate de verdad) y
 * señas, cada una por llamada y por presentación. La matriz es la misma pieza que usa el
 * dashboard del closer (`MatrizCierres`) sobre el mismo bloque `cierres` del backend, y trae
 * arriba la tira de presentación (que lleva a la lista de las que presentaron, como antes).
 *
 * La cabecera lleva la leyenda de los dos colores con los conteos detrás de las tasas —cuántas
 * ventas, partidas en pago completo y split pay, y cuántas señas sin completar—, que es lo que
 * antes era "N de M llamadas".
 *
 * «No cerradas» abre un modal con cada lead y su objeción (`ModalNoCerradas`), que pide su lista
 * con `cargarNoCerradas` y desde el que se va a Revisar. Tocar un lead cierra el modal y abre su
 * ficha (`onAbrirFila`, la misma de Revisar); al cerrar la ficha se vuelve a la lista, que se pide
 * de nuevo por si en la ficha se cargó una objeción. Sin `cargarNoCerradas` el número va directo a
 * Revisar, como el resto de la tarjeta.
 */
const PanelCierre = ({ bloque, irA, cargarNoCerradas, onAbrirFila }) => {
    const [verNoCerradas, setVerNoCerradas] = useState(false);
    const c = bloque.cierres;
    // Sin llamadas de este período pero con cierres de llamadas anteriores, el panel se muestra igual.
    const vacio = !c || (bloque.asistieron === 0 && !c.reales?.base);
    const abrirLead = onAbrirFila ? (fila) => {
        setVerNoCerradas(false);
        onAbrirFila(fila, { alCerrar: () => setVerNoCerradas(true) });
    } : null;
    return (
        <Panel id="p-cierre" cab={
            <PanelCab titulo="Cierre"
                ayuda={'El close rate cuenta solo pagos completos y split pay: una seña es una reserva, '
                    + 'no una venta, y va en su propia fila. Cada tarjeta mide lo mismo contra las '
                    + 'llamadas con show up y contra las presentaciones. Abajo, las no cerradas: las '
                    + 'que asistieron y no terminaron ni en venta ni en seña.'}>
                {!vacio && <LeyendaCierres cierres={c} />}
            </PanelCab>
        }>
            {vacio
                ? <Vacio texto="Ninguna llamada del período tiene todavía un show up cargado." />
                : <MatrizCierres cierres={c} irA={irA} destinos={DESTINOS_CIERRES} Ayuda={Tip}
                    onVerNoCerradas={cargarNoCerradas ? () => setVerNoCerradas(true) : undefined} />}
            {verNoCerradas && cargarNoCerradas && (
                <ModalNoCerradas cargar={cargarNoCerradas} total={c?.no_cerradas?.num ?? null}
                    irA={irA} destino={DESTINOS_CIERRES.no_cerradas} onAbrir={abrirLead}
                    onCerrar={() => setVerNoCerradas(false)} />
            )}
        </Panel>
    );
};

const DEUDA = [
    {
        label: 'Vencido', campo: 'vencido', tone: 'error', destino: 'por_cobrar_vencido',
        help: 'Cuotas con vencimiento ya pasado y sin pagar. Plata que había que cobrar y no se cobró.',
    },
    {
        label: 'Por vencer', campo: 'por_vencer', tone: 'info', destino: 'por_cobrar_por_vencer',
        help: 'Cuotas con fecha futura. Cronograma normal, no es un problema.',
    },
    {
        label: 'Sin cronograma', campo: 'sin_plan', tone: 'warning', destino: 'por_cobrar_sin_plan',
        help: 'Saldo que no tiene ninguna cuota programada: no está vencido ni por vencer, '
            + 'directamente nadie le armó un plan de cobro.',
    },
];

/**
 * Lo cobrado del período y lo que falta cobrar.
 *
 * La referencia enfrenta "revenue firmado" con "cash collected", y ese revenue no existe:
 * `FinancialSale` guarda el monto de cada cobro, no el total del contrato, así que el "% de lo
 * firmado" habría que inventarlo. Lo que sí se puede afirmar son dos cosas distintas, y por eso
 * van separadas por una regla: arriba el cash del período abierto en fees y neto —eso cierra
 * exacto—, y abajo lo que falta cobrar A HOY, que es un saldo y no un flujo. De ahí que la
 * segunda mitad no tenga variación y no se mueva cuando cambiás el período.
 */
const PanelCash = ({ bloque, deltas, porCobrar, irA }) => {
    const [vista, setVista] = useState('tabla');
    const fees = Math.max(0, Math.round((bloque.cash - bloque.cash_neto) * 100) / 100);
    const filas = [
        {
            label: 'Cash collected', valor: bloque.cash, p: '100%', tone: 'success',
            destino: D.cash_collected,
            help: 'Todo lo que entró en el período: pagos completos, primeras cuotas, cuotas de '
                + 'ventas anteriores y señas.',
        },
        {
            label: 'Fees de pasarela', valor: fees, p: fmt.pct(tasa(fees, bloque.cash)), tone: 'warning',
            destino: D.fees,
            help: 'Lo que se quedó la pasarela de pago: la diferencia entre lo cobrado y lo neto.',
        },
        {
            label: 'Cash neto', valor: bloque.cash_neto, tone: 'info', destino: D.cash_neto,
            p: fmt.pct(tasa(bloque.cash_neto, bloque.cash)),
            help: 'Lo cobrado ya descontadas las fees. Es sobre esto que se calcula la comisión.',
        },
        {
            label: 'Ticket promedio', valor: bloque.ticket, p: '—', tone: 'brand-secondary',
            destino: D.ticket_promedio,
            help: `Lo cobrado en las ${bloque.ventas} ventas nuevas dividido por cuántas fueron. `
                + 'Las cuotas y las señas no entran.',
        },
    ];
    return (
        <Panel id="p-cash" cab={
            <PanelCab titulo="Cash"
                ayuda={'Arriba, el cash del período abierto en fees y neto. Abajo, lo que falta cobrar '
                    + 'a hoy: es el saldo de las inscripciones vivas, no una cifra del período, así que '
                    + 'no cambia cuando cambiás el filtro de fechas.'}>
                <Tabs valor={vista} onChange={setVista} ops={TABS_VISTA} aria="Vista de cash" />
                <Delta delta={deltas.cash} actual={fmt.money(bloque.cash)} />
            </PanelCab>
        }>
            {vista === 'grafico'
                ? (
                    <Torta total={bloque.cash} f={fmt.money} centro="cobrado"
                        items={[{ label: 'Cash neto', n: bloque.cash_neto, tone: 'success' },
                            { label: 'Fees de pasarela', n: fees, tone: 'warning' }]} />
                )
                : (
                    <div className="tdatos tdatos--montos">
                        <div className="tdatos-cab">
                            <span>Concepto</span><span>Monto</span><span>%</span><span />
                        </div>
                        {filas.map(f => (
                            <div key={f.label} className="tdatos-fila">
                                <span className="tdatos-nom">
                                    <span className="dato-punto" style={{ background: v(f.tone) }} />
                                    <span className="trunc">{f.label}</span>
                                </span>
                                <MetricaClicable irA={irA} destino={f.destino} vacio={!f.valor}
                                    detalle={`${f.label} · ${fmt.money(f.valor)}`}
                                    className="tdatos-n" style={{ color: v(f.tone) }}>
                                    {fmt.money(f.valor)}
                                </MetricaClicable>
                                <span className="tdatos-p">{f.p}</span>
                                <span><Tip texto={f.help} titulo={f.label} /></span>
                            </div>
                        ))}
                    </div>
                )}

            <Chispa dias={bloque.cash_por_dia} tone="brand-secondary"
                etiqueta={bloque.mejor_dia
                    ? `mejor día ${fmt.money(bloque.mejor_dia.cash)} · ${fmt.fecha(bloque.mejor_dia.dia)}`
                    : 'sin cobros en el período'} />

            {porCobrar && (
                <>
                    <hr className="sep" />
                    <div className="fila" style={{ marginBottom: 'var(--s3)' }}>
                        <span className="t-rotulo">Por cobrar · a hoy</span>
                        <Tip titulo="Por cobrar"
                            texto={'El saldo de las inscripciones vivas: el precio que negoció cada '
                                + 'cliente menos lo que ya pagó. No está acotado al período — es lo que '
                                + 'se debe hoy, sin fecha de corte — así que no lleva variación.'} />
                        <MetricaClicable irA={irA} destino={D.por_cobrar}
                            detalle={`Por cobrar a hoy · ${fmt.money(porCobrar.total)}`}
                            style={{ marginLeft: 'auto' }}>
                            <Cifra className="num" valor={fmt.money(porCobrar.total)}
                                style={{ fontSize: 19, fontWeight: 900 }} />
                        </MetricaClicable>
                    </div>
                    <div className="grid-sm pareja">
                        {DEUDA.map(x => (
                            <div key={x.label} className="ficha" style={{ '--c': v(x.tone) }}>
                                <span className="fila" style={{ gap: 5, alignItems: 'flex-start' }}>
                                    <span className="ficha-lbl">{x.label}</span>
                                    <Tip texto={x.help} titulo={x.label} />
                                </span>
                                <MetricaClicable irA={irA} destino={D[x.destino]} subrayar={false}
                                    vacio={!porCobrar[x.campo]}
                                    detalle={`${x.label} · ${fmt.money(porCobrar[x.campo])}`}>
                                    <Cifra className="ficha-n" valor={fmt.money(porCobrar[x.campo])} />
                                </MetricaClicable>
                            </div>
                        ))}
                    </div>
                    <p className="t-cap mut40" style={{ marginTop: 'var(--s3)' }}>
                        {fmt.plural(porCobrar.clientes, 'cliente', 'clientes')} con saldo
                        {porCobrar.clientes_vencido > 0
                            && `, ${porCobrar.clientes_vencido} con una cuota vencida`}.{' '}
                        <button type="button" className="t-cap num" onClick={abrir(irA, D.cash_collected)}
                            style={{
                                background: 'none', border: 0, padding: 0, cursor: 'pointer',
                                color: v('brand-secondary'), textDecoration: 'underline',
                            }}>
                            Ver los cobros del período
                        </button>
                    </p>
                </>
            )}
        </Panel>
    );
};

/** Payment types: la barra apilada arriba y una tarjeta por forma de pago. */
const PanelPagos = ({ bloque, irA }) => {
    const montado = useMontado();
    // Los tipos en cero no se dibujan. El color sigue al tipo (su posición en el vocabulario), no
    // a su lugar en la lista visible: así Renovación no cambia de color según qué otro falte.
    const tipos = bloque.payment_types.map((t, i) => ({ ...t, i })).filter(t => t.cash > 0 || t.ventas > 0);
    const total = tipos.reduce((a, t) => a + t.cash, 0);
    const cobros = tipos.reduce((a, t) => a + t.ventas, 0);
    // El `gap` de 2px entre segmentos se descuenta del ancho de cada uno, o la barra se pasa del
    // 100% y el último tramo queda cortado.
    const gapPer = ((tipos.length - 1) * 2) / tipos.length;
    return (
        <Panel cab={
            <PanelCab titulo="Payment types"
                ayuda={`De dónde vienen los ${fmt.money(total)} del período según la forma de pago. `
                    + 'Cada fila cuenta COBROS, no ventas: un Split Pay son dos cobros de la misma '
                    + 'venta, y los depósitos son señas que todavía no son una venta.'}>
                <span className="t-cap mut40 num">{fmt.plural(cobros, 'cobro', 'cobros')}</span>
            </PanelCab>
        }>
            {total === 0 ? <Vacio texto="Sin cobros en el período." /> : (
                <>
                    <div className="segmentada">
                        {tipos.map((t, k) => {
                            const w = (t.cash / total) * 100;
                            if (w <= 0) return null;
                            return (
                                <span key={t.key} title={`${t.label} · ${fmt.money(t.cash)}`}
                                    style={{
                                        width: montado ? `calc(${w}% - ${gapPer.toFixed(2)}px)` : 0,
                                        background: v(CAT[t.i]),
                                        transitionDelay: `${k * 90}ms`,
                                    }} />
                            );
                        })}
                    </div>
                    <div className="grid-pagos" data-n={tipos.length} style={{ marginTop: 'var(--s4)' }}>
                        {tipos.map((t, k) => (
                            <button key={t.key} type="button" className="ficha"
                                style={{ '--c': v(CAT[t.i]) }}
                                onClick={() => irA('ventas', { tipo_pago: t.label, __de: `Payment types: ${t.label}` })}>
                                <span className="fila" style={{ gap: 7 }}>
                                    <span className="dato-punto" style={{ background: v(CAT[t.i]) }} />
                                    <span className="ficha-lbl trunc" style={{ color: v('text-on-surface') }}>
                                        {t.label}
                                    </span>
                                </span>
                                <Cifra className="ficha-n" valor={fmt.money(t.cash)} />
                                <span className="t-cap mut40 num">
                                    {fmt.pct(tasa(t.cash, total))} · {fmt.plural(t.ventas, 'cobro', 'cobros')}
                                </span>
                                <Riel pct={(t.cash / total) * 100} color={v(CAT[t.i])} fino
                                    delay={150 + k * 90} />
                            </button>
                        ))}
                    </div>
                </>
            )}
        </Panel>
    );
};

/**
 * Ingresos por fuente (pedido del usuario, 09/10/2026): el Cash collected del período abierto por
 * el embudo que trajo cada cobro —workshop, setting, VSL, Fulfillment o sin procedencia—, en la
 * dirección comercial y en «Mis datos» del closer.
 *
 * Qué cobro va en qué fuente lo decide el backend con la MISMA atribución que Finanzas ›
 * Procedencia y la columna Fuente de las ventas (`comercial_analitica.ingresos_por_fuente`); acá
 * solo se dibuja. Llegan las cinco siempre, también en cero, y suman exacto el Cash collected del
 * mismo filtro: en bruto, como el número grande de la tarjeta (Finanzas reparte el neto). Se dibujan
 * las cinco salvo «Sin procedencia» en cero (pedido del usuario, 09/10/2026): un embudo en cero dice
 * que no trajo nada; que no haya cobros sin procedencia no hace falta decirlo.
 *
 * Las filas abren su detalle (el vivo y la grabación, cada setter…) en vez de mostrarlo siempre: con
 * todo abierto la tarjeta era el doble de alta que Payment types, su vecina.
 *
 * El MONTO de cada fila (y de cada renglón del detalle) lleva a Revisar › Ventas filtrado por esa
 * fuente, con el mismo período y la misma persona (ver `destinoProcedencia`): cada cobro de la tabla
 * trae la fuente con la que lo cuenta esta tarjeta, así que la lista son exactamente sus cobros y
 * la tira de totales dice su monto. Es el monto y no la fila entera porque tocar la fila abre el
 * detalle: el botón que lo abre se estira debajo de toda la fila (`.fuente-abrir`) y el monto y la
 * «i» quedan por encima. Un botón dentro de otro no se puede.
 */
const TABS_FUENTES = [['tabla', 'Tabla', Rows], ['grafico', 'Gráfico', PieChart]];

/**
 * "▲ 12%" chico, debajo del monto: el delta contra el período comparado, de una fuente o del total.
 * El del total va en su fila y no en la cabecera: es el mismo número que el de Cash collected, y en
 * la cabecera empujaba las pestañas a una segunda línea que Payment types, al lado, no tiene.
 */
const DeltaFuente = ({ delta, previo }) => {
    if (!delta) return null;
    const sube = delta.valor >= 0;
    return (
        <small className="fuente-delta num" style={{ color: v(sube ? 'success' : 'error') }}
            title={`${fmt.money(previo)} en el período comparado`}>
            {`${sube ? '▲' : '▼'} ${Math.abs(delta.valor)}%`}
        </small>
    );
};

const FilaFuente = ({ p, total, i, abierta, alternar, irA }) => {
    const ancho = total > 0 ? (p.monto / total) * 100 : 0;
    const conDetalle = p.detalle.length > 0;
    const destino = destinoProcedencia(p.label);
    return (
        <div className="tdatos-fila fuente" data-vacio={p.cantidad ? undefined : '1'}
            data-abierta={conDetalle && abierta ? '1' : undefined}>
            <span className="tdatos-nom tdatos-nom--fuerte">
                <span className="dato-punto" style={{ background: v(p.tone) }} />
                <span className="trunc" title={p.label}>{p.label}</span>
                <span className="solo-ancho"><Tip texto={AYUDA_PROCEDENCIA[p.key]} titulo={p.label} /></span>
            </span>
            <span className="tdatos-p">{fmt.num(p.cantidad)}</span>
            <MetricaClicable irA={irA} destino={destino} vacio={!p.cantidad}
                detalle={`${fmt.plural(p.cantidad, 'cobro', 'cobros')} de ${p.label}, ${fmt.money(p.monto)}`}
                className="tdatos-n" style={{ color: p.cantidad ? v(p.tone) : undefined }}>
                {fmt.money(p.monto)}
            </MetricaClicable>
            <span className="tdatos-p">{fmt.pct(p.pct)}</span>
            <span className="fuente-chev" aria-hidden="true">{conDetalle && <ChevronDown size={14} />}</span>
            <span className="fuente-riel">
                <Riel pct={ancho} color={v(p.tone)} fino delay={150 + i * 90} />
            </span>
            <DeltaFuente delta={p.delta} previo={p.previo} />
            {/* Último, para que las celdas sigan siendo los primeros hijos de la grilla: está
                fuera del flujo (absoluto, debajo de toda la fila). */}
            {conDetalle && (
                <button type="button" className="fuente-abrir" aria-expanded={abierta}
                    aria-label={`${p.label}: ${fmt.money(p.monto)}. ${abierta ? 'Cerrar' : 'Ver'} el detalle`}
                    onClick={alternar} />
            )}
        </div>
    );
};

const PanelFuentes = ({ fuentes, irA }) => {
    const [vista, setVista] = useState('tabla');
    // Una abierta por vez: con dos, la tarjeta vuelve a crecer lo que se ahorró al plegarlas.
    const [abierta, setAbierta] = useState(null);
    const { total, cantidad, procedencias } = fuentes;
    const filas = procedencias.filter(p => p.key !== 'sin_procedencia' || p.cantidad > 0 || p.monto !== 0);
    return (
        <Panel id="p-fuentes" cab={
            <PanelCab titulo="Ingresos por fuente"
                ayuda={'De dónde vino el Cash collected del período: el embudo que trajo cada cobro, según '
                    + 'la agenda que lo originó (la misma regla que la columna Fuente de las ventas y '
                    + 'Finanzas › Procedencia). Una cuota cuenta para el embudo de su venta. Suma '
                    + 'exacto el Cash collected, en bruto: Finanzas reparte lo mismo pero neto de la '
                    + 'fee de la pasarela.'}>
                <Tabs valor={vista} onChange={setVista} ops={TABS_FUENTES} aria="Vista de ingresos por fuente" />
            </PanelCab>
        }>
            {cantidad === 0 && <Vacio texto="Sin cobros en el período." />}

            {cantidad > 0 && vista === 'grafico' && (
                <Torta total={total} f={fmt.money} centro="cobrado"
                    items={procedencias.filter(p => p.monto > 0)
                        .map(p => ({ label: p.label, n: p.monto, tone: p.tone, pct: p.pct }))} />
            )}

            {cantidad > 0 && vista !== 'grafico' && (
                <div className="tdatos tdatos--fuentes">
                    <div className="tdatos-cab">
                        <span>Fuente</span>
                        {/* En el teléfono «Cobros» no entra en su columna: va abreviado. */}
                        <span title="Cobros"><span className="cab-largo">Cobros</span><span className="cab-corto">N.º</span></span>
                        <span>Monto</span><span>%</span><span />
                    </div>
                    {filas.map((p, i) => (
                        <React.Fragment key={p.key}>
                            <FilaFuente p={p} total={total} i={i} abierta={abierta === p.key} irA={irA}
                                alternar={() => setAbierta(a => (a === p.key ? null : p.key))} />
                            {abierta === p.key && p.detalle.map((d, j) => (
                                <div key={d.key} className="tdatos-fila fuente-sub" style={{ '--j': j }}>
                                    <span className="fuente-sub-nom trunc" title={d.label}>{d.label}</span>
                                    <span className="tdatos-p">{fmt.num(d.cantidad)}</span>
                                    <MetricaClicable irA={irA} destino={destinoProcedencia(p.label, d.label)}
                                        detalle={`${fmt.plural(d.cantidad, 'cobro', 'cobros')} de ${p.label} · `
                                            + `${d.label}, ${fmt.money(d.monto)}`}
                                        className="fuente-sub-n num">
                                        {fmt.money(d.monto)}
                                    </MetricaClicable>
                                    <span className="tdatos-p">{fmt.pct(d.pct)}</span>
                                    <span />
                                </div>
                            ))}
                        </React.Fragment>
                    ))}
                    <div className="tdatos-fila tdatos-total fuente-total">
                        <span className="tdatos-nom">
                            Total
                            <Tip titulo="Total"
                                texto={'Es el Cash collected de arriba, con el mismo filtro: los mismos cobros '
                                    + 'y el mismo monto bruto. Cada cobro cuenta una vez, en la fuente de su agenda.'} />
                        </span>
                        <span className="tdatos-p">{fmt.num(cantidad)}</span>
                        <MetricaClicable irA={irA} destino={DESTINO_PROCEDENCIAS_TOTAL} className="tdatos-n"
                            detalle={`${fmt.plural(cantidad, 'cobro', 'cobros')} del período, ${fmt.money(total)}`}>
                            {fmt.money(total)}
                        </MetricaClicable>
                        <span className="tdatos-p">{total > 0 ? '100%' : '—'}</span>
                        <span />
                        <DeltaFuente delta={fuentes.delta} previo={fuentes.previo} />
                    </div>
                </div>
            )}
        </Panel>
    );
};

/**
 * Programas. "Collected" es lo que cobró cada programa y con qué ticket; "Payments" abre esa
 * misma plata por forma de pago, con la cantidad de cobros debajo del monto.
 */
const PanelProgramas = ({ bloque, irA }) => {
    const [vista, setVista] = useState('tabla');
    const cols = bloque.payment_types.map((t, i) => ({ ...t, i }))
        .filter(t => t.cash > 0 || t.ventas > 0 || bloque.programas.some(p => p.por_tipo.some(x => x.key === t.key)));
    const totales = cols.map(c => bloque.programas.reduce((a, p) => {
        const seg = p.por_tipo.find(t => t.key === c.key);
        return [a[0] + (seg ? seg.ventas : 0), a[1] + (seg ? seg.cash : 0)];
    }, [0, 0]));
    const unidad = (key, n) => (key === 'seña'
        ? fmt.plural(n, 'seña', 'señas')
        : fmt.plural(n, 'cobro', 'cobros'));

    return (
        <Panel cab={
            <PanelCab titulo="Programas"
                ayuda={'Collected es lo que cobró cada programa y con qué ticket. Payments abre esa '
                    + 'misma plata por forma de pago: el monto grande y debajo cuántos cobros lo '
                    + 'componen, que no son lo mismo que las ventas.'}>
                <Tabs valor={vista} onChange={setVista} aria="Vista de programas"
                    ops={[['tabla', 'Collected', Rows], ['grafico', 'Payments', CreditCard]]} />
            </PanelCab>
        }>
            {bloque.programas.length === 0 && <Vacio texto="Sin cobros en el período." />}

            {bloque.programas.length > 0 && vista === 'grafico' && (
                <div className="tdatos tdatos--pagos" style={{ '--n': cols.length }}>
                    <div className="tdatos-cab">
                        <span>Programa</span>
                        {cols.map(c => (
                            <span key={c.key}>
                                <i className="cab-punto" style={{ background: v(CAT[c.i]) }} />{c.label}
                            </span>
                        ))}
                    </div>
                    {bloque.programas.map(p => (
                        <div key={p.programa} className="tdatos-fila">
                            <span className="tdatos-nom tdatos-nom--fuerte">
                                <i className="prog-marca" style={{ background: marcaPrograma(p.programa) }} />
                                <span className="trunc">{p.programa}</span>
                            </span>
                            {cols.map(c => {
                                const seg = p.por_tipo.find(t => t.key === c.key);
                                if (!seg) {
                                    return (
                                        <span key={c.key} className="cel-pago">
                                            <b className="cel-vacia">—</b>
                                        </span>
                                    );
                                }
                                const titulo = `${p.programa} · ${c.label} · ${unidad(c.key, seg.ventas)}`
                                    + ` · ${fmt.money(seg.cash)}`;
                                return (
                                    <button key={c.key} type="button" className="cel-pago" title={titulo}
                                        aria-label={titulo}
                                        onClick={() => irA('ventas', { programa: p.programa, tipo_pago: c.label,
                                            __de: `${p.programa}: ${c.label}` })}>
                                        <b className="num">{fmt.money(seg.cash)}</b>
                                        <span className="cel-cuenta num">{unidad(c.key, seg.ventas)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    ))}
                    <div className="tdatos-fila tdatos-total">
                        <span className="tdatos-nom">Total</span>
                        {totales.map((t, i) => (
                            <span key={cols[i].key} className="cel-pago">
                                <b className="num">{fmt.money(t[1])}</b>
                                <span className="cel-cuenta num">{unidad(cols[i].key, t[0])}</span>
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {bloque.programas.length > 0 && vista !== 'grafico' && (
                <div className="tdatos tdatos--prog">
                    <div className="tdatos-cab">
                        <span>Programa</span><span>Ventas</span><span>Ticket</span><span>Cash</span>
                    </div>
                    {bloque.programas.map(p => (
                        <button key={p.programa} type="button" className="tdatos-fila"
                            onClick={() => irA('ventas', { programa: p.programa, __de: `Programa: ${p.programa}` })}>
                            <span className="tdatos-nom tdatos-nom--fuerte">
                                <i className="prog-marca" style={{ background: marcaPrograma(p.programa) }} />
                                <span className="trunc">{p.programa}</span>
                                <span className="solo-ancho">
                                    <Tip titulo={p.programa}
                                        texto={`${fmt.plural(p.ventas, 'venta nueva', 'ventas nuevas')} y `
                                            + `${fmt.plural(p.cobros, 'cobro', 'cobros')} en el período. El `
                                            + 'ticket promedia solo lo cobrado en las ventas nuevas: las cuotas '
                                            + 'y las señas entran en el cash pero no en el ticket.'} />
                                </span>
                            </span>
                            <span className="tdatos-p" style={{ fontSize: 13 }}>{p.ventas}</span>
                            <span className="tdatos-p" style={{ fontSize: 13 }}>{fmt.money(p.ticket)}</span>
                            <span className="tdatos-n" style={{ color: marcaPrograma(p.programa) }}>
                                {fmt.money(p.cash)}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </Panel>
    );
};

/**
 * Señas: cuántas reservas se tomaron y cómo terminó cada una. Cantidad y porcentaje, sin cajas
 * de color: el color va en una regla fina arriba de cada número.
 */
const PanelSenas = ({ senas, irA }) => {
    const estados = [
        { label: 'Pago completo', n: senas.completo, tone: CAT[0], destino: D.senas_completo },
        { label: 'Pago parcial', n: senas.parcial, tone: CAT[1], destino: D.senas_parcial },
        { label: 'En espera', n: senas.espera, tone: CAT[2], destino: D.senas_espera },
        { label: 'Caída', n: senas.caida, tone: CAT[3], destino: D.senas_caida },
    ];
    const cifras = [
        {
            l: 'convirtió', valor: fmt.pct(senas.conversion), color: v('success'),
            destino: D.senas_convirtio,
            help: `${senas.completo + senas.parcial} de las ${senas.total} señas del período ya `
                + 'pasaron a pago completo o parcial.',
        },
        {
            l: 'cobrado', valor: fmt.money(senas.cobrado), color: v('text-on-surface'),
            destino: D.senas_cobrado,
            help: 'Cobrado sólo en concepto de seña. Ya está contado dentro del cash collected.',
        },
        {
            l: 'ticket', valor: fmt.money(senas.ticket), color: v('text-on-surface'),
            destino: D.senas_ticket,
            help: 'Monto promedio de cada seña.',
        },
        {
            l: 'desbloqueado', valor: fmt.money(senas.desbloqueado), color: v('text-on-surface'),
            destino: D.senas_desbloqueado,
            help: 'Cash cobrado en las ventas que arrancaron con una seña. Es el argumento para '
                + 'seguir pidiéndolas.',
        },
    ];
    return (
        <Panel humo={[v('cat-3'), v('brand-secondary'), v('brand-primary'), v('brand-navy')]} cab={
            <PanelCab titulo="Señas"
                ayuda={'Reservas con un pago inicial chico. Cada una bloquea un cupo hasta que se '
                    + 'completa el pago. Una seña no es una venta: lo que importa es en qué terminó. '
                    + 'Las cuotas y los depósitos van al cash, no a este conteo.'}>
                <MetricaClicable irA={irA} destino={D.senas_total} className="t-cap mut40 num"
                    detalle={`${fmt.plural(senas.total, 'seña', 'señas')} del período`}>
                    {fmt.plural(senas.total, 'seña', 'señas')}
                </MetricaClicable>
            </PanelCab>
        }>
            {senas.total === 0 ? <Vacio texto="Sin señas en el período." /> : (
                <>
                    <div className="grid-sm pareja">
                        {/* Sin drill-down, a diferencia del resto del tablero: estas celdas
                            cuentan SEÑAS según en qué terminaron después, y el único corte que la
                            tabla sabe hacer sobre las ventas es por tipo de pago. El clic en
                            "Pago completo" llevaba a las ventas de pago completo del período,
                            que son otras filas — el número de arriba y el de abajo nunca iban a
                            coincidir. El total sí es clickeable: son exactamente los depósitos. */}
                        {estados.map(e => (
                            <div key={e.label} className="sena-celda" style={{ '--c': v(e.tone) }}>
                                <span className="ficha-lbl" style={{ lineHeight: 1.3 }}>{e.label}</span>
                                <MetricaClicable irA={irA} destino={e.destino} subrayar={false}
                                    vacio={!e.n} className="sena-n"
                                    detalle={`${e.n} señas · ${e.label}`}>
                                    <Cifra tag="b" valor={String(e.n)} />
                                    <span>{`${Math.round((e.n / senas.total) * 100)}%`}</span>
                                </MetricaClicable>
                            </div>
                        ))}
                    </div>
                    <hr className="sep" />
                    <div className="grid-sm pareja">
                        {cifras.map(c => (
                            <div key={c.l} style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                                <span className="fila" style={{ gap: 5, alignItems: 'flex-start' }}>
                                    <span className="ficha-lbl" style={{ lineHeight: 1.3 }}>{c.l}</span>
                                    <Tip texto={c.help} titulo={c.l} />
                                </span>
                                <MetricaClicable irA={irA} destino={c.destino} subrayar={false}
                                    detalle={`Señas · ${c.l} ${c.valor}`}>
                                    <Cifra className="num" valor={c.valor}
                                        style={{
                                            fontSize: 22, lineHeight: 1, fontWeight: 900,
                                            letterSpacing: '-.025em', color: c.color,
                                        }} />
                                </MetricaClicable>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </Panel>
    );
};

/* ============================================================
   DASHBOARD · CLOSERS
   ============================================================ */

/**
 * El embudo se arma con el vocabulario de `destinos.js` y se dibuja en `Embudo`: `ayuda` es el
 * tooltip de la fila y `destino` el drill-down. Los pasos del medio se cortan con las facetas de
 * si/no de Revisar, que repiten el criterio con el que el backend cuenta cada paso: no hay ninguna
 * columna que los diga, son condiciones sobre la fila.
 */
const pasosDe = (funnel, vocabulario, irA) => funnel.map(p => {
    const def = vocabulario[p.paso] || {};
    return {
        paso: p.paso,
        n: p.n,
        ayuda: def.ayuda,
        ir: abrir(irA, def.destino),
        // Agendas: cuántas son vigentes y cuántas descartadas; la segunda cifra abre las descartadas.
        sub: p.descartadas != null ? `${p.vigentes} vigentes + ${p.descartadas} descartadas` : undefined,
        irSub: p.descartadas ? abrir(irA, def.destinoDescartadas) : undefined,
    };
});

const DashboardClosers = ({ bloque, deltas, porCobrar, fuentes, irA, cargarNoCerradas, onAbrirFila }) => (
    <>
        <div className="grid grid--4">
            <Tile label="Show up" valor={fmt.pct(bloque.show_up)} color={v('success')}
                help={'De los leads cuya llamada ya tuvo un resultado, qué porcentaje se presentó al menos '
                    + 'una vez (1ª y 2ª llamada juntas). Mide la calidad de la agenda y de la confirmación '
                    + 'previa, no el cierre. Las canceladas y las reagendadas no entran: esa llamada no ocurrió.'}
                delta={deltas.show_up}
                humo={[v('success'), v('info'), v('brand-primary'), v('success')]}
                cuenta={bloque.leads_realizadas !== undefined
                    ? { a: String(bloque.leads_asistieron), b: fmt.plural(bloque.leads_realizadas, 'lead', 'leads') }
                    : { a: String(bloque.asistieron), b: fmt.plural(bloque.realizadas, 'realizada', 'realizadas') }}
                ver={abrir(irA, D.show_up)} baja="p-estados" />
            {/* Los dos tiles de tasa llevan al NUMERADOR de su tasa, que es lo que se viene a
                buscar. La contradiccion que esto genera —arriba la tasa del tile, abajo la misma
                tasa al 100% porque el denominador quedo afuera del filtro— la explica el aviso de
                procedencia de la lista, que dice exactamente eso. Antes abrian el periodo entero
                sin filtrar para evitarla, y el precio era que el clic no llevaba a ningun lado. */}
            <Tile label="Close rate real" valor={fmt.pct(bloque.close_rate_real)} color={v('error')}
                help={'Cierres cobrados en el período sobre las oportunidades que se trabajaron: las '
                    + 'llamadas con show up más las llamadas de antes que cerraron ahora (una seña, un '
                    + 'seguimiento, una segunda llamada). Cuenta por cobro, así que una seña del mes '
                    + 'pasado que se paga hoy suma. El close rate por llamada, que mide solo las '
                    + 'llamadas de este período, está en el panel Cierre.'}
                delta={deltas.close_rate_real}
                humo={[v('error'), v('warning'), v('brand-primary'), v('error')]}
                cuenta={bloque.cierres?.reales ? { a: String(bloque.cierres.reales.cierres), b: `${bloque.cierres.reales.base} oportunidades` } : null}
                sub={bloque.cierres?.reales?.anteriores ? `${fmt.plural(bloque.cierres.reales.anteriores, 'de llamada anterior', 'de llamadas anteriores')}` : undefined}
                ver={abrir(irA, D.close_rate_real)} baja="p-cierre" />
            <Tile label="Cash collected · neto" valor={fmt.money(bloque.cash_neto)}
                help={'Dinero que entró en el período, descontadas las fees de la pasarela: pagos '
                    + 'completos, primeras cuotas, cuotas de ventas anteriores y señas. El bruto '
                    + '(antes de fees) se ve debajo.'}
                delta={deltas.cash_neto || deltas.cash}
                humo={[v('brand-secondary'), v('brand-primary'), v('brand-secondary-light'), v('brand-navy')]}
                sub={`bruto ${fmt.money(bloque.cash)} · comisión ${fmt.money(bloque.comision)}`}
                ver={abrir(irA, D.cash)} baja="p-cash" />
            <Tile label="Ticket promedio" valor={fmt.money(bloque.ticket)} color={v('info')}
                help={`Lo cobrado en las ${bloque.ventas} ventas nuevas dividido por cuántas fueron. `
                    + 'Las cuotas y las señas no entran.'}
                delta={deltas.ticket}
                humo={[v('info'), v('brand-primary'), v('info'), v('brand-navy')]}
                sub={fmt.plural(bloque.ventas, 'venta nueva', 'ventas nuevas')}
                ver={abrir(irA, D.ticket)} baja="p-cash" />
        </div>

        <div className="grid-2">
            <PanelEstados bloque={bloque} irA={irA} />
            <Embudo pasos={pasosDe(bloque.funnel, PASOS_CLOSER, irA)} sinFinal />
        </div>

        <div className="grid-2">
            <PanelCierre bloque={bloque} irA={irA} cargarNoCerradas={cargarNoCerradas}
                onAbrirFila={onAbrirFila} />
            <PanelCash bloque={bloque} deltas={deltas} porCobrar={porCobrar} irA={irA} />
        </div>

        {/* Las dos maneras de abrir el mismo cash: por forma de pago y por la fuente que lo trajo.
            Sin `fuentes` (un payload viejo en mano mientras llega el nuevo) Payment types vuelve a
            ocupar la fila entera, como antes. */}
        {fuentes ? (
            <div className="grid-2">
                <PanelPagos bloque={bloque} irA={irA} />
                <PanelFuentes fuentes={fuentes} irA={irA} />
            </div>
        ) : <PanelPagos bloque={bloque} irA={irA} />}

        <div className="grid-2">
            <PanelProgramas bloque={bloque} irA={irA} />
            <PanelSenas senas={bloque.senas} irA={irA} />
        </div>
    </>
);

/* ============================================================
   VISTA
   ============================================================ */

/**
 * `canal` / `onCanal`: la pestaña General · Anuncios · Inbound del tablero de setters, que vive en la
 * URL como el resto de los filtros (ver `DashboardComercial`). El de closers no la usa.
 */
const Analizar = ({ datos, rol, irA, cargarNoCerradas = null, onAbrirFila = null, canal = null, onCanal = null,
    fallo = false, onReintentar = null }) => {
    // El resumen que hay en mano puede ser todavía el del rol anterior: el `rol` de arriba cambia
    // en el momento y el fetch llega después. Dibujar el dashboard de closers con un payload de
    // setters no muestra números raros — revienta el árbol entero y deja la pantalla en blanco,
    // el mismo modo de falla que ya pasó con las tablas de Revisar. El payload dice de qué rol
    // es, así que se espera al que corresponde.
    if (!datos || datos.rol !== rol) {
        if (fallo) return <FalloCarga texto="No se pudo cargar el tablero" onReintentar={onReintentar} />;
        // Las pestañas de canal no dependen del dato: se ven (y se eligen) desde el principio.
        const pestanas = rol === 'setters' && onCanal ? (
            <div className="fila ds-vistas">
                <Segmented opciones={VISTAS_CANAL} valor={canal || 'general'} ariaLabel="Canal"
                    onChange={(k) => onCanal(k === 'general' ? null : k)} />
            </div>
        ) : null;
        return <EsqueletoAnalizar rol={rol} antes={pestanas} />;
    }
    const { actual, deltas } = datos;
    return rol === 'setters'
        ? <DashboardSetters bloque={actual} deltas={deltas} deltasCanales={datos.deltas_canales}
            comision={datos.comision} canal={canal} onCanal={onCanal} irA={irA} />
        : <DashboardClosers bloque={actual} deltas={deltas} porCobrar={datos.por_cobrar}
            fuentes={datos.fuentes} irA={irA} cargarNoCerradas={cargarNoCerradas}
            onAbrirFila={onAbrirFila} />;
};

export default Analizar;
