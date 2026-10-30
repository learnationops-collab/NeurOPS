// El reporte lead por lead del Triage Dashboard (diseño de Claude Design, 30/10/2026): chips por estado con su
// cuenta, y cada llamada con sus estados, su nota y, si le dejó una al closer, «Ver nota» y «Ver ficha».

import { useState } from 'react';
import { formatAgendaDateTime } from '../../../../utils/datetime';
import { COLOR_DE_ESTADO, ESTADOS, coincide, estadoDe } from './triageDatos';

const LOW_TICKET = { cerrado: 'Cerró el low ticket', no_cerrado: 'No cerró', seguimiento: 'Seguimiento', descartado: 'Perdido', no_pitch: 'Sin presentación' };

const chip = (texto, color) => {
    const marca = color === 'brand-primary';
    return (
        <span key={texto} style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            color: marca ? 'var(--text-on-surface)' : `var(--${color})`,
            background: marca ? 'color-mix(in oklab, var(--brand-primary) 30%, transparent)' : `var(--${color}-surface)`,
            border: `1px solid ${marca ? 'var(--brand-primary)' : `var(--${color}-border)`}` }}>{texto}</span>
    );
};

const Llamada = ({ l, onAbrir }) => {
    const [abierta, setAbierta] = useState(false);
    const estado = estadoDe(l);
    const extra = l.calificacion === 'calificado' ? 'Pasado al closer'
        : l.low_ticket ? `${LOW_TICKET[l.low_ticket] || l.low_ticket}${l.low_ticket === 'seguimiento' && l.fecha_seguimiento ? ` · ${l.fecha_seguimiento}` : ''}` : null;
    const boton = { marginLeft: 6, padding: '5px 12px', borderRadius: 999, border: '1px solid var(--border-control)', background: 'transparent',
        color: 'var(--text-on-surface)', fontSize: 12, fontWeight: 700, cursor: 'pointer' };
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 800 }}>{l.cliente || `Agenda ${l.id}`}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatAgendaDateTime(l.hora)}{l.triage ? ` · ${l.triage}` : ''}</span>
                {chip(estado, COLOR_DE_ESTADO[estado])}
                {extra && chip(extra, 'info')}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                    {l.nota_para_closer && <button type="button" style={boton} onClick={() => setAbierta((v) => !v)}>{abierta ? 'Ocultar nota' : 'Ver nota'}</button>}
                    {onAbrir && <button type="button" style={boton} onClick={() => onAbrir(l)}>Ver ficha</button>}
                </span>
            </div>
            {l.nota && <span style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{l.nota}</span>}
            {abierta && (
                <div style={{ padding: 16, borderRadius: 16, background: 'rgba(2,6,23,.35)', border: '1px solid var(--border-subtle)' }}>
                    <small style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.2em', color: 'var(--brand-secondary)' }}>PARA EL CLOSER</small>
                    <span style={{ display: 'block', marginTop: 6, fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{l.nota_para_closer}</span>
                </div>
            )}
        </div>
    );
};

export default function TriageReporte({ leads, ver, onVer, titulo, onAbrir }) {
    const chips = [{ clave: 'agendas', texto: 'Todas', n: leads.length },
        ...ESTADOS.map((e) => ({ clave: `st:${e.clave}`, texto: e.clave, n: leads.filter((l) => estadoDe(l) === e.clave).length }))];
    const lista = leads.filter((l) => coincide(l, ver));
    return (
        <div id="triage-reporte" style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: 28, borderRadius: 32, background: 'var(--bg-element)', border: '1px solid var(--border-main)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 22, fontWeight: 800 }}>
                    {titulo || 'Reporte'} <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: 16 }}>· {lista.length} {lista.length === 1 ? 'llamada' : 'llamadas'}</span>
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {chips.map((c) => {
                        const activo = ver === c.clave || (!ver && c.clave === 'agendas');
                        return (
                            <button key={c.clave} type="button" onClick={() => onVer(c.clave)}
                                style={{ whiteSpace: 'nowrap', padding: '6px 12px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                    border: `1px solid ${activo ? 'transparent' : 'var(--border-control)'}`,
                                    background: activo ? '#fff' : 'transparent', color: activo ? 'var(--ink)' : 'var(--text-on-surface)' }}>
                                {c.texto} <span style={{ opacity: 0.7 }}>{c.n}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {lista.length === 0
                    ? <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '14px 0' }}>Ninguna llamada en esta lista.</span>
                    : lista.map((l) => <Llamada key={l.id} l={l} onAbrir={onAbrir} />)}
            </div>
        </div>
    );
}
