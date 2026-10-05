// Piezas chicas de Team: caja de crear, semana en miniatura, nivel del closer y campo de nombre.

import { useEffect, useRef, useState } from 'react';
import { DIAS, icoNombre } from '../../core/catalogos';
import { buscar, colorRol, ord } from '../../core/datos';
import { mayus } from '../../core/util';
import { HUMO_MARCA, Humo, Icono } from '../../ui/base';
import { ICON } from '../../ui/iconos';
import { ui } from '../../ui/estadoUi';

// Cambia solo una parte del estado de Team en la interfaz.
export function setTeam(parcial) { ui.set(e => ({ team: { ...e.team, ...parcial } })); }

export const HUMO_PERSONA = ['var(--c)', 'var(--brand-primary)', 'var(--c)', 'var(--brand-navy)'];
// Nivel del closer: Top 1 oro ★★★, Top 2 plata ★★, Top 3 bronce ★
export const METAL = ['var(--oro)', 'var(--plata)', 'var(--bronce)'];
export function colorNivel(n) { return ['var(--brand-secondary)', 'var(--warning)', 'var(--info)', 'var(--success)', 'var(--idle)'][Math.max(0, Math.min(4, n - 1))]; }
export function icoRol(r) { return (r && r.icono) || icoNombre(r && r.nombre); }

export function Nivel({ n: nivel }) {
    const n = Math.max(1, Math.min(3, nivel));
    return (
        <span className="nivel" style={{ '--c': METAL[n - 1] }} title={'Top ' + n} aria-label={'Top ' + n}>
            {[0, 1, 2].map(i => (
                <svg key={i} viewBox="0 0 24 24" width="11" height="11" aria-hidden="true" className={i < 4 - n ? undefined : 'off'} dangerouslySetInnerHTML={{ __html: ICON.estrellaLlena }} />
            ))}
        </span>
    );
}

// Semana en miniatura: qué días atiende, de un vistazo.
export function SemanaMini({ p }) {
    return (
        <span className="semana" aria-label="Días con horario">
            {DIAS.map(d => <i key={d.d} className={(p.horario[d.d] || []).length ? 'on' : undefined} title={d.n}>{d.c}</i>)}
        </span>
    );
}

// Opciones del desplegable de rol, con ícono y color. Sin roles cargados: closer y setter.
export function opcionesRol(d, sel) {
    const rs = ord(d, 'roles');
    if (!rs.length) return [{ v: 'closer', n: 'Closer', icono: 'whatsapp', color: 'var(--success)' }, { v: 'setter', n: 'Setter', icono: 'rayo', color: 'var(--info)' }];
    const ops = rs.map(r => ({ v: r.id, n: r.nombre, icono: icoRol(r), color: colorRol(r) }));
    if (sel && !buscar(d, 'roles', sel)) ops.unshift({ v: sel, n: mayus(sel), icono: 'user', color: 'var(--idle)' });
    return ops;
}

// Campo de nombre que se edita en el lugar. Guarda mientras se escribe; vacío queda "Sin nombre".
export function CampoNombre({ valor, onGuardar, ...rest }) {
    const [txt, setTxt] = useState(valor);
    const foco = useRef(false);
    useEffect(() => { if (!foco.current) setTxt(valor); }, [valor]);
    return (
        <input {...rest} value={txt}
            onFocus={() => { foco.current = true; }}
            onBlur={() => { foco.current = false; setTxt(valor); }}
            onChange={e => { setTxt(e.target.value); onGuardar(e.target.value.trim() || 'Sin nombre'); }}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
    );
}

/**
 * Caja de crear (la del prototipo). o: {vacio, tit, soloTit, ph, onCrear(nombre) → error|'' , sug, nav, bloqueado}
 * `nav` deja el campo activo aunque la vista sea de solo lectura (Sumar personas es otro permiso).
 */
export function Compo({ vacio, tit, soloTit, ph, onCrear, sug, nav, bloqueado, id = 'nuevo-nombre' }) {
    const [val, setVal] = useState('');
    const [err, setErr] = useState('');
    const enviar = (e) => {
        e.preventDefault();
        const r = onCrear(val);
        if (r) { setErr(r); return; }
        setErr(''); setVal('');
    };
    const extra = { 'data-nav': nav ? '' : undefined, disabled: bloqueado || undefined, className: bloqueado ? 'bloq' : undefined };
    return (
        <section className={'compo caja' + (vacio ? ' compo--solo' : '')}>
            <Humo clase="humo--hero" cols={HUMO_MARCA} />
            <div className="compo-txt">
                <span className="compo-icono"><Icono n="plus" s={19} /></span>
                <div style={{ display: 'grid', gap: 4 }}><h2 className="t-h3">{vacio ? soloTit : tit}</h2></div>
            </div>
            <div className="compo-accion">
                <form className={'entrada' + (err ? ' mal' : '')} noValidate onSubmit={enviar}>
                    <label className="sr" htmlFor={id}>{tit}</label>
                    <input id={id} type="text" maxLength={80} autoComplete="off" placeholder={ph} value={val} aria-invalid={!!err || undefined}
                        aria-describedby={err ? id + '-err' : undefined} onChange={e => { setVal(e.target.value); if (err) setErr(''); }} {...extra} />
                    <button type="submit" {...extra} className={'btn btn--cta btn--sm' + (bloqueado ? ' bloq' : '')}><Icono n="plus" />Crear</button>
                </form>
                {err && <p className="campo-err" id={id + '-err'} role="alert"><Icono n="alerta" s={14} /><span>{err}</span></p>}
                {sug}
            </div>
        </section>
    );
}
