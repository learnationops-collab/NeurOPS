import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronsDown, CreditCard, Eye, PieChart, Rows } from 'lucide-react';
import Embudo from './Embudo';
import { Cargando, fmt, useMontado } from './Shared';

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

const v = (tono) => `var(--${tono})`;

/** Ícono "i" con la explicación de la métrica. Abre por CSS (`:hover` / `:focus-within`). */
const Tip = ({ texto, titulo, der }) => {
    if (!texto) return null;
    return (
        <span className={`tip${der ? ' tip--der' : ''}`} tabIndex={0} role="note"
            aria-label={titulo ? `${titulo}: ${texto}` : texto}>
            <span className="tip-dot" aria-hidden="true">i</span>
            <span className="tip-burbuja" aria-hidden="true">
                {titulo && <b>{titulo}</b>}{texto}
            </span>
        </span>
    );
};

/**
 * Variación contra el período comparado. El `title` lleva el valor actual, porque un porcentaje
 * suelto no dice nada: "▼ 25%" sobre qué.
 */
const Delta = ({ delta, actual }) => {
    if (!delta) return null;
    const sube = delta.valor >= 0;
    const n = Math.abs(delta.valor);
    const txt = `${sube ? '▲' : '▼'} ${delta.modo === 'pts' ? `${n} pts` : `${n}%`}`;
    return (
        <span className="delta" style={{ '--c': v(sube ? 'success' : 'error') }}
            title={`${actual ? `${actual} · ` : ''}${txt} vs. el período comparado`}>
            {txt}
        </span>
    );
};

/** Aura de color del fondo de una tarjeta. Decorativa: cuatro manchas, ningún dato adentro. */
const Humo = ({ clase, colores }) => (
    <span className={`humo${clase ? ` ${clase}` : ''}`} aria-hidden="true"
        style={Object.fromEntries((colores || []).map((c, i) => [`--h${i + 1}`, c]))}>
        <i /><i /><i /><i />
    </span>
);

/** Barra fina. Crece de 0 al montar, que es la animación que define el CSS (`.riel > i`). */
const Riel = ({ pct, color, fino, delay }) => {
    const montado = useMontado();
    return (
        <span className={`riel${fino ? ' riel--fino' : ''}`}>
            <i style={{
                width: montado ? `${Math.max(0, Math.min(100, pct || 0))}%` : 0,
                background: color,
                transitionDelay: delay ? `${delay}ms` : undefined,
            }} />
        </span>
    );
};

const QUIETO = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;
const PARTES = /^([^0-9-]*)(-?[\d,]+(?:\.\d+)?)(.*)$/;

/**
 * Cifra que sube hasta su valor conservando prefijo, separador de miles y decimales.
 *
 * Anima el TEXTO ya formateado y no el número: así "$7,108", "63.2%" y "—" pasan por la misma
 * pieza sin que el formato tenga una segunda copia acá. El conteo se escribe en el nodo desde el
 * efecto en vez de por estado porque son unos cincuenta cuadros por cifra y veinte cifras en
 * pantalla: re-renderizar el árbol mil veces para animar un texto no se paga.
 */
const Cifra = ({ valor, className, style, tag: Tag = 'span' }) => {
    const ref = useRef(null);
    useEffect(() => {
        const el = ref.current;
        const destino = String(valor);
        if (!el || QUIETO) return undefined;
        const m = PARTES.exec(destino);
        if (!m) return undefined;
        const crudo = m[2].replace(/,/g, '');
        const fin = parseFloat(crudo);
        if (!Number.isFinite(fin)) return undefined;
        const dec = (crudo.split('.')[1] || '').length;
        const miles = m[2].includes(',');
        let id = 0;
        let t0 = 0;
        const paso = (t) => {
            if (!t0) t0 = t;
            const k = Math.min((t - t0) / 820, 1);
            const x = fin * (1 - (1 - k) ** 3);
            let txt = dec ? x.toFixed(dec) : String(Math.round(x));
            if (miles) {
                txt = Number(txt).toLocaleString('en-US',
                    { minimumFractionDigits: dec, maximumFractionDigits: dec });
            }
            el.textContent = m[1] + txt + m[3];
            if (k < 1) id = requestAnimationFrame(paso);
            else el.textContent = destino;
        };
        id = requestAnimationFrame(paso);
        return () => cancelAnimationFrame(id);
    }, [valor]);
    return <Tag ref={ref} className={className} style={style}>{valor}</Tag>;
};

const PanelCab = ({ titulo, ayuda, children }) => (
    <div className="panel-cab">
        <h2 className="t-h3">{titulo}</h2>
        <Tip texto={ayuda} titulo={titulo} />
        {children && <div className="panel-cab-der">{children}</div>}
    </div>
);

const Panel = ({ id, humo, cab, children }) => (
    <section className={`panel${humo ? ' caja' : ''}`} id={id}>
        {humo && <Humo clase="humo--tarjeta" colores={humo} />}
        {cab}
        {children}
    </section>
);

