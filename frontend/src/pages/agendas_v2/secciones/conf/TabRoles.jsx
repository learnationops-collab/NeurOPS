// Configuración › Roles (nombre, abreviación, ícono, color, cuántas personas) y › Accesos (la matriz
// de permisos por rol, con "Recibe llamadas").

import { Fragment, useCallback, useState } from 'react';
import { Icono, Sx } from '../../ui/base';
import { toast } from '../../ui/toast';
import { useOrdenable } from '../../ui/useOrdenable';
import { almacen, useDatos } from '../../data/hooks';
import { COLORES, ICONOS_ROL, PERMISOS, accesosPorNombre } from '../../core/catalogos';
import { colorRol, colorVar, maxOrden, ord } from '../../core/datos';
import { mayus } from '../../core/util';
import { InputVivo } from './campos';
import { iniciarSim } from './simulacion';

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
            <button type="button" className="ibtn ibtn--xs" aria-label={'Simular ' + r.nombre} title="Simular" onClick={() => iniciarSim({ tipo: 'rol', id: r.id })}>
                <Icono n="ojo" />
            </button>
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

export function TabAccesos() {
    const { d } = useDatos();
    const rs = ord(d, 'roles');
    if (!rs.length) return <p className="t-sm mut">Creá roles primero.</p>;
    const cols = { gridTemplateColumns: 'minmax(200px,1.6fr) repeat(' + rs.length + ',minmax(76px,1fr))' };
    const alternar = (r, k) => {
        if (k === 'atiende') { almacen.editar('roles', r.id, { atiende: !r.atiende }, true); return; }
        almacen.editar('roles', r.id, { accesos: r.accesos.includes(k) ? r.accesos.filter(x => x !== k) : [...r.accesos, k] }, true);
    };
    const celda = (r, k, etiqueta) => {
        const on = k === 'atiende' ? r.atiende : r.accesos.includes(k);
        return (
            <span key={r.id} role="cell">
                <button type="button" className="chk" aria-pressed={on} aria-label={r.nombre + ': ' + etiqueta} onClick={() => alternar(r, k)}><Icono n="check" s={15} /></button>
            </span>
        );
    };
    return (
        <div className="matriz">
            <div className="prm" role="table" aria-label="Accesos por rol" style={{ minWidth: 200 + rs.length * 80 }}>
                <div className="prm-f prm-cab" role="row" style={cols}>
                    <span role="columnheader" />
                    {rs.map(r => (
                        <span key={r.id} role="columnheader" className="prm-rol" title={r.nombre} style={{ '--c': colorRol(r) }}>
                            <span className="rol-ico"><Icono n={r.icono} s={15} /></span><b>{r.abrev}</b>
                        </span>
                    ))}
                </div>
                <div className="prm-f" role="row" style={cols}>
                    <span role="rowheader" className="prm-p"><Icono n="clock" s={14} />Recibe llamadas</span>
                    {rs.map(r => celda(r, 'atiende', 'Recibe llamadas'))}
                </div>
                {PERMISOS.map(g => (
                    <Fragment key={g.sec}>
                        <div className="prm-sec" role="row"><span role="rowheader"><Icono n={g.ico} s={14} />{g.n}</span></div>
                        {g.items.map(([k, n]) => (
                            <div key={k} className="prm-f" role="row" style={cols}>
                                <span role="rowheader" className="prm-p">{n}</span>
                                {rs.map(r => celda(r, k, n))}
                            </div>
                        ))}
                    </Fragment>
                ))}
            </div>
        </div>
    );
}
