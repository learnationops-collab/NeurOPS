import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Humo, fmt } from '../Shared';
import Cifra from '../Cifra';
import Tip from '../Tip';
import { derivadas, retornoMarginal, variacion } from './modelo';

const HUMO = ['var(--brand-secondary)', 'var(--brand-primary)', 'var(--brand-secondary-light)', 'var(--brand-navy)'];

const dinero = (v) => fmt.money(v);
const dinero2 = (v) => (v === null || v === undefined ? '—' : `$${Number(v).toFixed(2)}`);
const entero = (v) => fmt.num(Math.round(v));
const decimal = (v) => fmt.num(Math.round(v * 10) / 10);
const porc = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1)}%`);
const veces = (v) => (v === null || v === undefined ? '—' : `${v.toFixed(2)}x`);

/** El cambio entre base y escenario, con el tono que le toca (`mejor`: ¿subir es bueno?). */
export const Cambio = ({ base, esc, formato = dinero, soloPct = false }) => {
    if (base === null || esc === null || base === undefined || esc === undefined) return <span>—</span>;
    const { abs, pct } = variacion(base, esc);
    if (Math.abs(abs) < 1e-6 || (pct !== null && Math.abs(pct) < 0.05)) return <span>Sin cambio</span>;
    const sube = abs > 0;
    const texto = soloPct ? '' : `${sube ? '+' : '−'}${formato(Math.abs(abs))}`;
    const p = pct === null ? '' : `${sube ? '+' : '−'}${Math.abs(pct).toFixed(1)}%`;
    return <span>{[texto, p].filter(Boolean).join(' · ')}</span>;
};

const tono = (base, esc, mejor = true) => {
    const d = esc - base;
    if (Math.abs(d) < 1e-6) return null;
    return (d > 0) === mejor ? 'success' : 'error';
};

const Tarjeta = ({ label, tip, base, esc, formato, nota, mejor = true }) => {
    const t = base === null || esc === null ? null : tono(base, esc, mejor);
    return (
        <section className="kpi caja">
            <Humo colores={HUMO} />
            <div className="kpi-cab">
                <p className="t-eyebrow">{label}</p>
                <Tip texto={tip} titulo={label} />
            </div>
            <div className="kpi-cifra">
                <Cifra tag="p" className="kpi-n" valor={esc === null ? '—' : formato(esc)} desdeAnterior />
                <p className="sim-base"><span>Base <b>{base === null ? '—' : formato(base)}</b></span></p>
                {t && (
                    <span className="delta" style={{ '--c': `var(--${t})`, alignSelf: 'start' }}>
                        <Cambio base={base} esc={esc} formato={formato} />
                    </span>
                )}
                {nota && <p className="kpi-sub num">{nota}</p>}
            </div>
        </section>
    );
};

/** Las filas de la tabla de datos centrales: [rótulo, valor base, valor escenario, formato, ¿subir es bueno?]. */
const filasDe = (total, perfil) => {
    const b = total.base;
    const e = total.esc;
    const db = derivadas(b, perfil);
    const de = derivadas(e, perfil);
    return [
        ['Entrantes', b.entrantes, e.entrantes, entero],
        ['Aperturas', b.aperturas, e.aperturas, entero],
        ['Agendas generadas', b.generadas, e.generadas, entero],
        ['Agendas del closer', b.agendas, e.agendas, entero],
        ['Asistieron', b.asistieron, e.asistieron, entero],
        ['Ventas', b.ventas, e.ventas, decimal],
        ['Close rate', db.closeRate, de.closeRate, porc],
        ['Ticket promedio', db.ticket, de.ticket, dinero],
        ['Cash', b.cash, e.cash, dinero],
        ['Comisión closers', b.comCloser, e.comCloser, dinero],
        ['Comisión setters', b.comSetter, e.comSetter, dinero],
        ['Inversión en anuncios', b.gasto, e.gasto, dinero, false],
        ['Leads de anuncios', b.entAds, e.entAds, entero],
        ['Costo por lead', db.cpl || null, de.cpl || null, dinero2, false],
        ['Retorno de anuncios', db.roas, de.roas, veces],
    ];
};

const TablaCentrales = ({ total, perfil }) => (
    <div className="sim-tabla" role="table" aria-label="Datos centrales, base contra escenario">
        <div className="sim-f sim-f--cab" role="row">
            <span role="columnheader">Dato</span><span role="columnheader">Base</span>
            <span role="columnheader">Escenario</span><span role="columnheader">Cambio</span>
        </div>
        {filasDe(total, perfil).map(([rotulo, base, esc, formato, mejor = true]) => {
            const t = base === null || esc === null ? null : tono(base, esc, mejor);
            return (
                <div className="sim-f" role="row" key={rotulo}>
                    <span className="sim-f-n" role="cell">{rotulo}</span>
                    <span role="cell">{base === null ? '—' : formato(base)}</span>
                    <span role="cell">{esc === null ? '—' : formato(esc)}</span>
                    <span className="sim-f-d" role="cell" data-sube={t === 'success' ? '1' : t === 'error' ? '0' : ''}>
                        <Cambio base={base} esc={esc} formato={formato} soloPct />
                    </span>
                </div>
            );
        })}
    </div>
);

/** Los techos del equipo que dejaron agendas sin atender: lo que el escenario pide y no se puede. */
export const Cuellos = ({ total }) => {
    const s = total.esc.sinAtenderSetters;
    const c = total.esc.sinAtenderClosers;
    if (s < 0.5 && c < 0.5) return null;
    return (
        <div className="sim-alerta" role="status">
            <AlertTriangle aria-hidden="true" />
            <span>
                {c >= 0.5 && <>Los closers no llegan: quedan ~{Math.round(c)} llamadas sin atender. </>}
                {s >= 0.5 && <>Los setters no llegan: ~{Math.round(s)} agendas más de las que pueden generar. </>}
                Sumá gente o subí lo que atiende cada uno.
            </span>
        </div>
    );
};

/** Las cuatro tarjetas de arriba (y el aviso de techo del equipo, si lo hay). */
const Resultados = ({ total, perfil }) => {
    const { base, esc } = total;
    const marginal = retornoMarginal(total);
    const db = derivadas(base, perfil);
    const de = derivadas(esc, perfil);
    return (
        <>
            <Cuellos total={total} />
            <div className="sim-tarj pareja">
                <Tarjeta label="Cash proyectado" tip="Todo lo cobrado: ventas nuevas, cuotas y señas."
                    base={base.cash} esc={esc.cash} formato={dinero} />
                <Tarjeta label="Ventas" tip="Pago completo + split pay. Las señas no cuentan."
                    base={base.ventas} esc={esc.ventas} formato={decimal}
                    nota={`Close rate ${porc(de.closeRate)} · ticket ${dinero(de.ticket)}`} />
                <Tarjeta label="Comisiones" tip="Closers 10% y setters 8% del cash neto."
                    base={base.comCloser + base.comSetter} esc={esc.comCloser + esc.comSetter} formato={dinero}
                    nota={`Closers ${dinero(esc.comCloser)} · setters ${dinero(esc.comSetter)}`} />
                <Tarjeta label="Retorno de anuncios" tip="Cash atribuido a anuncios ÷ inversión."
                    base={db.roas} esc={de.roas} formato={veces}
                    nota={marginal === null ? `Inversión ${dinero(esc.gasto)}`
                        : `Cada $1 extra devuelve $${marginal.toFixed(2)}`} />
            </div>
        </>
    );
};

export const DatosCentrales = ({ total, perfil }) => (
    <section className="panel">
        <div className="panel-cab"><h2 className="t-h3">Datos centrales</h2>
            <Tip texto="Suma del horizonte elegido, base contra escenario." titulo="Datos centrales" /></div>
        <TablaCentrales total={total} perfil={perfil} />
    </section>
);

export default Resultados;