/** Un par de pastillas que eligen cómo se mira el mismo dato. */
const Tabs = ({ valor, onChange, ops, aria }) => (
    <div className="tabs" role="tablist" aria-label={aria}>
        {ops.map(([key, label, Icono]) => (
            <button key={key} type="button" className="tab tab--sm" role="tab"
                aria-selected={valor === key} onClick={() => onChange(key)}>
                <Icono size={13} />{label}
            </button>
        ))}
    </div>
);

const TABS_VISTA = [['tabla', 'Tabla', Rows], ['grafico', 'Gráfico', PieChart]];

/** Baja al panel que desglosa un tile y lo hace parpadear una vez para ubicarte. */
const bajarA = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('destacado');
    // Reflow forzado: sin esto, volver a agregar la clase en el mismo cuadro no reinicia la
    // animación y el segundo click no destaca nada.
    void el.offsetWidth;
    el.classList.add('destacado');
};

/**
 * Tile de vista rápida: un número, su lectura en chico y dos accesos — el ojo lleva al dato
 * crudo en Revisar, el otro baja al panel que lo desglosa.
 */
const Tile = ({ label, help, valor, color, sub, delta, humo, ver, baja }) => (
    <section className="kpi caja">
        <Humo colores={humo} />
        <div className="kpi-cab">
            <p className="t-eyebrow">{label}</p>
            <Tip texto={help} titulo={label} />
            {delta && <span style={{ marginLeft: 'auto' }}><Delta delta={delta} actual={valor} /></span>}
        </div>
        <div className="kpi-cifra">
            <Cifra tag="p" className="kpi-n" valor={valor}
                style={{ color: color || v('text-on-surface') }} />
            {sub && <p className="kpi-sub num">{sub}</p>}
        </div>
        {(ver || baja) && (
            <div className="kpi-acciones">
                {ver && (
                    <button type="button" className="kpi-acc kpi-acc--solo" onClick={ver}
                        title="Ver los registros en Revisar" aria-label="Ver los registros en Revisar">
                        <Eye size={14} />
                    </button>
                )}
                {baja && (
                    <button type="button" className="kpi-acc kpi-acc--solo" onClick={() => bajarA(baja)}
                        title="Profundizar: bajar al desglose" aria-label="Profundizar: bajar al desglose">
                        <ChevronsDown size={14} />
                    </button>
                )}
            </div>
        )}
    </section>
);

/**
 * Barra gruesa: el conteo entra dentro de la barra si hay lugar, y el botón de la derecha lleva
 * a ese mismo corte en Revisar. Es la pieza de los paneles que muestran una tasa sola.
 */
