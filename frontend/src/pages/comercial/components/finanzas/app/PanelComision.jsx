import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { money, pctTxt, r2, sum } from './modelo';
import { descargarRecibo } from './reciboPdf';

/**
 * Las comisiones de una persona: cada cobro con el cliente, lo que pagó (el neto que llegó, o el
 * estimado si todavía no está verificado), el % y su comisión, y el recibo en PDF. Un cobro que no
 * llegó o que fue impugnado se saca de la nómina desde acá («No cuenta»): deja de sumar comisión.
 */
const FUENTES = { renovacion: 'Renovación', upsell: 'Upsell', conversion: 'Conversión', cuota: 'Cuota' };
const PROGRAMAS = { AL: 'Ace Learners', RR: 'Residency Roadmap', SI: 'SI' };
const fecha = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—');

/** Las filas del detalle de comisiones de `p` (de Payroll) y la regla que las explica. */
export const comisionDe = (p, payroll) => {
    const d = payroll?.[p.clave];
    if (!d) return null;
    const ff = d.sales.some((s) => s.fuente);
    const rows = [...d.sales].sort((a, b) => ((a.date || '') < (b.date || '') ? -1 : 1)).map((s) => ({
        id: s.id, c1: ff ? PROGRAMAS[s.programa] || s.programa : fecha(s.date), cli: s.nombre_cliente || '—',
        sub: s.concepto === 'director' ? s.closer : '', tipo: ff ? FUENTES[s.fuente] || s.fuente : s.tipo_pago || '—',
        pago: r2(s.monto_neto), pct: s.porcentaje, com: r2(s.comision), fuera: !!s.is_excluded_from_payroll,
        sinVerificar: s.verificacion !== 'verified',
    }));
    const pcts = [...new Set(rows.map((r) => r.pct))];
    const regla = ff ? 'según programa y tipo de pago'
        : d.desglose ? 'ventas propias y de director' : pcts.length === 1 ? `${pctTxt(pcts[0])} de lo que cobró` : 'según el % de cada mes';
    return { h1: ff ? 'Programa' : 'Fecha', regla, rows };
};

const PanelComision = ({ p, payroll, titulo, onExcluir, editable }) => {
    const [bajando, setBajando] = useState(false);
    const d = comisionDe(p, payroll);
    if (!d) return <div className="pan cmp"><div className="vacio">Cargando las comisiones…</div></div>;
    const ok = d.rows.filter((r) => !r.fuera);
    const bajar = async () => {
        setBajando(true);
        try { await descargarRecibo(p, d, titulo); } catch { toast.error('No se pudo generar el PDF'); }
        setBajando(false);
    };
    return (
        <div className="pan cmp">
            <div className="cmh">
                <div>
                    <div className="pt">Comisiones de {p.n}</div>
                    <div className="cms">{d.rows.length} {d.rows.length === 1 ? 'cobro' : 'cobros'} · {d.regla}</div>
                </div>
                <div className="cmk">
                    <span>Cobrado<b>{money(sum(ok, (r) => r.pago))}</b></span>
                    <span>Comisión<b className="mg">{money(p.com)}</b></span>
                </div>
            </div>
            <div className="dscroll">
                <table className="dt">
                    <thead><tr><th>{d.h1}</th><th>Cliente</th><th>Tipo</th><th className="n">Pagó</th><th className="n">%</th><th className="n">Comisión</th><th className="n" aria-label="Cuenta" /></tr></thead>
                    <tbody>
                        {d.rows.map((r) => (
                            <tr key={`${r.id}-${r.sub}`} className={r.fuera ? 'nul' : ''}>
                                <td>{r.c1}</td>
                                <td>{r.cli}{r.sub ? <small> · {r.sub}</small> : null}</td>
                                <td>{r.tipo}</td>
                                <td className={`n${r.fuera ? ' x' : ''}`} title={r.sinVerificar ? 'Estimado: el pago todavía no está verificado' : undefined}>
                                    {r.fuera ? 'No cuenta' : `${money(r.pago)}${r.sinVerificar ? ' *' : ''}`}
                                </td>
                                <td className="n">{pctTxt(r.pct)}</td>
                                <td className="n">{money(r.com)}</td>
                                <td className="n">
                                    <button type="button" className="aj" disabled={!editable}
                                        title={r.fuera ? 'Volver a contar este cobro' : 'Sacar este cobro de la nómina (no llegó o fue impugnado)'}
                                        onClick={() => onExcluir(r.id, !r.fuera)}>{r.fuera ? 'Contar' : 'No cuenta'}</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="cmf">
                <span className="cmmsg">{p.comManual ? 'Comisión escrita a mano en Registros › Nómina' : '* estimado: pago sin verificar'}</span>
                <button type="button" className="pdfb" onClick={bajar} disabled={bajando}>{bajando ? 'Preparando…' : 'Descargar recibo PDF'}</button>
            </div>
        </div>
    );
};

export default PanelComision;
