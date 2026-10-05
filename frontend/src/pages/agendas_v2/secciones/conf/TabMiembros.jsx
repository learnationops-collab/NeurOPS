// Configuración › Miembros: personas con nombre, correo y rol; sumar una nueva; simular a cada una.

import { useState } from 'react';
import { Avatar, Icono, Sx } from '../../ui/base';
import { toast } from '../../ui/toast';
import { almacen, useDatos } from '../../data/hooks';
import { detectarPais } from '../../core/catalogos';
import { buscar, colorLibre, colorRol, maxOrden, ord } from '../../core/datos';
import { emailOk } from '../../core/normalizar';
import { mayus } from '../../core/util';
import { InputVivo } from './campos';
import { iniciarSim } from './simulacion';

// Opciones de rol: los roles creados, o closer/setter si todavía no hay. Un rol viejo que ya no
// existe se muestra igual para no perderlo.
export function opcionesRol(d, sel) {
    const rs = ord(d, 'roles');
    if (!rs.length) return [{ v: 'closer', n: 'Closer', icono: 'user' }, { v: 'setter', n: 'Setter', icono: 'user' }];
    const ops = rs.map(r => ({ v: r.id, n: r.nombre, icono: r.icono, color: colorRol(r) }));
    return sel && !buscar(d, 'roles', sel) ? [{ v: sel, n: mayus(sel), icono: 'user' }, ...ops] : ops;
}

function Miembro({ d, p }) {
    const [mal, setMal] = useState(false);
    return (
        <div className="mb">
            <Avatar p={p} />
            <InputVivo className="cf-nom" id={'mbn-' + p.id} maxLength={60} aria-label="Nombre" valor={p.nombre}
                onCambio={v => almacen.editar('personas', p.id, { nombre: v.trim() || 'Sin nombre' })} />
            <div className={'entrada mb-mail' + (mal ? ' mal' : '')}>
                <span className="prefijo"><Icono n="mail" /></span>
                <InputVivo id={'mbe-' + p.id} type="email" maxLength={120} spellCheck={false} placeholder="correo@empresa.com" aria-label={'Correo de ' + p.nombre}
                    valor={p.email} onBlur={() => setMal(false)}
                    onCambio={v => { const ok = !v.trim() || emailOk(v); setMal(!ok); if (ok) almacen.editar('personas', p.id, { email: emailOk(v) }); }} />
            </div>
            <Sx sm id={'mbr-' + p.id} label="Rol" valor={p.rol} opciones={opcionesRol(d, p.rol)} onChange={v => almacen.editar('personas', p.id, { rol: v }, true)} />
            <button type="button" className="ibtn ibtn--sm" aria-label={'Simular a ' + p.nombre} title="Simular" onClick={() => iniciarSim({ tipo: 'persona', id: p.id })}>
                <Icono n="ojo" s={15} />
            </button>
        </div>
    );
}

function NuevoMiembro({ d }) {
    const rs = ord(d, 'roles');
    const [nombre, setNombre] = useState(''), [email, setEmail] = useState(''), [rol, setRol] = useState(null), [err, setErr] = useState({});
    const rolSel = rol || (rs[rs.length - 1] || {}).id || 'closer';
    const sumar = (e) => {
        e.preventDefault();
        const nm = nombre.replace(/\s+/g, ' ').trim(), em = emailOk(email), emMal = !!email.trim() && !em;
        setErr({ nombre: !nm, email: emMal });
        if (!nm || emMal) { document.getElementById(!nm ? 'mb-nombre' : 'mb-email')?.focus(); return; }
        const r = buscar(d, 'roles', rolSel), horario = {};
        for (let i = 0; i < 7; i++) horario[i] = r && r.atiende && i >= 1 && i <= 5 ? [['09:00', '18:00']] : [];
        almacen.crear('personas', {
            nombre: nm, email: em, rol: rolSel || 'closer', nivel: 3, color: colorLibre(d, 'personas'), tz: detectarPais().tz, horario,
            orden: maxOrden(d, 'personas') + 1,
        });
        setNombre(''); setEmail('');
        toast(nm + ' sumado');
        document.getElementById('mb-nombre')?.focus();
    };
    return (
        <form className="mb-nuevo" noValidate onSubmit={sumar}>
            <input className={'input' + (err.nombre ? ' mal' : '')} id="mb-nombre" maxLength={60} autoComplete="off" placeholder="Nombre" aria-label="Nombre"
                aria-invalid={err.nombre || undefined} value={nombre} onChange={e => { setNombre(e.target.value); setErr(x => ({ ...x, nombre: false })); }} />
            <input className={'input' + (err.email ? ' mal' : '')} id="mb-email" type="email" maxLength={120} autoComplete="off" spellCheck={false} placeholder="Correo" aria-label="Correo"
                aria-invalid={err.email || undefined} value={email} onChange={e => { setEmail(e.target.value); setErr(x => ({ ...x, email: false })); }} />
            <Sx sm id="mb-rol" label="Rol" valor={rolSel} opciones={opcionesRol(d, rolSel)} onChange={setRol} />
            <button type="submit" className="btn btn--cta btn--sm"><Icono n="plus" />Sumar</button>
        </form>
    );
}

export default function TabMiembros() {
    const { d } = useDatos();
    const ps = ord(d, 'personas');
    return (
        <>
            <div className="mb-lista">
                {ps.length ? ps.map(p => <Miembro key={p.id} d={d} p={p} />) : <p className="t-sm mut">Sin miembros todavía.</p>}
            </div>
            <NuevoMiembro d={d} />
            <p className="t-cap mut40 mb-nota"><Icono n="mail" s={13} />Queda guardado el correo y el rol. El mail de invitación necesita conectar un servidor de envío.</p>
        </>
    );
}