const Gruesa = ({ label, cuenta, help, pct, tone, w, ir, i = 0 }) => {
    const montado = useMontado();
    const color = v(tone);
    const dentro = (w || 0) >= 22 && cuenta;
    return (
        <div className="gruesa-fila">
            <div className="gruesa-cab">
                <span className="t-rotulo">{label}</span>
                <Tip texto={help} titulo={label} />
            </div>
            <div className="gruesa">
                <span className="gruesa-pista">
                    <i style={{
                        width: montado ? `${Math.max(0, Math.min(100, w || 0))}%` : 0,
                        background: color,
                        transitionDelay: `${140 + i * 120}ms`,
                    }} />
                    {cuenta && (
                        <span className="gruesa-txt" style={dentro
                            ? { marginLeft: 14, marginRight: 'auto', color: v('on-state') }
                            : { marginLeft: 'auto', paddingRight: 14, color: v('text-on-surface') }}>
                            {cuenta}
                        </span>
                    )}
                </span>
                <span className={`gruesa-pct${String(pct).length > 6 ? ' gruesa-pct--larga' : ''}`}
                    style={{ color }}>{pct}</span>
                {ir && (
                    <button type="button" className="ir-btn" style={{ '--c': color }} onClick={ir}
                        aria-label={`Ver ${label.toLowerCase()} en Revisar`}>
                        <ArrowRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

/** Torta: cada ítem como un arco, el total al medio. */
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
                                    {`${it.label} · ${f(it.n)}${total ? ` · ${p.toFixed(1)}%` : ''}`}
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
                            <span className="tl-p">{total ? `${((it.n / total) * 100).toFixed(1)}%` : '—'}</span>
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

/** El mismo reparto como tabla o como torta. `items`: {label, n, tone, ir?}. */
const Reparto = ({ vista, items, total, f = String, colLabel = 'Estado', centro = 'total' }) => {
    if (vista === 'grafico') return <Torta items={items} total={total} f={f} centro={centro} />;
    return (
        <div className="tdatos">
            <div className="tdatos-cab"><span>{colLabel}</span><span>Cant.</span><span>%</span></div>
            {items.map(it => {
                const cuerpo = (
                    <>
                        <span className="tdatos-nom">
                            <span className="dato-punto" style={{ background: v(it.tone) }} />
                            <span className="trunc">{it.label}</span>
                        </span>
                        <span className="tdatos-n" style={{ color: v(it.tone) }}>{f(it.n)}</span>
                        <span className="tdatos-p">{total ? `${((it.n / total) * 100).toFixed(1)}%` : '—'}</span>
                    </>
                );
                return it.ir
                    ? <button key={it.label} type="button" className="tdatos-fila" onClick={it.ir}>{cuerpo}</button>
                    : <div key={it.label} className="tdatos-fila">{cuerpo}</div>;
            })}
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

const Vacio = ({ texto }) => <p className="t-cap mut40">{texto}</p>;

/* ============================================================
   VOCABULARIO DE COLOR
   ============================================================ */

/**
 * Las formas de pago van en la paleta categórica (`--cat-1..4`) y no en los tonos de estado que
 * manda el backend: un Split Pay no es "info" ni una cuota es "idle" — son identidades, no
 * estados. El orden es el de `TIPOS_PAGO`, que es el mismo en el que llega `payment_types`.
 */
const CAT = ['cat-1', 'cat-2', 'cat-3', 'cat-4'];

const marcaPrograma = (programa) => {
    if (programa === 'Residency Roadmap') return v('prog-elite-b');
    if (programa === 'Sin programa') return v('prog-free');
    return v('prog-ace');
};

/** Tasa que devuelve null —y por lo tanto "—"— cuando no hay denominador. */
const tasa = (num, den) => (den ? Number(((num / den) * 100).toFixed(1)) : null);

/** Color de la rampa del embudo para el ítem `i` de `n`: mismo degradado que la referencia. */
const rampa = (i, n) =>
    `color-mix(in oklab, var(--ramp-b) ${Math.round((i / Math.max(n - 1, 1)) * 100)}%, var(--ramp-a))`;

/* ============================================================
   PANELES · CLOSERS
   ============================================================ */

/** Qué pasó con cada cita del período. El total va una sola vez, en la cabecera. */
const PanelEstados = ({ bloque, irA }) => {
    const [vista, setVista] = useState('tabla');
    const total = bloque.agendas;
    const sinReporte = bloque.estados.find(e => e.key === 'sin_reporte');
    return (
        <Panel id="p-estados" cab={
            <PanelCab titulo="Estados"
                ayuda={`Qué pasó con cada una de las ${total} citas agendadas del período. "Sin `
                    + 'reporte" son las que ya pasaron y nadie cargó: hasta que no se carguen, el show '
                    + 'up está medido sobre menos llamadas de las que hubo.'}>
                <Tabs valor={vista} onChange={setVista} ops={TABS_VISTA} aria="Vista de estados" />
                <span className="t-cap mut40 num">{fmt.plural(total, 'agenda', 'agendas')}</span>
            </PanelCab>
        }>
            {total === 0 ? <Vacio texto="Sin agendas en el período." /> : (
                <>
                    <Reparto vista={vista} total={total} centro="agendas"
                        items={bloque.estados.map(e => ({
                            label: e.label, n: e.n, tone: e.tone,
                            ir: () => irA('agendas', { estado: e.filtro }),
                        }))} />
                    {sinReporte && (
                        <p className="t-cap mut40" style={{ marginTop: 'var(--s3)' }}>
                            {fmt.plural(sinReporte.n, 'llamada', 'llamadas')} ya pasaron sin resultado
                            cargado: mientras sigan así, el show up y el close rate están medidos de menos.
                        </p>
                    )}
                </>
            )}
        </Panel>
    );
};

/**
 * Las tasas que explican el cierre: la misma cantidad de ventas medida contra tres puntos. La
 * diferencia entre las dos últimas dice cuánto se pierde antes de mostrar la oferta.
 */
const PanelCierre = ({ bloque }) => {
    const filas = [
        {
            label: 'Presentación', cant: bloque.presentaciones, base: bloque.asistieron,
            n: bloque.presentacion_rate, tone: 'info',
            help: `De las ${bloque.asistieron} llamadas con show up, en ${bloque.presentaciones} se `
                + 'llegó a presentar la oferta. Las otras se cortaron antes.',
        },
        {
            label: 'Cierre por llamada', cant: bloque.cerradas, base: bloque.asistieron,
            n: bloque.close_rate, tone: 'error',
            help: 'Ventas sobre todas las llamadas a las que el cliente se presentó. Es la medida '
                + 'central del cierre.',
        },
        {
            label: 'Cierre por presentación', cant: bloque.cerradas, base: bloque.presentaciones,
            n: bloque.close_presentacion, tone: 'warning',
            help: 'Ventas sobre las llamadas donde además se llegó a presentar la oferta. Saca del '
                + 'denominador a las que nunca vieron el precio.',
        },
    ];
    return (
        <Panel id="p-cierre" cab={
            <PanelCab titulo="Cierre"
                ayuda={'La misma cantidad de ventas medida contra tres puntos distintos. La diferencia '
                    + 'entre las dos últimas dice cuánto se pierde antes de mostrar la oferta.'}>
                <span className="t-cap mut40 num">
                    {bloque.cerradas} de {fmt.plural(bloque.asistieron, 'llamada', 'llamadas')}
                </span>
            </PanelCab>
        }>
            {bloque.asistieron === 0
                ? <Vacio texto="Ninguna llamada del período tiene todavía un show up cargado." />
                : (
                    <div className="tdatos tdatos--tasas">
                        <div className="tdatos-cab">
                            <span>Tasa</span><span>Cant.</span><span>%</span><span />
                        </div>
                        {filas.map(f => (
                            <div key={f.label} className="tdatos-fila">
                                <span className="tdatos-nom">
                                    <span className="dato-punto" style={{ background: v(f.tone) }} />
                                    <span className="trunc">{f.label}</span>
                                </span>
                                <span className="tdatos-p" style={{ fontSize: 13 }}>
                                    {f.cant}<span style={{ opacity: .6 }}>/{f.base}</span>
                                </span>
                                <span className="tdatos-n" style={{ color: v(f.tone) }}>{fmt.pct(f.n)}</span>
                                <span><Tip der texto={f.help} titulo={f.label} /></span>
                            </div>
                        ))}
                    </div>
                )}
        </Panel>
    );
};

const DEUDA = [
    {
        label: 'Vencido', campo: 'vencido', tone: 'error',
        help: 'Cuotas con vencimiento ya pasado y sin pagar. Plata que había que cobrar y no se cobró.',
    },
    {
        label: 'Por vencer', campo: 'por_vencer', tone: 'info',
        help: 'Cuotas con fecha futura. Cronograma normal, no es un problema.',
    },
    {
        label: 'Sin cronograma', campo: 'sin_plan', tone: 'warning',
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
            help: 'Todo lo que entró en el período: pagos completos, primeras cuotas, cuotas de '
                + 'ventas anteriores y señas.',
        },
        {
            label: 'Fees de pasarela', valor: fees, p: fmt.pct(tasa(fees, bloque.cash)), tone: 'warning',
            help: 'Lo que se quedó la pasarela de pago: la diferencia entre lo cobrado y lo neto.',
        },
        {
            label: 'Cash neto', valor: bloque.cash_neto, tone: 'info',
            p: fmt.pct(tasa(bloque.cash_neto, bloque.cash)),
            help: 'Lo cobrado ya descontadas las fees. Es sobre esto que se calcula la comisión.',
        },
        {
            label: 'Ticket promedio', valor: bloque.ticket, p: '—', tone: 'brand-secondary',
            help: `Cash del período dividido por las ${bloque.ventas} ventas nuevas. No mira el `
                + 'contrato firmado: mira cuánta plata entró por cada venta.',
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
                                <span className="tdatos-n" style={{ color: v(f.tone) }}>{fmt.money(f.valor)}</span>
                                <span className="tdatos-p">{f.p}</span>
                                <span><Tip der texto={f.help} titulo={f.label} /></span>
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
                        <Cifra className="num" valor={fmt.money(porCobrar.total)}
                            style={{ marginLeft: 'auto', fontSize: 19, fontWeight: 900 }} />
                    </div>
                    <div className="grid-sm">
                        {DEUDA.map(x => (
                            <div key={x.label} className="ficha" style={{ '--c': v(x.tone) }}>
                                <span className="fila" style={{ gap: 5, alignItems: 'flex-start' }}>
                                    <span className="ficha-lbl">{x.label}</span>
                                    <Tip der texto={x.help} titulo={x.label} />
                                </span>
                                <Cifra className="ficha-n" valor={fmt.money(porCobrar[x.campo])} />
                            </div>
                        ))}
                    </div>
                    <p className="t-cap mut40" style={{ marginTop: 'var(--s3)' }}>
                        {fmt.plural(porCobrar.clientes, 'cliente', 'clientes')} con saldo
                        {porCobrar.clientes_vencido > 0
                            && `, ${porCobrar.clientes_vencido} con una cuota vencida`}.{' '}
                        <button type="button" className="t-cap num" onClick={() => irA('ventas', {})}
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
    const total = bloque.payment_types.reduce((a, t) => a + t.cash, 0);
    const cobros = bloque.payment_types.reduce((a, t) => a + t.ventas, 0);
    // El `gap` de 2px entre segmentos se descuenta del ancho de cada uno, o la barra se pasa del
    // 100% y el último tramo queda cortado.
    const gapPer = ((bloque.payment_types.length - 1) * 2) / bloque.payment_types.length;
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
                        {bloque.payment_types.map((t, i) => {
                            const w = (t.cash / total) * 100;
                            if (w <= 0) return null;
                            return (
                                <span key={t.key} title={`${t.label} · ${fmt.money(t.cash)}`}
                                    style={{
                                        width: montado ? `calc(${w}% - ${gapPer.toFixed(2)}px)` : 0,
                                        background: v(CAT[i]),
                                        transitionDelay: `${i * 90}ms`,
                                    }} />
                            );
                        })}
                    </div>
                    <div className="grid-sm" style={{ marginTop: 'var(--s4)' }}>
                        {bloque.payment_types.map((t, i) => (
                            <button key={t.key} type="button" className="ficha"
                                style={{ '--c': v(CAT[i]) }}
                                onClick={() => irA('ventas', { tipo_pago: t.label })}>
                                <span className="fila" style={{ gap: 7 }}>
                                    <span className="dato-punto" style={{ background: v(CAT[i]) }} />
                                    <span className="ficha-lbl trunc" style={{ color: v('text-on-surface') }}>
                                        {t.label}
                                    </span>
                                </span>
                                <Cifra className="ficha-n" valor={fmt.money(t.cash)} />
                                <span className="t-cap mut40 num">
                                    {fmt.pct(tasa(t.cash, total))} · {fmt.plural(t.ventas, 'cobro', 'cobros')}
                                </span>
                                <Riel pct={(t.cash / total) * 100} color={v(CAT[i])} fino
                                    delay={150 + i * 90} />
                            </button>
                        ))}
                    </div>
                </>
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
    const cols = bloque.payment_types;
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
                <div className="tdatos tdatos--pagos">
                    <div className="tdatos-cab">
                        <span>Programa</span>
                        {cols.map((c, i) => (
                            <span key={c.key}>
                                <i className="cab-punto" style={{ background: v(CAT[i]) }} />{c.label}
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
                                        onClick={() => irA('ventas', { programa: p.programa, tipo_pago: c.label })}>
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
                            onClick={() => irA('ventas', { programa: p.programa })}>
                            <span className="tdatos-nom tdatos-nom--fuerte">
                                <i className="prog-marca" style={{ background: marcaPrograma(p.programa) }} />
                                <span className="trunc">{p.programa}</span>
                                <span className="solo-ancho">
                                    <Tip titulo={p.programa}
                                        texto={`${fmt.plural(p.ventas, 'venta nueva', 'ventas nuevas')} y `
                                            + `${fmt.plural(p.cobros, 'cobro', 'cobros')} en el período. El `
                                            + 'ticket se calcula sobre las ventas y no sobre los cobros: las '
                                            + 'cuotas y las señas entran en el cash sin abrir una venta nueva.'} />
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
        { label: 'Pago completo', n: senas.completo, tone: CAT[0] },
        { label: 'Pago parcial', n: senas.parcial, tone: CAT[1] },
        { label: 'En espera', n: senas.espera, tone: CAT[2] },
        { label: 'Caída', n: senas.caida, tone: CAT[3] },
    ];
    const cifras = [
        {
            l: 'convirtió', valor: fmt.pct(senas.conversion), color: v('success'),
            help: `${senas.completo + senas.parcial} de las ${senas.total} señas del período ya `
                + 'pasaron a pago completo o parcial.',
        },
        {
            l: 'cobrado', valor: fmt.money(senas.cobrado), color: v('text-on-surface'),
            help: 'Cobrado sólo en concepto de seña. Ya está contado dentro del cash collected.',
        },
        {
            l: 'ticket', valor: fmt.money(senas.ticket), color: v('text-on-surface'),
            help: 'Monto promedio de cada seña.',
        },
        {
            l: 'desbloqueado', valor: fmt.money(senas.desbloqueado), color: v('text-on-surface'),
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
                <button type="button" className="t-cap mut40 num"
                    style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer' }}
                    onClick={() => irA('ventas', { tipo_pago: 'Depósitos' })}>
                    {fmt.plural(senas.total, 'seña', 'señas')}
                </button>
            </PanelCab>
        }>
            {senas.total === 0 ? <Vacio texto="Sin señas en el período." /> : (
                <>
                    <div className="grid-sm">
                        {/* Sin drill-down, a diferencia del resto del tablero: estas celdas
                            cuentan SEÑAS según en qué terminaron después, y el único corte que la
                            tabla sabe hacer sobre las ventas es por tipo de pago. El clic en
                            "Pago completo" llevaba a las ventas de pago completo del período,
                            que son otras filas — el número de arriba y el de abajo nunca iban a
                            coincidir. El total sí es clickeable: son exactamente los depósitos. */}
                        {estados.map(e => (
                            <div key={e.label} className="sena-celda" style={{ '--c': v(e.tone) }}>
                                <span className="ficha-lbl" style={{ lineHeight: 1.3 }}>{e.label}</span>
                                <span className="sena-n">
                                    <Cifra tag="b" valor={String(e.n)} />
                                    <span>{`${Math.round((e.n / senas.total) * 100)}%`}</span>
                                </span>
                            </div>
                        ))}
                    </div>
                    <hr className="sep" />
                    <div className="grid-sm">
                        {cifras.map(c => (
                            <div key={c.l} style={{ display: 'grid', gap: 5, minWidth: 0 }}>
                                <span className="fila" style={{ gap: 5, alignItems: 'flex-start' }}>
                                    <span className="ficha-lbl" style={{ lineHeight: 1.3 }}>{c.l}</span>
                                    <Tip der texto={c.help} titulo={c.l} />
                                </span>
                                <Cifra className="num" valor={c.valor}
                                    style={{
                                        fontSize: 22, lineHeight: 1, fontWeight: 900,
                                        letterSpacing: '-.025em', color: c.color,
                                    }} />
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
 * El embudo se arma acá y se dibuja en `Embudo`: `ayuda` es el tooltip de la fila y `ir` el
 * drill-down. Los tres pasos del medio se cortan con las facetas de sí/no de Revisar, que
 * repiten el criterio con el que el backend cuenta cada paso (ver `fueConfirmada`, `asistio` y
 * `presento` en Revisar.jsx): no hay ninguna columna que los diga, son condiciones sobre la fila.
 */
const EMBUDO_CLOSER = {
    Agendas: {
        ayuda: 'Llamadas agendadas en el período, sin importar la fuente.',
        ir: ['agendas', {}],
    },
    Confirmadas: {
        ayuda: 'Confirmaron asistencia antes de la llamada.',
        ir: ['agendas', { confirmada: 'Sí' }],
    },
    Asistieron: {
        ayuda: 'La llamada ocurrió y el lead estaba del otro lado.',
        ir: ['agendas', { asistio: 'Sí' }],
    },
    Presentaciones: {
        ayuda: 'Llamadas donde además se llegó a presentar la oferta.',
        ir: ['agendas', { presento: 'Sí' }],
    },
    Ventas: {
        ayuda: 'Cierres del período. Cuenta agendas y no cobros: dos cuotas del mismo lead salen '
            + 'de una sola llamada.',
        ir: ['agendas', { post_call: 'Venta' }],
    },
};

const EMBUDO_SETTER = {
    Entrantes: {
        ayuda: 'Leads nuevos que entraron al inbox en el período. Es el denominador de todo lo demás.',
        ir: ['leads', {}],
    },
    Respondieron: {
        ayuda: 'Contestaron al menos un mensaje.',
        ir: ['leads', { respondio: 'Sí' }],
    },
    Cualificados: {
        ayuda: 'Cumplen el perfil del programa. Ojo: se mide sobre los que respondieron.',
        ir: ['leads', { cualificado: 'Sí' }],
    },
    Agendaron: {
        ayuda: 'Reservaron horario en el calendario de un closer.',
        // Los LEADS que agendaron, no la tabla de agendas generadas: el paso cuenta leads del
        // período que llegaron a reservar (45), y esa otra tabla son las citas del período mirándolo
        // al revés (169). El clic mostraba 169 filas debajo de un 45.
        ir: ['leads', { estado: 'Agendó' }],
    },
};

const pasosDe = (funnel, vocabulario, irA) => funnel.map(p => {
    const def = vocabulario[p.paso] || {};
    return {
        paso: p.paso,
        n: p.n,
        ayuda: def.ayuda,
        ir: def.ir ? () => irA(...def.ir) : undefined,
    };
});

const DashboardClosers = ({ bloque, deltas, porCobrar, irA }) => (
    <>
        <div className="grid grid--4">
            <Tile label="Show up" valor={fmt.pct(bloque.show_up)} color={v('success')}
                help={'De las llamadas que ya tuvieron un resultado, qué porcentaje se presentó. Mide '
                    + 'la calidad de la agenda y de la confirmación previa, no el cierre. Las canceladas '
                    + 'y las reagendadas no entran: esa llamada no ocurrió.'}
                delta={deltas.show_up}
                humo={[v('success'), v('info'), v('brand-primary'), v('success')]}
                sub={`${bloque.asistieron} de ${fmt.plural(bloque.realizadas, 'realizada', 'realizadas')}`}
                ver={() => irA('agendas', {})} baja="p-estados" />
            {/* Los dos tiles de tasa abren Revisar SIN filtrar: la tira de totales repite sus
                cifras tal cual ("28.1% close rate · 16 de 57 cerraron"). Filtrando Close rate por
                Venta se veían las 16 cerradas, pero arriba la tasa pasaba a 100% y contradecía al
                tile del que se venía; para ver solo esas 16 está el panel Estados. */}
            <Tile label="Close rate" valor={fmt.pct(bloque.close_rate)} color={v('error')}
                help={'Ventas sobre las llamadas a las que el cliente se presentó. Se cuenta sobre las '
                    + 'llamadas y no sobre las ventas del período: una venta puede no tener agenda en '
                    + 'estos días, y una llamada de estos días puede cerrar más tarde.'}
                delta={deltas.close_rate}
                humo={[v('error'), v('warning'), v('brand-primary'), v('error')]}
                sub={`${bloque.cerradas} de ${fmt.plural(bloque.asistieron, 'llamada', 'llamadas')}`}
                ver={() => irA('agendas', {})} baja="p-cierre" />
            <Tile label="Cash collected" valor={fmt.money(bloque.cash)}
                help={'Dinero que entró en el período: pagos completos, primeras cuotas, cuotas de '
                    + 'ventas anteriores y señas.'}
                delta={deltas.cash}
                humo={[v('brand-secondary'), v('brand-primary'), v('brand-secondary-light'), v('brand-navy')]}
                sub={`neto ${fmt.money(bloque.cash_neto)} · comisión ${fmt.money(bloque.comision)}`}
                ver={() => irA('ventas', {})} baja="p-cash" />
            <Tile label="Ticket promedio" valor={fmt.money(bloque.ticket)} color={v('info')}
                help={`Cash del período dividido por las ${bloque.ventas} ventas nuevas. No mira el `
                    + 'contrato firmado: mira cuánta plata entró por cada venta.'}
                delta={deltas.ticket}
                humo={[v('info'), v('brand-primary'), v('info'), v('brand-navy')]}
                sub={fmt.plural(bloque.ventas, 'venta nueva', 'ventas nuevas')}
                ver={() => irA('ventas', {})} baja="p-cash" />
        </div>

        <div className="grid-2">
            <PanelEstados bloque={bloque} irA={irA} />
            <Embudo pasos={pasosDe(bloque.funnel, EMBUDO_CLOSER, irA)} />
        </div>

        <div className="grid-2">
            <PanelCierre bloque={bloque} />
            <PanelCash bloque={bloque} deltas={deltas} porCobrar={porCobrar} irA={irA} />
        </div>

        <PanelPagos bloque={bloque} irA={irA} />

        <div className="grid-2">
            <PanelProgramas bloque={bloque} irA={irA} />
            <PanelSenas senas={bloque.senas} irA={irA} />
        </div>
    </>
);

/* ============================================================
   DASHBOARD · SETTERS
   ============================================================ */

const DashboardSetters = ({ bloque, deltas, irA }) => {
    const cualifEnt = tasa(bloque.cualificados, bloque.leads);
    const convOpen = tasa(bloque.agendas, bloque.respondieron);
    const convCualif = tasa(bloque.agendas, bloque.cualificados);
    // Denominador de la tenacidad: los leads que recibieron al menos un mensaje. No son los
    // entrantes —un lead al que nadie escribió no tiene toques que contar— ni los que
    // respondieron: el seguimiento se mide por lo que se mandó, no por lo que volvió.
    const conToques = bloque.tenacidad.reduce((a, t) => a + t.leads, 0);

    return (
        <>
            <div className="grid">
                <Tile label="Entrantes" valor={fmt.num(bloque.leads)} color={v('info')}
                    help={'Leads nuevos que entraron al inbox en el período. Es el denominador de todo '
                        + 'lo demás de esta pantalla.'}
                    delta={deltas.leads}
                    humo={[v('info'), v('brand-primary'), v('info'), v('brand-navy')]}
                    sub="leads nuevos del período"
                    ver={() => irA('leads', {})} baja="p-embudo-set" />
                <Tile label="Tasa de respuesta" valor={fmt.pct(bloque.respuesta)} color={v('success')}
                    help={'De cada 100 leads que entraron, cuántos contestaron al menos un mensaje. '
                        + 'Mide si se está llegando a la gente, no si la conversación es buena.'}
                    delta={deltas.respuesta}
                    humo={[v('success'), v('info'), v('brand-primary'), v('success')]}
                    sub={`${bloque.respondieron} de ${fmt.plural(bloque.leads, 'entrante', 'entrantes')}`}
                    baja="p-cualificacion" />
                {/* Este tile y el panel Conversión abren los LEADS que agendaron y no la tabla
                    "Agendas generadas": el número cuenta leads del período que llegaron a reservar
                    (45) y esa tabla son las citas del período, que es la misma historia contada al
                    revés (169). El clic mostraba 169 filas debajo de un 45. */}
                <Tile label="Agendas" valor={fmt.num(bloque.agendas)} color={v('brand-secondary')}
                    help={'Citas que el equipo de setting dejó reservadas en el calendario de un '
                        + 'closer. Es el resultado del trabajo del setter.'}
                    delta={deltas.agendas}
                    humo={[v('brand-secondary'), v('brand-secondary-light'), v('brand-primary'), v('brand-navy')]}
                    sub={`${fmt.pct(bloque.conversion)} de los entrantes`}
                    ver={() => irA('leads', { estado: 'Agendó' })} baja="p-conversion" />
            </div>

            <div className="grid-2">
                <Panel id="p-cualificacion" cab={
                    <PanelCab titulo="Cualificación"
                        ayuda={'Cuántos leads cumplen el perfil del programa, medido de dos maneras: '
                            + 'sobre todos los que entraron, y sólo sobre los que contestaron. La '
                            + 'segunda mide la conversación; la diferencia entre las dos son los '
                            + `${bloque.leads - bloque.respondieron} que nunca respondieron.`}>
                        <span className="t-cap mut40 num">{bloque.cualificados} cualificados</span>
                    </PanelCab>
                }>
                    <div className="gruesa--sm" style={{ display: 'grid', gap: 'var(--s3)' }}>
                        <Gruesa i={0} label="Sobre entrantes" cuenta={`sobre ${bloque.leads}`}
                            help={'De cada 100 leads que llegaron, cuántos son buen prospecto. Mezcla '
                                + 'la calidad del lead con la capacidad de contestarle.'}
                            pct={fmt.pct(cualifEnt)} tone="info" w={cualifEnt} />
                        <Gruesa i={1} label="Sobre respuesta" cuenta={`sobre ${bloque.respondieron}`}
                            help={'De cada 100 leads que sí contestaron, cuántos son buen prospecto. '
                                + 'Esta mide la conversación, sin el ruido de quien nunca respondió.'}
                            pct={fmt.pct(bloque.cualificacion)} tone="success" w={bloque.cualificacion} />
                    </div>
                </Panel>

                <Panel id="p-conversion" cab={
                    <PanelCab titulo="Conversión"
                        ayuda={`Las mismas ${bloque.agendas} citas medidas contra tres puntos de `
                            + 'partida. Cuanto más abajo en el embudo está el denominador, más alto da '
                            + 'el porcentaje: no son mejores ni peores, responden preguntas distintas.'}>
                        <span className="t-cap mut40 num">{fmt.plural(bloque.agendas, 'cita', 'citas')}</span>
                    </PanelCab>
                }>
                    <div className="gruesa--sm" style={{ display: 'grid', gap: 'var(--s3)' }}>
                        <Gruesa i={0} label="De entrante a cita" cuenta={`sobre ${bloque.leads}`}
                            help={'Conversión final. De todo lo que entró por marketing, cuánto '
                                + 'terminó en el calendario.'}
                            pct={fmt.pct(bloque.conversion)} tone="warning" w={bloque.conversion}
                            ir={() => irA('leads', { estado: 'Agendó' })} />
                        <Gruesa i={1} label="De respuesta a cita" cuenta={`sobre ${bloque.respondieron}`}
                            help="De cada 100 conversaciones abiertas, cuántas llegan a cita."
                            pct={fmt.pct(convOpen)} tone="info" w={convOpen} />
                        <Gruesa i={2} label="De cualificado a cita" cuenta={`sobre ${bloque.cualificados}`}
                            help={'La eficacia pura del setter: de la gente que sí es buen prospecto, '
                                + 'a cuántos convence de reservar.'}
                            pct={fmt.pct(convCualif)} tone="success" w={convCualif} />
                    </div>
                </Panel>
            </div>

            <div className="grid-2">
                <div id="p-embudo-set" style={{ minWidth: 0 }}>
                    <Embudo pasos={pasosDe(bloque.funnel, EMBUDO_SETTER, irA)} />
                </div>

                <Panel id="p-tenacidad" cab={
                    <PanelCab titulo="Tenacidad del seguimiento"
                        ayuda={'Cuántos toques recibió cada lead antes de que el setter lo soltara. Un '
                            + 'inbox donde casi todos los leads tienen un solo mensaje no tiene un '
                            + 'problema de cierre: tiene seguimiento que no se hizo.'}>
                        <span className="t-cap mut40 num">
                            {fmt.plural(bloque.mensajes, 'mensaje', 'mensajes')}
                        </span>
                    </PanelCab>
                }>
                    {conToques === 0 ? <Vacio texto="Sin mensajes en el período." /> : (
                        <>
                            <div className="tdatos">
                                <div className="tdatos-cab">
                                    <span>Toques</span><span>Leads</span><span>%</span>
                                </div>
                                {bloque.tenacidad.map((t, i) => {
                                    const color = rampa(i, bloque.tenacidad.length);
                                    return (
                                        <div key={t.toques} className="tdatos-fila">
                                            <span className="tdatos-nom">
                                                <span className="dato-punto" style={{ background: color }} />
                                                <span className="trunc">
                                                    {fmt.plural(Number(t.toques.replace('+', '')), 'toque', 'toques')}
                                                    {t.toques.endsWith('+') && ' o más'}
                                                </span>
                                            </span>
                                            <span className="tdatos-n" style={{ color }}>{t.leads}</span>
                                            <span className="tdatos-p">{fmt.pct(tasa(t.leads, conToques))}</span>
                                        </div>
                                    );
                                })}
                            </div>
                            <p className="t-cap mut40" style={{ marginTop: 'var(--s3)' }}>
                                El porcentaje es sobre los {conToques} leads que recibieron al menos un
                                mensaje: a un lead al que nadie escribió no se le puede contar tenacidad.
                            </p>
                        </>
                    )}
                </Panel>
            </div>
        </>
    );
};

/* ============================================================
   VISTA
   ============================================================ */

const Analizar = ({ datos, rol, irA }) => {
    if (!datos) return <Cargando />;
    // El resumen que hay en mano puede ser todavía el del rol anterior: el `rol` de arriba cambia
    // en el momento y el fetch llega después. Dibujar el dashboard de closers con un payload de
    // setters no muestra números raros — revienta el árbol entero y deja la pantalla en blanco,
    // el mismo modo de falla que ya pasó con las tablas de Revisar. El payload dice de qué rol
    // es, así que se espera al que corresponde.
    if (datos.rol !== rol) return <Cargando />;
    const { actual, deltas } = datos;
    return rol === 'setters'
        ? <DashboardSetters bloque={actual} deltas={deltas} irA={irA} />
        : <DashboardClosers bloque={actual} deltas={deltas} porCobrar={datos.por_cobrar} irA={irA} />;
};

export default Analizar;
