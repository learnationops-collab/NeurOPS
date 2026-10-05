// Configuración › Funnels: nombre, probar, recibe agendas, eliminar, y un link por procedencia
// (texto libre o un setter) para saber de dónde viene cada agenda.

import { useState } from 'react';
import { Avatar, Icono, Switch, Sx } from '../../ui/base';
import { ui } from '../../ui/estadoUi';
import { copiarTexto, toast } from '../../ui/toast';
import { almacen, useDatos } from '../../data/hooks';
import { PLANTILLAS_FUNNEL } from '../../core/catalogos';
import { buscar, colorLibre, colorVar, maxOrden, nombreOrigen, ord, setters } from '../../core/datos';
import { linkEvento } from '../../core/eventos';
import { slugify, uid } from '../../core/util';
import { InputVivo } from './campos';

export function crearFunnel(d, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return false;
    const base = slugify(nombre) || 'funnel';
    let s = base, n = 2;
    while (d.funnels.some(f => f.slug === s)) s = base + '-' + n++;
    almacen.crear('funnels', { nombre, slug: s, color: colorLibre(d, 'funnels'), activo: true, orden: maxOrden(d, 'funnels') + 1 });
    return true;
}

const primerEvento = (d, f) => ord(d, 'eventos').find(e => e.funnel === f.id);

function Origenes({ d, f }) {
    const [nuevo, setNuevo] = useState('');
    const ev = primerEvento(d, f);
    const sts = setters(d).filter(p => !f.origenes.some(o => o.setter === p.id));
    const sumar = (o) => almacen.editar('funnels', f.id, { origenes: [...f.origenes, { id: uid('o'), ...o }] }, true);
    const crear = (e) => {
        e.preventDefault();
        const n = nuevo.replace(/\s+/g, ' ').trim();
        if (n && !f.origenes.some(o => nombreOrigen(d, o).toLowerCase() === n.toLowerCase())) { sumar({ nombre: n, setter: '' }); setNuevo(''); }
    };
    return (
        <div className="cf-origenes">
            <span className="cf-o-tit" title="Un link por procedencia para saber de dónde viene cada agenda"><Icono n="link" s={13} />Links</span>
            {f.origenes.map(o => {
                const p = o.setter && buscar(d, 'personas', o.setter), nom = nombreOrigen(d, o);
                const url = ev ? window.location.origin + '/agendas-v2' + linkEvento(d, ev) + '?o=' + (slugify(nom) || o.id) : '';
                return (
                    <span key={o.id} className={'cf-o' + (p ? ' cf-o--setter' : '')}>
                        {p && <Avatar p={p} clase="avatar--xs" />}{nom}
                        <button type="button" data-nav="" style={{ color: ev ? 'var(--brand-secondary)' : undefined }} disabled={!ev}
                            aria-label={ev ? 'Copiar link de ' + nom : 'Sin link: el funnel no tiene eventos'}
                            title={ev ? 'Copiar ' + url : 'Creá un evento en este funnel para tener el link'} onClick={() => copiarTexto(url)}>
                            <Icono n="copiar" s={12} />
                        </button>
                        <button type="button" aria-label={'Quitar ' + nom}
                            onClick={() => almacen.editar('funnels', f.id, { origenes: f.origenes.filter(x => x.id !== o.id) }, true)}>
                            <Icono n="x" s={12} />
                        </button>
                    </span>
                );
            })}
            <form className="cf-o-nuevo" noValidate onSubmit={crear}>
                <label className="sr" htmlFor={'cfo-' + f.id}>Nuevo link</label>
                <input id={'cfo-' + f.id} maxLength={60} autoComplete="off" placeholder="+ Link, ej. En vivo" value={nuevo} onChange={e => setNuevo(e.target.value)} />
            </form>
            {sts.length > 0 && (
                <Sx sm id={'cfst-' + f.id} label="Link de setter" valor=""
                    opciones={[{ v: '', n: '+ Setter', icono: 'rayo', color: 'var(--idle)' }, ...sts.map(p => ({ v: p.id, n: p.nombre, icono: 'user', color: 'var(--info)' }))]}
                    onChange={id => { const p = buscar(d, 'personas', id); if (p && !f.origenes.some(o => o.setter === id)) sumar({ nombre: p.nombre, setter: id }); }} />
            )}
        </div>
    );
}

