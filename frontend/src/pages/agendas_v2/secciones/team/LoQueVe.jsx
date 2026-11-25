// Turnos › «Lo que ve el lead» (ADR-W226): lo que puede elegir ahora un lead en cada link con segmentación,
// con los horarios reales (sesión de su segmento, mínimo diario, agendas y Google), y los días del link
// editables al instante, también por el setter. «Por link»: closers y triage de cada link. «Por segmento»:
// el link elegido, un bloque por segmento. La ventana es del link (C/D agendan la Sesión diagnóstica con
// los días del link por el que entraron).

import { useMemo, useState } from 'react';
import { Segmented } from '../../../../components/standard';
import { BotonesLink, GrillaDias, VentanaDias, colorSegmento, filaDe, nombreDia } from './GrillaLead.jsx';
import { useLoQueVe } from './useLoQueVe';
import './loQueVe.css';

const antelTxt = (a) => a.n + ' ' + ({ min: 'min', h: 'h', d: 'd' }[a.u] || a.u) + ' antes';

// Hasta qué día ve el lead: el último de la ventana.
function hastaTxt(link) {
    const d = [...link.dias].reverse().find(x => x.ventana);
    return d ? nombreDia(d.dow) + ' ' + Number(d.clave.slice(8)) : '–';
}

// «Por link»: los segmentos que toman la sesión del link (closers) y los que toman otra (triage), sumados.
function filasDelLink(link) {
    const grupos = [
        { key: 'closers', nombre: 'Closers', segs: link.segmentos.filter(s => s.sesion === link.evento) },
        { key: 'triage', nombre: 'Triage', segs: link.segmentos.filter(s => s.sesion !== link.evento) },
    ].filter(g => g.segs.length);
    return grupos.map(g => {
        const porT = new Map();
        g.segs.forEach(s => s.slots.forEach(x => { if (!porT.has(x.t + x.p)) porT.set(x.t + x.p, x); }));
        const ve = [...new Set(g.segs.flatMap(s => s.ve))];
        const sesion = g.segs[0].sesion + ' · ' + g.segs[0].duracion + ' min';
        return {
            key: g.key, nombre: g.nombre, color: g.key === 'closers' ? 'var(--success)' : 'var(--brand-primary)',
            sub: g.segs.map(s => s.nombre.replace(/^Segmento /, '')).join(', ') + ' · ' + sesion,
            ...filaDe(link, [...porT.values()].sort((a, b) => a.t - b.t), ve),
        };
    });
}

const filaSegmento = (link, s) => ({
    key: s.id, nombre: s.nombre, color: colorSegmento(s.nombre), sub: s.sesion + ' · ' + s.duracion + ' min', ...filaDe(link, s.slots, s.ve),
});

const enVentana = (fila) => [...fila.ve].reduce((n, k) => n + (fila.porDia[k] || []).length, 0);

function TarjetaLink({ link, codigo, guardando, onCambiar, nombres }) {
    const filas = useMemo(() => filasDelLink(link), [link]);
    return (
        <section className="lv-card">
            <div className="lv-top">
                <div className="lv-nom"><b>{link.nombre}</b><span className="t-sm mut">{link.evento} · {antelTxt(link.antel)}</span></div>
                <VentanaDias link={link} guardando={guardando} onCambiar={onCambiar} />
            </div>
            <GrillaDias link={link} filas={filas} nombres={nombres} />
            <div className="lv-pie">
                <span>Hasta el <b>{hastaTxt(link)}</b>{filas.map(f => <span key={f.key}> · {f.nombre.toLowerCase()} <b>{enVentana(f)}</b> horarios</span>)}</span>
                <BotonesLink link={link} codigo={codigo} />
            </div>
        </section>
    );
}

function PorSegmento({ links, codigo, guardando, onCambiar, nombres }) {
    const [elegido, setElegido] = useState(null);
    const link = links.find(l => l.id === elegido) || links.find(l => l.setting) || links[0];
    return (
        <>
            <div className="lv-elegir">
                <span className="t-sm mut">Entró por</span>
                <Segmented size="sm" value={link.id} options={links.map(l => ({ value: l.id, label: l.nombre, props: { 'data-nav': '' } }))} onChange={setElegido} label="Link" />
                <VentanaDias link={link} guardando={guardando} onCambiar={onCambiar} />
            </div>
            {link.segmentos.map(s => {
                const fila = filaSegmento(link, s);
                return (
                    <section key={s.id} className="lv-card">
                        <div className="lv-top">
                            <div className="lv-nom">
                                <b><span className="lv-punto" style={{ background: fila.color }} />{s.nombre}</b>
                                <span className="t-sm mut">{fila.sub} · con {[...new Set(s.slots.map(x => (nombres[x.p] || '').split(' ')[0]))].filter(Boolean).join(', ') || 'nadie con horario'}</span>
                            </div>
                            <span className="lv-resumen t-sm">Ve <b>{enVentana(fila)}</b> horarios hasta el <b>{hastaTxt(link)}</b></span>
                            <BotonesLink link={link} codigo={codigo} />
                        </div>
                        <GrillaDias link={link} filas={[{ ...fila, nombre: 'Horarios', sub: '', color: fila.color }]} nombres={nombres} />
                    </section>
                );
            })}
        </>
    );
}

export default function LoQueVe({ modo, tz }) {
    const { datos, error, guardando, cambiarDias } = useLoQueVe(tz);
    if (error && !datos) return <p className="t-sm mut">{error}</p>;
    if (!datos) return <p className="t-sm mut">Calculando lo que ve el lead…</p>;
    if (!datos.links.length) return <p className="t-sm mut">No hay links publicados con segmentación.</p>;
    const comun = { codigo: datos.codigo, guardando, onCambiar: cambiarDias, nombres: datos.personas };
    return (
        <div className="lv">
            <p className="t-sm mut lv-intro">Si un lead abre el link ahora, esto es lo que puede elegir. Los días se cambian acá y el link se actualiza al instante.</p>
            {modo === 'segmento'
                ? <PorSegmento links={datos.links} {...comun} />
                : datos.links.map(l => <TarjetaLink key={l.id} link={l} {...comun} />)}
            <div className="lv-leyenda t-sm mut">
                <span><i className="lv-ve" />El lead lo ve</span>
                <span><i className="lv-fuera" />Hay lugar, pero queda fuera de los días del link</span>
                <span><i className="lv-cero" />En los días del link, sin horarios</span>
            </div>
        </div>
    );
}
