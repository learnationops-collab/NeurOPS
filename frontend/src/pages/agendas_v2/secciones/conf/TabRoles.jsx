// Configuración › Roles: nombre, abreviación, ícono, color, si recibe llamadas (closer) y cuántas personas.
// Thalamus no tiene permisos propios por rol: quién entra lo deciden los roles de NeurOPS.

import { useCallback, useState } from 'react';
import { Icono, Switch, Sx } from '../../ui/base';
import { toast } from '../../ui/toast';
import { useOrdenable } from '../../ui/useOrdenable';
import { almacen, useDatos } from '../../data/hooks';
import { COLORES, ICONOS_ROL, accesosPorNombre } from '../../core/catalogos';
import { colorRol, colorVar, maxOrden, ord } from '../../core/datos';
import { mayus } from '../../core/util';
import { InputVivo } from './campos';

const SUGERIDOS = ['CEO', 'Director comercial', 'Closer', 'Setter'];
const filtroAbrev = (t) => t.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ0-9]/g, '').toUpperCase().slice(0, 4);

export function crearRol(d, nombre) {
    nombre = String(nombre || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return false;
    almacen.crear('roles', { nombre, ...accesosPorNombre(nombre), orden: maxOrden(d, 'roles') + 1 });
    return true;
}

function Rol({ d, r, claseItem, grip }) {
    const n = d.personas.filter(x => x.rol === r.id).length;
    const c = colorRol(r);
    return (
        <div className={'rl' + claseItem(r.id)} data-item={r.id} style={{ '--c': c }}>
            <button type="button" className="grip" {...grip(r.id, 'Mover ' + r.nombre)}><Icono n="grip" /></button>
            <span className="rol-ico rol-ico--l"><Icono n={r.icono} s={18} /></span>
            <InputVivo className="cf-nom" id={'rn-' + r.id} maxLength={60} aria-label="Nombre del rol" valor={r.nombre}
                onCambio={v => almacen.editar('roles', r.id, { nombre: v.trim() || 'Sin nombre' })} />
            <InputVivo className="rl-ab" id={'ra-' + r.id} maxLength={4} spellCheck={false} aria-label="Abreviación" title="Abreviación" valor={r.abrev}
                filtro={filtroAbrev} onCambio={v => { if (v) almacen.editar('roles', r.id, { abrev: v }); }} />
            <Sx sm id={'ri-' + r.id} label="Ícono" valor={r.icono} onChange={v => almacen.editar('roles', r.id, { icono: v }, true)}
                opciones={ICONOS_ROL.map(([v, nom]) => ({ v, n: nom, icono: v, color: c }))} />
            <Sx sm id={'rc-' + r.id} label="Color" valor={r.color} onChange={v => almacen.editar('roles', r.id, { color: v }, true)}
                opciones={[{ v: '', n: 'Auto', icono: 'sistema', color: r.atiende ? 'var(--success)' : 'var(--info)' },
                    ...COLORES.map(k => ({ v: k, n: mayus(k === 'ambar' ? 'ámbar' : k), icono: 'estrellaLlena', color: colorVar(k) }))]} />
            <span className="rl-n num" title="Personas con este rol"><Icono n="user" s={13} />{n}</span>
            <span title="Las personas con este rol toman llamadas (son closers)">
                <Switch on={r.atiende} label={'Recibe llamadas: ' + r.nombre} onChange={v => almacen.editar('roles', r.id, { atiende: v }, true)} />
            </span>
            <button type="button" className="ibtn ibtn--xs ibtn--peligro" aria-label={'Eliminar ' + r.nombre} disabled={n > 0} title={n ? 'Tiene personas asignadas' : undefined}
                onClick={() => { almacen.borrar('roles', r.id); toast(r.nombre + ' eliminado'); }}>
                <Icono n="basura" />
            </button>
        </div>
    );
}

export function TabRoles() {
    const { d } = useDatos();
    const [nuevo, setNuevo] = useState('');
    const rs = ord(d, 'roles'), usados = rs.map(r => r.nombre.toLowerCase());
    const sug = SUGERIDOS.filter(n => !usados.includes(n.toLowerCase()));
    const reordenar = useCallback((ids) => { ids.forEach((id, i) => almacen.editar('roles', id, { orden: i + 1 })); almacen.flush(); }, []);
    const { contenedor, lista, claseItem, grip } = useOrdenable(rs.map(r => r.id), reordenar);
    const porId = Object.fromEntries(rs.map(r => [r.id, r]));
    return (
        <>
            {rs.length ? (
                <div className="rl-lista lista" ref={contenedor}>
                    {lista.filter(id => porId[id]).map(id => <Rol key={id} d={d} r={porId[id]} claseItem={claseItem} grip={grip} />)}
                </div>
            ) : <p className="t-sm mut">Sin roles todavía.</p>}
            <form className="entrada" noValidate style={{ height: 50 }} onSubmit={e => { e.preventDefault(); if (crearRol(d, nuevo)) setNuevo(''); }}>
                <label className="sr" htmlFor="rol-nuevo">Nuevo rol</label>
                <input id="rol-nuevo" type="text" maxLength={60} autoComplete="off" placeholder="Nuevo rol, ej. Director comercial" value={nuevo} onChange={e => setNuevo(e.target.value)} />
                <button type="submit" className="btn btn--cta btn--sm"><Icono n="plus" />Crear</button>
            </form>
            {sug.length > 0 && (
                <div className="compo-sug">
                    <span className="t-rotulo">Rápido</span>
                    {sug.map(n => <button key={n} type="button" className="sug" onClick={() => crearRol(d, n)}><Icono n="plus" />{n}</button>)}
                </div>
            )}
        </>
    );
}
