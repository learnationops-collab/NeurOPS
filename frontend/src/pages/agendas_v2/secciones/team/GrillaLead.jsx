// Piezas de Turnos › «Lo que ve el lead»: la grilla de días (lo que ve, lo que queda fuera de la ventana y
// los horarios del día tocado), el control de días del link y los botones del link.

import { useState } from 'react';
import { DIAS } from '../../core/catalogos';
import { claveDia, horaTxt } from '../../core/tiempo';
import { Button, Segmented, Stepper, toast } from '../../../../components/standard';

const N_MAX = 30;
const TIPOS = [{ value: 'habiles', label: 'días hábiles' }, { value: 'corridos', label: 'corridos' }];

export const nombreDia = (dow) => (DIAS.find(x => x.d === dow) || { n: '' }).n.slice(0, 3);

// Color del segmento por su letra (como en la tarjeta del lead): A verde, B azul, C ámbar, D magenta.
export function colorSegmento(nombre) {
    const letra = String(nombre || '').trim().slice(-1).toUpperCase();
    return { A: 'var(--success)', B: 'var(--info)', C: 'var(--warning)', D: 'var(--brand-primary)' }[letra] || 'var(--text-muted)';
}

// Una fila de la grilla desde los horarios: {porDia: {clave: [slot]}, ve: Set de claves que ofrece de verdad}.
export function filaDe(link, slots, ve) {
    const porDia = {};
    slots.forEach(s => { const k = claveDia(s.t, link.tz); (porDia[k] = porDia[k] || []).push(s); });
    const conVe = new Set(ve.map(t => claveDia(t, link.tz)));
    return { porDia, ve: new Set(link.dias.filter(d => d.ventana || conVe.has(d.clave)).map(d => d.clave)) };
}

export function GrillaDias({ link, filas, nombres }) {
    const [sel, setSel] = useState(null);
    const hoy = link.dias[0] && link.dias[0].clave;
    const elegida = sel && filas.find(f => f.key === sel.f);
    const delDia = elegida ? (elegida.porDia[sel.k] || []) : [];
    return (
        <>
            <div className="lv-grilla" style={{ '--lv-dias': link.dias.length }}>
                <span />
                {link.dias.map(d => (
                    <span key={d.clave} className={'lv-gh' + (d.clave === hoy ? ' lv-hoy' : '')}>{nombreDia(d.dow)} <i>{Number(d.clave.slice(8))}</i></span>
                ))}
                {filas.map(f => [
                    <div key={f.key} className="lv-rot">
                        <b><span className="lv-punto" style={{ background: f.color }} />{f.nombre}</b>
                        {f.sub && <span className="t-sm mut">{f.sub}</span>}
                    </div>,
                    ...link.dias.map(d => {
                        const n = (f.porDia[d.clave] || []).length;
                        const ve = f.ve.has(d.clave);
                        const cls = ['lv-dia', ve ? (n ? 'lv-ve' : 'lv-cero') : 'lv-fuera', sel && sel.f === f.key && sel.k === d.clave ? 'lv-sel' : ''].join(' ');
                        const nota = ve ? (d.clave === hoy ? 'hoy' : '') : (n ? 'no lo ve' : '');
                        return (
                            <button key={f.key + d.clave} type="button" className={cls} data-nav="" disabled={!n}
                                aria-label={`${f.nombre}, ${nombreDia(d.dow)} ${Number(d.clave.slice(8))}: ${n} horarios${ve ? '' : ', fuera de la ventana'}`}
                                onClick={() => setSel(sel && sel.f === f.key && sel.k === d.clave ? null : { f: f.key, k: d.clave })}>
                                <b className="num">{n || '–'}</b><small>{nota}</small>
                            </button>
                        );
                    }),
                ])}
            </div>
            {elegida && (
                <div className="lv-horas">
                    <b className="t-sm">{elegida.nombre} · {nombreDia(link.dias.find(d => d.clave === sel.k)?.dow)} {Number(sel.k.slice(8))}{elegida.ve.has(sel.k) ? ' · lo que ve el lead' : ' · fuera de la ventana: el lead no lo ve'}</b>
                    <div className="tu-horas">
                        {delDia.map(s => (
                            <span key={s.t + s.p} className="tu-hora"><b className="num">{horaTxt(s.t, link.tz)}</b><small>{(nombres[s.p] || '').split(' ')[0]}</small></span>
                        ))}
                    </div>
                </div>
            )}
        </>
    );
}

export function VentanaDias({ link, guardando, onCambiar }) {
    const r = link.reservas;
    if (r.modo !== 'dias') return <span className="t-sm mut">{r.modo === 'siempre' ? 'Sin límite de días' : 'Rango de fechas fijo'}</span>;
    const ocupado = guardando === link.id;
    return (
        <div className="lv-ventana">
            <span className="t-sm mut">Se puede agendar hasta</span>
            <Stepper value={r.n} min={1} max={N_MAX} label={`Días del link ${link.nombre}`} disabled={ocupado}
                onChange={(n) => onCambiar(link, n, r.tipo)} className="lv-step" />
            <Segmented size="sm" value={r.tipo} options={TIPOS} onChange={(t) => t !== r.tipo && onCambiar(link, r.n, t)}
                itemProps={{ disabled: ocupado }} label="Cómo se cuentan los días" />
            <span className={'lv-estado' + (ocupado ? ' lv-estado--guardando' : '')}>{ocupado ? 'Guardando…' : 'En vivo'}</span>
        </div>
    );
}

export function urlDe(link, codigo) {
    return window.location.origin + link.ruta + (link.setting && codigo ? `?o=${codigo}` : '');
}

export function BotonesLink({ link, codigo }) {
    const url = urlDe(link, codigo);
    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(url);
            toast('Link copiado' + (link.setting && codigo ? ', con tu código de setter' : ''), 'success');
        } catch (e) {
            console.error(`copiar link: ${e}`);
            toast('No se pudo copiar: ' + url, 'error');
        }
    };
    return (
        <span className="lv-botones">
            <Button data-nav="" onClick={copiar}>Copiar link</Button>
            <Button data-nav="" variant="ghost" onClick={() => window.open(url, '_blank', 'noopener')}>Abrir ↗</Button>
        </span>
    );
}
