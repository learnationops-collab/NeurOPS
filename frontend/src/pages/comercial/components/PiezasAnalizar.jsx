import React from 'react';
import { ArrowRight, ChevronsDown, Eye } from 'lucide-react';
import { Humo, Tip, useMontado } from './Shared';
import Cifra from './Cifra';
import MetricaClicable, { abrir } from '../../../components/dashboard/MetricaClicable';

/**
 * Las piezas de Analizar → Dashboard que comparten el tablero de closers (`Analizar.jsx`) y el de
 * setters (`DashboardSetters.jsx`): el tile, la barra gruesa, el panel y su cabecera.
 *
 * Viven aparte desde el 10/10/2026, cuando el tablero de setters pasó a su propio archivo (Analizar
 * pasaba las 1.200 líneas). Marcado de la referencia visual: `.kpi` / `.panel` / `.gruesa`, con el CSS
 * en `comercial.css`; por `style` viajan solo las variables que dependen del dato.
 */

export const v = (tono) => `var(--${tono})`;

/** Tasa que devuelve null —y por lo tanto "—"— cuando no hay denominador. */
export const tasa = (num, den) => (den ? Number(((num / den) * 100).toFixed(1)) : null);

/**
 * Variación contra el período comparado. El `title` lleva el valor actual, porque un porcentaje
 * suelto no dice nada: "▼ 25%" sobre qué.
 */
export const Delta = ({ delta, actual }) => {
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

/** Barra fina. Crece de 0 al montar, que es la animación que define el CSS (`.riel > i`). */
export const Riel = ({ pct, color, fino, delay }) => {
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

export const PanelCab = ({ titulo, ayuda, children }) => (
    <div className="panel-cab">
        <h2 className="t-h3">{titulo}</h2>
        <Tip texto={ayuda} titulo={titulo} />
        {children && <div className="panel-cab-der">{children}</div>}
    </div>
);

export const Panel = ({ id, humo, cab, children, className }) => (
    <section className={`panel${humo ? ' caja' : ''}${className ? ` ${className}` : ''}`} id={id}>
        {humo && <Humo clase="humo--tarjeta" colores={humo} />}
        {cab}
        {children}
    </section>
);

/** Un par de pastillas que eligen cómo se mira el mismo dato. */
export const Tabs = ({ valor, onChange, ops, aria }) => (
    <div className="tabs" role="tablist" aria-label={aria}>
        {ops.map(([key, label, Icono]) => (
            <button key={key} type="button" className="tab tab--sm" role="tab"
                aria-selected={valor === key} onClick={() => onChange(key)}>
                <Icono size={13} />{label}
            </button>
        ))}
    </div>
);

/** Baja al panel que desglosa un tile y lo hace parpadear una vez para ubicarte. */
export const bajarA = (id) => {
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
 * crudo en la lista, el otro baja al panel que lo desglosa.
 *
 * El ojo dice "Ver los registros", sin nombrar la sección: la lista es Revisar para la dirección y
 * para el setter (desde el 10/10/2026; antes, Reporte · Registros) y "Mi cartera" para el closer.
 */
export const Tile = ({ label, help, valor, color, sub, delta, humo, ver, baja }) => (
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
                        title="Ver los registros" aria-label="Ver los registros">
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
 * a ese mismo corte en la lista. Es la pieza de los paneles que muestran una tasa sola.
 */
export const Gruesa = ({ label, cuenta, help, pct, tone, w, destino, irA, i = 0 }) => {
    const montado = useMontado();
    const color = v(tone);
    const dentro = (w || 0) >= 22 && cuenta;
    const ir = abrir(irA, destino);
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
                <MetricaClicable irA={irA} destino={destino} detalle={destino?.de}
                    className={`gruesa-pct${String(pct).length > 6 ? ' gruesa-pct--larga' : ''}`}
                    style={{ color }}>
                    {pct}
                </MetricaClicable>
                {ir && (
                    <button type="button" className="ir-btn" style={{ '--c': color }} onClick={ir}
                        aria-label={`Ver ${label.toLowerCase()} en la lista`}>
                        <ArrowRight size={14} />
                    </button>
                )}
            </div>
        </div>
    );
};

export const Vacio = ({ texto }) => <p className="t-cap mut40">{texto}</p>;