function Funnel({ d, f, borrar, setBorrar }) {
    const probar = () => {
        const ev = primerEvento(d, f);
        if (!ev) { toast('Ese funnel no tiene eventos todavía.', 'error'); return; }
        almacen.flush();
        ui.set({ conf: null, prueba: { evento: ev, form: buscar(d, 'formularios', ev.formulario) || null } });
    };
    return (
        <div className={'cf-f' + (f.activo ? '' : ' cf-f--pausado')} style={{ '--c': colorVar(f.color) }}>
            <span className="cf-punto" aria-hidden="true" />
            <InputVivo className="cf-nom" id={'cfn-' + f.id} maxLength={80} aria-label="Nombre" valor={f.nombre}
                onCambio={v => almacen.editar('funnels', f.id, { nombre: v.trim() || 'Sin nombre' })} />
            <div className="cf-acc">
                <button type="button" className="ibtn ibtn--sm" data-nav="" aria-label={'Probar ' + f.nombre} title="Probar" onClick={probar}><Icono n="play" s={15} /></button>
                <Switch on={f.activo} label={f.nombre + ' recibe agendas'} onChange={v => almacen.editar('funnels', f.id, { activo: v }, true)} />
                <button type="button" className="ibtn ibtn--sm ibtn--peligro" aria-label={'Eliminar ' + f.nombre} onClick={() => setBorrar(f.id)}><Icono n="basura" s={15} /></button>
            </div>
            <Origenes d={d} f={f} />
            {borrar === f.id && (
                <div className="cf-borrar ed-pie--borrar">
                    <p className="t-sm">¿Eliminar <b>{f.nombre}</b>? Su link deja de funcionar.</p>
                    <div className="der">
                        <button type="button" className="btn btn--linea btn--sm" onClick={() => setBorrar(null)}>Cancelar</button>
                        <button type="button" className="btn btn--borrar btn--sm" autoFocus
                            onClick={() => { setBorrar(null); almacen.borrar('funnels', f.id); toast(f.nombre + ' eliminado'); }}>
                            <Icono n="basura" />Eliminar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function TabFunnels({ borrar, setBorrar }) {
    const { d } = useDatos();
    const [nuevo, setNuevo] = useState('');
    const fs = ord(d, 'funnels'), usados = fs.map(f => f.nombre.toLowerCase());
    const sug = PLANTILLAS_FUNNEL.filter(n => !usados.includes(n.toLowerCase())).slice(0, 4);
    return (
        <>
            <div>
                {fs.length ? fs.map(f => <Funnel key={f.id} d={d} f={f} borrar={borrar} setBorrar={setBorrar} />) : <p className="t-sm mut">Sin funnels todavía.</p>}
            </div>
            <form className="entrada" noValidate style={{ height: 50 }} onSubmit={e => { e.preventDefault(); if (crearFunnel(d, nuevo)) setNuevo(''); }}>
                <label className="sr" htmlFor="cf-nuevo">Nuevo funnel</label>
                <input id="cf-nuevo" type="text" maxLength={80} autoComplete="off" placeholder="Nuevo funnel, ej. Masterclass" value={nuevo} onChange={e => setNuevo(e.target.value)} />
                <button type="submit" className="btn btn--cta btn--sm"><Icono n="plus" />Crear</button>
            </form>
            {sug.length > 0 && (
                <div className="compo-sug">
                    <span className="t-rotulo">Rápido</span>
                    {sug.map(n => <button key={n} type="button" className="sug" onClick={() => crearFunnel(d, n)}><Icono n="plus" />{n}</button>)}
                </div>
            )}
        </>
    );
}
